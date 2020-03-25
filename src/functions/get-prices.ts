import { initSentry, catchErrors } from '../errors';
initSentry();

import fetch from 'node-fetch';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { getCorsResponseHeaders } from '../cors';

export const handler = catchErrors(async (event: APIGatewayProxyEvent) => {
    let headers = getCorsResponseHeaders(event);

    if (event.httpMethod !== 'OPTIONS') {
        // Cache the per-user result for 1 hour
        headers['Cache-Control'] = 'private, max-age=3600';
    }

    const sourceIp = event.headers['client-ip'];
    const { product_ids } = event.queryStringParameters as { product_ids?: string };

    if (!product_ids) throw new Error("Product ids required");

    const response = await fetch(`https://checkout.paddle.com/api/2.0/prices?product_ids=${product_ids}&quantity=1&customer_ip=${sourceIp}`);

    if (!response.ok) {
        return {
            statusCode: response.status,
            body: response.body
        };
    }

    const data = await response.json();

    return {
        statusCode: 200,
        headers: Object.assign(headers, { 'content-type': 'application/json' }),
        body: JSON.stringify(data)
    };
});