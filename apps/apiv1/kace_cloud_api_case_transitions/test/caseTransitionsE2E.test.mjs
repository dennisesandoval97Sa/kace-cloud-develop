import { CaseUpdater, KnexCaseRepository } from '@kace/core/src/cases';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';

import { CaseFactory } from '@kace/core/src/factories/CaseFactory';

describe('ActionUpdateModelController test', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const actionExecutionServiceMock = {
        execute: async (trigger, caso) => (trigger && caso ? true : null),
    };

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/case-transitions`
            : 'http://127.0.0.1:60058';

    afterAll(async () => {
        try {
            repository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    it('can fetch transitions for case', async () => {
        const kase = await CaseFactory.create();
        const updater = new CaseUpdater(repository, actionExecutionServiceMock);

        updater.execute(kase.id.value, { vista: 'Vista actualizada' });

        const caseTransitions = await TestHelper.getRequest(`${baseUrl}/${kase.id.value}`);
        const response = caseTransitions.data.data;
        expect(caseTransitions.status).toBe(200);
        expect(response).toBeInstanceOf(Array);
        expect(response.length).toEqual(1);
        expect(response[0]).toMatchObject({
            actualizador: expect.any(String),
            fecha: expect.any(String),
            responsable: expect.any(String),
            grupo: expect.any(String),
            estado_actual: null,
            estado_siguiente: expect.any(String),
            fecha_resolucion: expect.any(String),
        });
    });

    it('should return 200 when not found data with transitions', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toMatchObject({});
    });
});
