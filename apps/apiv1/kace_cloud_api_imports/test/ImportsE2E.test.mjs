import { TestHelper } from '@kace/api-common';

describe('field-listE2E test', () => {
    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/imports`
            : 'http://localhost:60092';

    it('Register an import file', async () => {
        const payload = {
            presignedUrl:
                'https://s3pruebaskace.s3.us-east-1.amazonaws.com/helps/4185a606-ebdb-4d45-818e-320576b28dec/testpuntoycoma.csv?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAZEE2CGX7T6GAMRWR%2F20250306%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20250306T145828Z&X-Amz-Expires=3600&X-Amz-Signature=b62782d00301281d49b3fe6dd72721a9c0826cf52595639a65b89de52cd5e343&X-Amz-SignedHeaders=host&x-id=PutObject',
            targetTable: 'usuarios',
        };

        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response).toHaveProperty('status', 200);
    });

    it('return statusCode 400 when validation fails to register a import file', async () => {
        const payload = {};

        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response).toHaveProperty('status', 400);
    });
});
