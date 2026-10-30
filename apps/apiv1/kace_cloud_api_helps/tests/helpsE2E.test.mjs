import { KnexHelpsRepository } from '@kace/core/src/helps/index';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import HelpsMother from '@kace/core/tests/helps/domain/HelpsMother';
import { Helper } from '@kace/core/src/shared/index.js';

describe('HelpsController test', () => {
    const repository = new KnexHelpsRepository(knexConfig);
    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/helps`
            : 'http://127.0.0.1:60030';

    afterAll(async () => {
        try {
            repository.connection.destroy();
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    it('should create a help record with a server-generated id', async () => {
        const payload = HelpsMother.dto();
        delete payload.id;
        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(201);
        expect(response.data.data.id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );

        const persistedHelpResponse = await TestHelper.getRequest(`${baseUrl}/${response.data.data.id}`);
        expect(persistedHelpResponse.status).toBe(200);
        expect(persistedHelpResponse.data.data.id).toBe(response.data.data.id);
    });

    it('should fetch all help records', async () => {
        const help1 = await HelpsMother.createRandomHelps(repository);
        const help2 = await HelpsMother.createRandomHelps(repository);
        const response = await TestHelper.getRequest(baseUrl);
        expect(response.status).toBe(200);
        expect(response.data.data.items[0].id).toEqual(help2.id.value);
        expect(response.data.data.items[1].id).toEqual(help1.id.value);
    });

    it('should fetch a specific help record by ID', async () => {
        const help = await HelpsMother.createHelp(repository);
        const dataExpected = {
            id: help.id.value,
            titulo: help.titulo.value,
            descripcion: help.descripcion.value,
            color: help.color.value,
            is_active: help.is_active.value ? true : false,
            created_at: help.created_at.value,
            created_by: help.created_by.value,
            updated_by: null,
            updated_at: null,
        };
        const response = await TestHelper.getRequest(`${baseUrl}/${help.id.value}`);
        dataExpected.updated_at = response.data?.data?.updated_at;
        dataExpected.attachments = response.data?.data?.attachments;

        expect(response.status).toBe(200);
        expect(response.data.data).toEqual(dataExpected);
    });

    it('should delete a help record by ID', async () => {
        const help = await HelpsMother.createHelp(repository);
        const response = await TestHelper.getRequest(`${baseUrl}/${help.id.value}/delete`);

        expect(response.status).toBe(200);
    });

    it('should update a help record', async () => {
        const help = await HelpsMother.createHelp(repository);
        const payload = {
            descripcion: 'the new description',
        };
        const response = await TestHelper.postRequest(`${baseUrl}/${help.id.value}`, payload);
        expect(response.status).toBe(200);
    });

    it('should fetch help records using search criteria', async () => {
        const help = await HelpsMother.createRandomHelps(repository);
        const dtoCriteria = {
            filter: [
                {
                    field: 'id',
                    operator: 'eq',
                    value: help.id.value,
                    type: 'AND',
                },
            ],
            limit: 10,
            offset: 0,
        };
        const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);
        expect(response.status).toBe(200);
        expect(response.data.data.items.length).toEqual(1);
    });
});
