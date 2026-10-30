import { KnexCommentsRepository } from '@kace/core/src/comments';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { CaseFactory } from '@kace/core/src/factories/CaseFactory';
import { Helper } from '@kace/core/src/shared/index.js';

const MISSING_CASE_ID = '11111111-1111-4111-8111-111111111111';

describe('CommentsBatchController test', () => {
    const repository = new KnexCommentsRepository(knexConfig);
    /** Ids created by the suite, removed in afterAll so no environment keeps ghost rows. */
    const createdIds = [];
    let caseId;

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/comments-batch`
            : `http://127.0.0.1:60066`;

    beforeAll(async () => {
        try {
            const kase = await repository.connection('cases').select('id').first();
            caseId = kase?.id ?? (await CaseFactory.create()).id.value;
        } catch (error) {
            // Fail fast: without a valid case every POST returns an opaque 400 and the
            // whole suite becomes misleading.
            Helper.logError('comments-batch E2E setup failed', error);
            throw error;
        }
    });

    afterAll(async () => {
        try {
            if (createdIds.length > 0) {
                await repository.connection('history_comentarios').whereIn('entity_id', createdIds).delete();
                await repository.connection('comentarios').whereIn('id', createdIds).delete();
            }
        } catch (error) {
            Helper.logInfo(error);
        }
        try {
            await repository.connection.destroy();
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    it('should batch create several comments and return their ids', async () => {
        const payload = [
            { descripcion: 'batch comment one', calificacion: 5, caso_id: caseId },
            { descripcion: 'batch comment two', calificacion: 8, caso_id: caseId },
            { descripcion: 'batch comment three', calificacion: null, caso_id: caseId },
        ];

        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(201);
        expect(response.data.data.ids).toHaveLength(payload.length);
        expect(response.data.data.ids[0]).toEqual(expect.any(String));

        createdIds.push(...response.data.data.ids);

        // ids come back in request order, which is the documented contract.
        const rows = await repository.connection('comentarios').whereIn('id', response.data.data.ids).select('*');
        const byId = new Map(rows.map((row) => [row.id, row]));
        response.data.data.ids.forEach((id, index) => {
            expect(byId.get(id).descripcion).toBe(payload[index].descripcion);
        });

        // A nullable calificacion must persist as NULL, never coerced to 0.
        expect(byId.get(response.data.data.ids[2]).calificacion).toBeNull();
    });

    it('should return 400 when the batch is empty', async () => {
        const response = await TestHelper.postRequest(baseUrl, []);

        expect(response.status).toBe(400);
    });

    it('should return 400 when any item in the batch is invalid', async () => {
        const payload = [
            { descripcion: 'valid comment', calificacion: 5, caso_id: caseId },
            { descripcion: 'no', calificacion: 5, caso_id: caseId }, // descripcion too short
        ];

        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(400);
    });

    it('should return 400 when the batch exceeds the 500 item limit', async () => {
        const payload = Array.from({ length: 501 }, (_, index) => ({
            descripcion: `batch comment over limit ${index}`,
            calificacion: 5,
            caso_id: caseId,
        }));

        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(400);
    });

    it('should persist nothing when one item references a missing case', async () => {
        const validDescription = 'batch comment all or nothing';
        const payload = [
            { descripcion: validDescription, calificacion: 5, caso_id: caseId },
            { descripcion: 'batch comment missing case', calificacion: 5, caso_id: MISSING_CASE_ID },
        ];

        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(404);

        // All-or-nothing: the first (valid) item must not have been persisted either.
        const rows = await repository.connection('comentarios').where({ descripcion: validDescription }).select('id');
        expect(rows).toHaveLength(0);
    });

    it('should forbid unknown routes (API Gateway returns 403)', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/invalid/resource/sure`);

        expect(response.status).toBe(403);
    });
});
