import { KnexCaseRepository } from '@kace/core/src/cases';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';

import { CaseFactory } from '@kace/core/src/factories/CaseFactory';
import { BAD_REQUEST_ERROR } from '@kace/error-codes';
describe('ActionUpdateModelController test', () => {
    const repository = new KnexCaseRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/case-re-open`
            : 'http://127.0.0.1:60063';

    afterAll(async () => {
        try {
            repository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    it('can re open a close case with a comment', async () => {
        const kase = await CaseFactory.create({}, 'closed');

        const payload = {
            comment: {
                descripcion: 'Reabrir el caso',
            },
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${kase.id.value}`, payload);
        const caseReopened = await repository
            .connection(repository.tableName)
            .select('*')
            .where({ id: kase.id.value })
            .first();

        const comment = await repository
            .connection('comentarios')
            .select('id')
            .where({ caso_id: kase.id.value })
            .first();

        expect(response.status).toBe(200);
        expect(caseReopened.reopen_by).not.toBeNull();
        expect(caseReopened.reopen_at).not.toBeNull();
        expect(comment).toBeDefined();
        expect(comment.id).not.toBeNull();
        expect(caseReopened.cambio_estado_comentario_id).toEqual(comment.id);
    });

    it('should return error when try re open a not close case', async () => {
        const kase = await CaseFactory.create();

        const payload = {
            comment: {
                descripcion: 'Reabrir el caso',
            },
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${kase.id.value}`, payload);
        expect(response).toHaveProperty('response.data.errors', [{ code: BAD_REQUEST_ERROR, message: 'Bad request' }]);
    });
});
