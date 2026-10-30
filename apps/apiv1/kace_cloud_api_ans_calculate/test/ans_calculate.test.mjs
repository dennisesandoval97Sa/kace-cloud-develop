import { handler } from '../src/handler.mjs';

const event = {
    body: '{\n  "measurementType": "Hours"\n}',
    headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate, br',
        Authorization:
            'eyJraWQiOiJ1UTdOdllzZUNKS3Nia09odHY2VVJVUnJ4S2wxMit3RXlSKzR3Mk9kUXBJPSIsImFsZyI6IlJTMjU2In0.eyJhdF9oYXNoIjoiYTBIcy0xSTRuSlRneGtXVmxMZGRkZyIsInN1YiI6Ijg0OTg2NGI4LTEwNDEtNzA4Ni0zYjFhLTA4MGFhMjU3ZTNlOSIsImNvZ25pdG86Z3JvdXBzIjpbInVzLWVhc3QtMV9IRnRIZ1BydjVfa2V5Y2xvYWstZGV2Il0sImVtYWlsX3ZlcmlmaWVkIjpmYWxzZSwiaXNzIjoiaHR0cHM6XC9cL2NvZ25pdG8taWRwLnVzLWVhc3QtMS5hbWF6b25hd3MuY29tXC91cy1lYXN0LTFfSEZ0SGdQcnY1IiwiY29nbml0bzp1c2VybmFtZSI6ImtleWNsb2FrLWRldl9jbzc4ODJ6amMiLCJvcmlnaW5fanRpIjoiYzg5ZGUzNmMtOTU2MS00NjUxLTg3MmYtNTM0NTk1YjE0NjM3IiwiYXVkIjoiY2xhOXY0OXRnMHNmY3ZqZmJ2N3Nvc2xqMiIsImlkZW50aXRpZXMiOlt7ImRhdGVDcmVhdGVkIjoiMTczNjUyODI3ODIxNSIsInVzZXJJZCI6ImNvNzg4MnpqYyIsInByb3ZpZGVyTmFtZSI6ImtleWNsb2FrLWRldiIsInByb3ZpZGVyVHlwZSI6IlNBTUwiLCJpc3N1ZXIiOm51bGwsInByaW1hcnkiOiJ0cnVlIn1dLCJ0b2tlbl91c2UiOiJpZCIsImF1dGhfdGltZSI6MTczODA1MTQwMCwiZXhwIjoxNzM4MDU2MjI4LCJpYXQiOjE3MzgwNTU5MjksImp0aSI6ImFhY2I4YjNmLTk5ZjAtNDIwYi1iYTE4LTQwNjI4Y2MwZWZhNCIsImVtYWlsIjoicm9iZXJ0by5nYXJjaWFAa29uZWN0YS1ncm91cC5jb20ifQ.GwbxVvnBFCrrYG3cKXQEm6SVEBSCm9GGS_hFAIvw33cLbNtIsgFijpeUNZUTD5IW5QLvvTY-P4LsyJG4N-zMxZo5UZK2aqZwnqApGyi-zV61vYC0xfZ47qEODbkPanxB5ajuFbyhuY5Wh1M7g_bVlQUThM71C8Zq8iFSSXsKOb3Uqm52zaG0N4Z8I1Zh9rqrgfHZb0Zp5T3sRcxjhiG9LjSq0VAYYxNmW6MekUGJNrUUVCZtp-giPsMhuinMR2aUml4mMtk98e8D7_DkQ3UkMRJzcOVNjPq1QH4YWR2KX3Ut1zx6HQr393gUKQPrvrd00DU4U7dTy3NoEWxofrYqPw',
        Connection: 'keep-alive',
        'Content-Length': '32',
        'Content-Type': 'application/json',
        Host: 'localhost:60021',
        'Postman-Token': 'ddbca1de-60d1-4602-bfda-ad9740f61945',
        'User-Agent': 'PostmanRuntime/7.43.0',
        'X-Forwarded-Port': '60021',
        'X-Forwarded-Proto': 'http',
    },
    httpMethod: 'POST',
    isBase64Encoded: false,
    multiValueHeaders: {
        Accept: ['application/json'],
        'Accept-Encoding': ['gzip, deflate, br'],
        Authorization: [
            'eyJraWQiOiJ1UTdOdllzZUNKS3Nia09odHY2VVJVUnJ4S2wxMit3RXlSKzR3Mk9kUXBJPSIsImFsZyI6IlJTMjU2In0.eyJhdF9oYXNoIjoiYTBIcy0xSTRuSlRneGtXVmxMZGRkZyIsInN1YiI6Ijg0OTg2NGI4LTEwNDEtNzA4Ni0zYjFhLTA4MGFhMjU3ZTNlOSIsImNvZ25pdG86Z3JvdXBzIjpbInVzLWVhc3QtMV9IRnRIZ1BydjVfa2V5Y2xvYWstZGV2Il0sImVtYWlsX3ZlcmlmaWVkIjpmYWxzZSwiaXNzIjoiaHR0cHM6XC9cL2NvZ25pdG8taWRwLnVzLWVhc3QtMS5hbWF6b25hd3MuY29tXC91cy1lYXN0LTFfSEZ0SGdQcnY1IiwiY29nbml0bzp1c2VybmFtZSI6ImtleWNsb2FrLWRldl9jbzc4ODJ6amMiLCJvcmlnaW5fanRpIjoiYzg5ZGUzNmMtOTU2MS00NjUxLTg3MmYtNTM0NTk1YjE0NjM3IiwiYXVkIjoiY2xhOXY0OXRnMHNmY3ZqZmJ2N3Nvc2xqMiIsImlkZW50aXRpZXMiOlt7ImRhdGVDcmVhdGVkIjoiMTczNjUyODI3ODIxNSIsInVzZXJJZCI6ImNvNzg4MnpqYyIsInByb3ZpZGVyTmFtZSI6ImtleWNsb2FrLWRldiIsInByb3ZpZGVyVHlwZSI6IlNBTUwiLCJpc3N1ZXIiOm51bGwsInByaW1hcnkiOiJ0cnVlIn1dLCJ0b2tlbl91c2UiOiJpZCIsImF1dGhfdGltZSI6MTczODA1MTQwMCwiZXhwIjoxNzM4MDU2MjI4LCJpYXQiOjE3MzgwNTU5MjksImp0aSI6ImFhY2I4YjNmLTk5ZjAtNDIwYi1iYTE4LTQwNjI4Y2MwZWZhNCIsImVtYWlsIjoicm9iZXJ0by5nYXJjaWFAa29uZWN0YS1ncm91cC5jb20ifQ.GwbxVvnBFCrrYG3cKXQEm6SVEBSCm9GGS_hFAIvw33cLbNtIsgFijpeUNZUTD5IW5QLvvTY-P4LsyJG4N-zMxZo5UZK2aqZwnqApGyi-zV61vYC0xfZ47qEODbkPanxB5ajuFbyhuY5Wh1M7g_bVlQUThM71C8Zq8iFSSXsKOb3Uqm52zaG0N4Z8I1Zh9rqrgfHZb0Zp5T3sRcxjhiG9LjSq0VAYYxNmW6MekUGJNrUUVCZtp-giPsMhuinMR2aUml4mMtk98e8D7_DkQ3UkMRJzcOVNjPq1QH4YWR2KX3Ut1zx6HQr393gUKQPrvrd00DU4U7dTy3NoEWxofrYqPw',
        ],
        Connection: ['keep-alive'],
        'Content-Length': ['32'],
        'Content-Type': ['application/json'],
        Host: ['localhost:60021'],
        'Postman-Token': ['ddbca1de-60d1-4602-bfda-ad9740f61945'],
        'User-Agent': ['PostmanRuntime/7.43.0'],
        'X-Forwarded-Port': ['60021'],
        'X-Forwarded-Proto': ['http'],
    },
    multiValueQueryStringParameters: null,
    path: '/',
    pathParameters: null,
    queryStringParameters: null,
    requestContext: {
        accountId: '123456789012',
        apiId: '1234567890',
        domainName: 'localhost:60021',
        extendedRequestId: null,
        httpMethod: 'POST',
        identity: {
            accountId: null,
            apiKey: null,
            caller: null,
            cognitoAuthenticationProvider: null,
            cognitoAuthenticationType: null,
            cognitoIdentityPoolId: null,
            sourceIp: '127.0.0.1',
            user: null,
            userAgent: 'Custom User Agent String',
            userArn: null,
        },
        path: '/',
        protocol: 'HTTP/1.1',
        requestId: '0c431b95-0acc-4fdf-9314-d7c7e84c6c6a',
        requestTime: '28/Jan/2025:09:18:44 +0000',
        requestTimeEpoch: 1738055924,
        resourceId: '123456',
        resourcePath: '/',
        stage: 'prod',
    },
    resource: '/',
    stageVariables: null,
};

describe('AnsController test', () => {
    it('should calculate an ANS', async () => {
        await handler(event);
    });
});
