import { KnexClientRepository } from '@kace/core/src/clients';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import ClientMother from '@kace/core/tests/clients/domain/ClientMother';
import { Helper } from '@kace/core/src/shared/index.js';

describe('ClientController test', () => {
    const repository = new KnexClientRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/clients_contacts`
            : 'http://127.0.0.1:60057';

    afterAll(async () => {
        try {
            repository.connection.destroy();
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    it('should return all the doctypes', async () => {
        const client = await ClientMother.createClient(repository);
        await ClientMother.createClient(repository, { padre_id: client.id.value });
        const response = await TestHelper.getRequest(`${baseUrl}/${client.id.value}`);
        const { padre_id } = response.data.data.items[0];

        expect(response.status).toBe(200);
        expect(response.data.data.items.length).toBeGreaterThan(0);
        expect(padre_id).toEqual(client.id.value);
    });
});
