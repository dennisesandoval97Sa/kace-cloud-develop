import dotenv from 'dotenv';
dotenv.config();

const operationConfig = {
    GET: ({ id }) => ({
        httpMethod: 'GET',
        resource: id ? '/{id}' : '/',
        pathParameters: id ? { id } : null,
    }),

    SEARCH: () => ({
        httpMethod: 'GET',
        resource: '/search',
        pathParameters: null,
    }),

    UPDATE: ({ id }) => ({
        httpMethod: 'POST',
        resource: '/{id}',
        pathParameters: id ? { id } : null,
    }),

    CREATE: () => ({
        httpMethod: 'POST',
        resource: '/',
        pathParameters: null,
    }),
};

export const eventBase = ({
    operation = 'GET',
    body = null,
    id = null,
    queryStringParameters = null,
    headers = {},
}) => {
    const op = operation.toUpperCase();

    if (!operationConfig[op]) {
        throw new Error(`Unsupported operation type: ${operation}`);
    }

    const { httpMethod, resource, pathParameters } = operationConfig[op]({ id });

    return {
        httpMethod,
        resource,
        pathParameters,
        queryStringParameters,
        body: body ? JSON.stringify(body) : null,
        headers: {
            Authorization: process.env.AWS_COGNITO_IDTOKEN,
            Host: 'localhost',
            ...headers,
        },
        requestContext: {
            identity: {
                sourceIp: '127.0.0.1',
            },
        },
    };
};
