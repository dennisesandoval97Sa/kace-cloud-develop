import { KnexCaseRepository } from '@kace/core/src/cases';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';

import { CaseFactory } from '@kace/core/src/factories/CaseFactory';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';
import { NOT_FOUND_ERROR } from '@kace/error-codes';

describe('CaseCloneController test', () => {
    const repository = new KnexCaseRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/case-clone`
            : 'http://127.0.0.1:60062';

    afterAll(async () => {
        try {
            repository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    it('can clone a exist case', async () => {
        const kase = await CaseFactory.create();

        const payload = {
            id: uuidv4(),
            comment: {
                id: uuidv4(),
                descripcion: 'Lo necesitaba clonar',
                calificacion: 5,
            },
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${kase.id.value}`, payload);
        const originalCase = await repository
            .connection(repository.tableName)
            .select('id')
            .where({ caso_clonado_id: kase.id.value })
            .first();

        const clonedCase = await repository
            .connection(repository.tableName)
            .select('id')
            .where({ id: payload.id })
            .first();

        const comment = await repository
            .connection('comentarios')
            .select('id')
            .where({ id: payload.comment.id, caso_id: payload.id })
            .first();

        expect(response.status).toBe(200);
        expect(originalCase.id).not.toBeNull;
        expect(clonedCase.id).not.toBeNull;
        expect(comment.id).not.toBeNull;
    }, 50000);

    it('should return error when try clone a not exist case', async () => {
        const id = uuidv4();

        const payload = {
            id: uuidv4(),
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${id}`, payload);
        expect(response).toHaveProperty('response.data.errors', [{ code: NOT_FOUND_ERROR, message: 'Not found' }]);
    });
});
