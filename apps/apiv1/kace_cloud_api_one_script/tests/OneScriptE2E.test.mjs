import { KnexOneScriptRepository } from '@kace/core/src/one-script';
import OneScriptMother from '@kace/core/tests/one-script/domain/OneScriptMother.js';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { OneScriptFactory } from '@kace/core/src/factories/OneScriptFactory.js';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';
import { Helper } from '@kace/core/src/shared/index.js';

describe('OneScriptController test', () => {
    const repository = new KnexOneScriptRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/one-script`
            : 'http://127.0.0.1:60036';

    afterAll(async () => {
        try {
            await repository.connection.destroy();
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    it('should create an OneScript', async () => {
        const payload = await new OneScriptFactory(knexConfig).generateAttributes();
        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(201);
    });

    it('should return statusCode 400 when validation fails to create an OneScript', async () => {
        const payload = {};

        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response).toHaveProperty('status', 400);
    });

    it('should fetch an OneScript', async () => {
        const oneScript = await new OneScriptFactory(knexConfig).create();
        const dataExpected = {
            id: oneScript.id.value,
            name: oneScript.name.value,
            url: oneScript.url.value,
            url_api: oneScript.url_api.value,
            schema_id: oneScript.schema_id?.value ?? null,
            onescript_reference_id: oneScript.onescript_reference_id.value ?? null,
            created_at: oneScript.created_at.value,
            created_by: oneScript.created_by.value,
            updated_at: oneScript.updated_at.value,
            updated_by: null,
        };

        const response = await TestHelper.getRequest(`${baseUrl}/${oneScript.id.value}`);
        expect(response.status).toBe(200);
        expect(response.data.data).toEqual(dataExpected);
    });

    it('should fetch all OneScripts', async () => {
        const oneScript1 = await new OneScriptFactory(knexConfig).create();
        const oneScript2 = await new OneScriptFactory(knexConfig).create();

        const response = await TestHelper.getRequest(baseUrl);

        expect(response.status).toBe(200);
        expect(response.data.data.items[0].id).toEqual(oneScript2.id.value);
        expect(response.data.data.items[1].id).toEqual(oneScript1.id.value);
    });

    it('should delete an OneScript', async () => {
        const oneScript = await new OneScriptFactory(knexConfig).create();
        const response = await TestHelper.getRequest(`${baseUrl}/${oneScript.id.value}/delete`);
        expect(response.status).toBe(200);
    });

    it('should update an OneScript and persist the new OneScript form ID', async () => {
        const oneScript = await new OneScriptFactory(knexConfig).create();
        const newReferenceId = uuidv4();
        const payload = {
            name: 'Updated name',
            onescript_reference_id: newReferenceId,
        };
        const response = await TestHelper.postRequest(`${baseUrl}/${oneScript.id.value}`, payload);
        expect(response.status).toBe(200);

        const updated = await TestHelper.getRequest(`${baseUrl}/${oneScript.id.value}`);
        expect(updated.data.data.onescript_reference_id).toBe(newReferenceId);
    });

    it('should keep the OneScript form ID on a partial update that omits it', async () => {
        const oneScript = await new OneScriptFactory(knexConfig).create();
        const response = await TestHelper.postRequest(`${baseUrl}/${oneScript.id.value}`, { name: 'Partial name' });
        expect(response.status).toBe(200);

        const updated = await TestHelper.getRequest(`${baseUrl}/${oneScript.id.value}`);
        expect(updated.data.data.name).toBe('Partial name');
        expect(updated.data.data.onescript_reference_id).toBe(oneScript.onescript_reference_id.value);
    });

    it('should return statusCode 400 when an update tries to clear the OneScript form ID', async () => {
        const oneScript = await new OneScriptFactory(knexConfig).create();
        const response = await TestHelper.postRequest(`${baseUrl}/${oneScript.id.value}`, {
            onescript_reference_id: null,
        });
        expect(response).toHaveProperty('status', 400);
        // Validation failure, not the tenant-context error the double toJson() used to produce.
        expect(response.response.data.data.code).toBe('0x030001');
    });

    it('should return notFound when the resource doesnt exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}/invalid`);
        expect(response).toHaveProperty('status', 403);
    });
});
