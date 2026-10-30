import { KnexCaseRepository } from '@kace/core/src/cases';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';

import { CaseFactory } from '@kace/core/src/factories/CaseFactory';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';
import { ValueObjectUpdateSource } from '@kace/core/src/cases/domain/ValueObjectUpdateSource';

describe('CaseCloseController test', () => {
    const repository = new KnexCaseRepository(knexConfig);

    const kaceFactory = new CaseFactory(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/case-close`
            : 'http://127.0.0.1:60064';

    afterAll(async () => {
        try {
            repository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    it('can close a Case', async () => {
        const kase = await kaceFactory.create();
        const payload = {
            comment: {
                id: uuidv4(),
                caso_id: kase.id.value,
                descripcion: 'prueba',
                calificacion: 4,
            },
            motivo_baja: 'Prueba',
        };
        const response = await TestHelper.postRequest(`${baseUrl}/${kase.id.value}`, payload);
        const closedCase = await repository
            .connection(repository.tableName)
            .select('fecha_resolucion')
            .where({ id: kase.id.value })
            .first();

        expect(response.status).toBe(200);
        expect(closedCase.fecha_resolucion).not.toBeNull();
    });

    it('should return a not found when try close a closed case', async () => {
        const kase = await kaceFactory.create({}, 'closed');
        const payload = {
            comment: {
                id: uuidv4(),
                caso_id: kase.id.value,
                descripcion: 'prueba',
                calificacion: 4,
            },
            motivo_baja: 'Prueba',
        };
        const response = await TestHelper.postRequest(`${baseUrl}/${kase.id.value}`, payload);
        expect(response).toHaveProperty('response.status', 500);
    });

    it('can close a Case with update source', async () => {
        const kase = await kaceFactory.create();
        const update_source = ValueObjectUpdateSource.BULK;
        const payload = {
            comment: {
                id: uuidv4(),
                caso_id: kase.id.value,
                descripcion: 'prueba',
                calificacion: 4,
            },
            motivo_baja: 'Prueba',
            update_source,
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${kase.id.value}`, payload);

        const closedCase = await repository
            .connection(repository.tableName)
            .select('fecha_resolucion', 'update_source')
            .where({ id: kase.id.value })
            .first();

        expect(response.status).toBe(200);
        expect(closedCase.fecha_resolucion).not.toBeNull();
        expect(closedCase.update_source).toBe(update_source);
    });
});
