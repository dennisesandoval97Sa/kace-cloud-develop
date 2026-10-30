import { TestHelper } from '@kace/api-common';

describe('Exports E2E test', () => {
    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/exports`
            : `http://127.0.0.1:60090`;

    it('should export documents', async () => {
        const payload = {
            tableName: 'usuarios',
            userData: {
                mail: 'mail@mail.com',
                id: '91614965-cc7e-44b0-8610-6c1f3127fbab',
                login: '64a80428-f0c1-70b9-8386-58d02c365a06',
                nombres: 'name',
                apellido1: 'lastName',
            },
        };

        let response;
        try {
            response = await TestHelper.postRequest(baseUrl, payload);
        } catch (e) {
            console.log(e);
        }

        expect(response.status).toBe(201);
    });

    it('return statusCode 400 when validation fails to export document', async () => {
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
