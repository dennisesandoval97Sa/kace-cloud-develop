import { TestHelper } from '@kace/api-common';

describe('AnsController test', () => {
    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/ans-types`
            : `http://127.0.0.1:60022`;

    it('should fetch all Ans', async () => {
        const expectedArray = [
            { key: 'DAYS', value: 'Days' },
            { key: 'HOURS', value: 'Hours' },
            { key: 'MINUTES', value: 'Minutes' },
        ];

        let response;
        try {
            response = await TestHelper.getRequest(baseUrl);
        } catch (error) {
            console.log(error.response.data);
        }

        expect(Array.isArray(response.data.data.items)).toBe(true);

        expect(response.data.data.items).toEqual(expectedArray);

        response.data.data.items.forEach((item) => {
            expect(item).toHaveProperty('key');
            expect(item).toHaveProperty('value');
            expect(typeof item.key).toBe('string');
            expect(typeof item.value).toBe('string');
        });
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
