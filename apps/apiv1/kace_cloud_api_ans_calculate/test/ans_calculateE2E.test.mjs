import { TestHelper } from '@kace/api-common';

describe('AnsController test', () => {
    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/ans-calculate`
            : `http://127.0.0.1:60021`;

    it('should calculate an Ans', async () => {
        const validData = ['Minutes', 'Hours', 'Days'];
        const payload = {
            measurementType: validData[Math.floor(Math.random() * validData.length)],
        };

        let response;
        try {
            response = await TestHelper.postRequest(baseUrl, payload);
        } catch (e) {
            console.log(e);
        }

        expect(response.status).toBe(201);
    });

    it('return statusCode 400 when validation fails to create an ANS', async () => {
        const payload = {};

        let response;
        try {
            response = await TestHelper.postRequest(baseUrl, payload);
        } catch (error) {
            response = error.response;
        }

        expect(response.status).toBe(400);
        expect(response.response.data).toHaveProperty('errors');
    });

    it('should return notFound when the resource doesnt exist', async () => {
        let response;
        try {
            const url = `${baseUrl}/invalid/url`;
            response = await TestHelper.getRequest(url);
        } catch (error) {
            response = error.response;
        }

        expect(response.status).toBe(403);
        expect(response.response.data.message).toBe('Missing Authentication Token');
    });
});
