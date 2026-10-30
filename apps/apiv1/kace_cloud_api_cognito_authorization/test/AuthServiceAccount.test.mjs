import { TestHelper } from '@kace/api-common';
import { loadFeature, defineFeature } from 'jest-cucumber';

const feature = loadFeature('./test/AuthServiceAccount.feature');

defineFeature(feature, (test) => {
    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/auth-cognito`
            : `http://127.0.0.1:60004`;

    const credentials = {
        username: process.env.TEST_E2E_USERNAME,
        password: process.env.TEST_E2E_PASSWORD,
    };

    let response;

    test('Successful login with service account', ({ given, when, then, and }) => {
        given('the authentication service is running', () => undefined);

        when('the third party logs in with email and password', async () => {
            response = await TestHelper.postRequest(baseUrl, {
                ...credentials,
            });
        });

        then(/^the response status code should be (\d+)$/, (status) => {
            expect(response.status).toBe(parseInt(status));
        });

        and(/^the response data object should have keys "([^"]*)" and "([^"]*)" and "([^"]*)"$/, (key1, key2, key3) => {
            expect(response.data.data).toHaveProperty(key1);
            expect(response.data.data).toHaveProperty(key2);
            expect(response.data.data).toHaveProperty(key3);
        });
    });
});
