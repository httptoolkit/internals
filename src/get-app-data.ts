import { Handler } from 'aws-lambda';
import * as jwt from 'jsonwebtoken';
import * as auth0 from 'auth0';

const {
    AUTH0_DOMAIN,
    AUTH0_APP_CLIENT_ID,
    AUTH0_MGMT_CLIENT_ID,
    AUTH0_MGMT_CLIENT_SECRET
} = process.env;

const SIGNING_PRIVATE_KEY = `
-----BEGIN RSA PRIVATE KEY-----
${process.env.SIGNING_PRIVATE_KEY}
-----END RSA PRIVATE KEY-----
`;

const authClient = new auth0.AuthenticationClient({
    domain: AUTH0_DOMAIN,
    clientId: AUTH0_APP_CLIENT_ID
});

const mgmtClient = new auth0.ManagementClient({
    domain: AUTH0_DOMAIN,
    clientId: AUTH0_MGMT_CLIENT_ID,
    clientSecret: AUTH0_MGMT_CLIENT_SECRET
});

const BearerRegex = /^Bearer (\S+)$/;

/*
This endpoint expects requests to be sent with a Bearer authorization,
containing a valid access token for the Auth0 app.

If the token is found and is usable, the user's app data (email &
subscription status) are loaded and signed into a JWT, so the app can
read that info, and confirm its validity.
*/
export const handler: Handler = async (event, context) => {
    const { authorization } = event.headers;

    const tokenMatch = BearerRegex.exec(authorization);
    if (!tokenMatch) return { statusCode: 401, body: '' };

    const accessToken = tokenMatch[1];

    // getProfile is only minimal data, updated at last login
    const user: { sub: string } = await authClient.getProfile(accessToken);
    // getUser is full live data for the user
    const userData = await mgmtClient.getUser({ id: user.sub });

    const appData = Object.assign(
        { email: userData.email },
        userData.app_metadata // undefined, for new users
    );

    const signedAppData = jwt.sign(appData, SIGNING_PRIVATE_KEY, {
        algorithm: 'RS256',
        expiresIn: '7d',
        audience: 'https://httptoolkit.tech/app_metadata',
        issuer: 'https://httptoolkit.tech/'
      });

    return {
        statusCode: 200,
        headers: { 'content-type': 'application/jwt' },
        body: signedAppData
    };
}