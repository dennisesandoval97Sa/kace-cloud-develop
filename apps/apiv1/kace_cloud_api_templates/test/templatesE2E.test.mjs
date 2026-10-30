import { KnexTemplatesRepository } from '@kace/core/src/templates';
import TemplatesMother from '@kace/core/tests/templates/domain/TemplatesMother';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';

describe('TemplateController test', () => {
    const repository = new KnexTemplatesRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/templates`
            : `http://127.0.0.1:60046`;

    afterAll(async () => {
        try {
            await repository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    it('should create a Template', async () => {
        const payload = TemplatesMother.dto();
        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response.status).toBe(201);
    });

    it('return statusCode 400 when validation fails to create a Template', async () => {
        const payload = {};

        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response).toHaveProperty('status', 400);
    });

    it('should fetch a Template', async () => {
        const template = await TemplatesMother.createTemplate(repository);
        const dataExpected = {
            id: template.id.value,
            descripcion: template.descripcion.value,
            ruta: template.ruta.value,
            tipo: template.tipo.value,
            destinatario: template.destinatario.value,
            copia: template.copia.value,
            copia_oculta: template.copia_oculta.value,
            asunto: template.asunto.value,
            cuerpo: template.cuerpo.value,
            incluye_adjuntos: template.incluye_adjuntos.value,
            enviar_adjuntos_del_caso: template.enviar_adjuntos_del_caso.value,
            status: template.status.value,
            created_at: template.created_at.value,
            updated_at: template.updated_at.value,
            created_by: template.created_by.value,
            updated_by: null,
        };
        const response = await TestHelper.getRequest(`${baseUrl}/${template.id.value}`);
        expect(response.status).toBe(200);
        expect(response.data.data).toEqual(dataExpected);
    });

    it('should fetch templates using search', async () => {
        const templateCreated = await TemplatesMother.createTemplate(repository);
        const dtoCriteria = {
            filter: [
                {
                    field: 'status',
                    operator: 'eq',
                    value: '1',
                    type: 'AND',
                },
            ],
            relationship: null,
            limit: 1,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        };
        const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);
        expect(response.status).toBe(200);
        expect(response.data.data.items.length).toEqual(1);
        expect(response.data.data.items[0].id).toEqual(templateCreated.id.value);
    });

    it('should update a Template', async () => {
        await repository
            .connection(repository.tableName)
            .delete()
            .where({ descripcion: 'test E2E description update' });
        const template = await TemplatesMother.createTemplate(repository);
        const payload = {
            descripcion: 'test E2E description update',
        };
        const response = await TestHelper.postRequest(`${baseUrl}/${template.id.value}`, payload);
        expect(response.status).toBe(200);
    });

    it('should delete a Template', async () => {
        const template = await TemplatesMother.createTemplate(repository);
        const response = await TestHelper.getRequest(`${baseUrl}/${template.id.value}/delete`);
        expect(response.status).toBe(200);
    });

    it('should return notFound when the resource does not exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}/invalid`);
        expect(response).toHaveProperty('status', 403);
    });
});
