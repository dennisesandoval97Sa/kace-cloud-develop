import crypto from 'node:crypto';

/**
 * Converts an Express request into an AWS API Gateway Lambda Proxy event.
 *
 * @param {import('express').Request} req - Express request object
 * @param {string} resource - API Gateway resource pattern (e.g., '/{id}/transition')
 * @param {Object|null} pathParams - Extracted path parameters (e.g., { id: 'abc-123' })
 * @returns {Object} API Gateway Lambda Proxy Integration event
 */
export function expressToApiGatewayEvent(req, resource, pathParams) {
    const headers = normalizeHeaderKeys(req.headers);

    return {
        httpMethod: req.method,
        resource,
        path: req.path,
        headers,
        multiValueHeaders: buildMultiValueHeaders(req),
        pathParameters: pathParams || null,
        queryStringParameters: Object.keys(req.query).length > 0 ? req.query : null,
        multiValueQueryStringParameters: Object.keys(req.query).length > 0 ? buildMultiValueQuery(req.query) : null,
        body: req.body && Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : null,
        isBase64Encoded: false,
        requestContext: {
            requestId: crypto.randomUUID(),
            stage: 'local',
            identity: {
                sourceIp: req.ip || '127.0.0.1',
                userAgent: req.headers['user-agent'] || '',
            },
            authorizer: {
                claims: {},
            },
            httpMethod: req.method,
            path: req.path,
            protocol: `HTTP/${req.httpVersion}`,
            requestTimeEpoch: Date.now(),
        },
        stageVariables: null,
    };
}

/**
 * Normalize header keys to PascalCase to match API Gateway behavior.
 * Express lowercases all headers, but API Gateway preserves original casing.
 * @param {Object} headers
 * @returns {Object}
 */
function normalizeHeaderKeys(headers) {
    const result = {};
    for (const [key, value] of Object.entries(headers)) {
        const normalized = key.replace(/(^|-)(\w)/g, (_, sep, char) => sep + char.toUpperCase());
        result[normalized] = value;
    }
    return result;
}

/**
 * Build multi-value headers from Express request.
 * @param {import('express').Request} req
 * @returns {Object}
 */
function buildMultiValueHeaders(req) {
    const normalized = normalizeHeaderKeys(req.headers);
    const result = {};
    for (const [key, value] of Object.entries(normalized)) {
        result[key] = Array.isArray(value) ? value : [value];
    }
    return result;
}

/**
 * Build multi-value query string parameters.
 * @param {Object} query
 * @returns {Object}
 */
function buildMultiValueQuery(query) {
    const result = {};
    for (const [key, value] of Object.entries(query)) {
        result[key] = Array.isArray(value) ? value : [value];
    }
    return result;
}
