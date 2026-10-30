import { KnexCommentsRepository } from '@kace/core/src/comments';
import CommentsMother from '@kace/core/tests/comments/domain/CommentsMother';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';
import { CaseFactory } from '@kace/core/src/factories/CaseFactory';
import { Helper } from '@kace/core/src/shared/index.js';

describe('CommentsController test', () => {
    const repository = new KnexCommentsRepository(knexConfig);
    let caseId;

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/comments`
            : `http://127.0.0.1:60020`;

    beforeAll(async () => {
        try {
            const { id: kaseId } = await repository.connection('casos').select('id').first();
            if (kaseId) {
                caseId = kaseId;
            } else {
                const { id } = await CaseFactory.create();
                caseId = id.value;
            }
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    afterAll(async () => {
        try {
            await repository.connection.destroy();
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    it('should create a Comment', async () => {
        const payload = CommentsMother.dto(caseId);

        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response.status).toBe(201);
        expect(response.data.data.id).toEqual(expect.any(String));
    });

    it('return statusCode 400 when validation fails to create a Comment', async () => {
        const payload = {};

        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response).toHaveProperty('status', 400);
    });

    it('should fetch a Comment', async () => {
        const comment = await CommentsMother.createComment(repository, caseId);
        const dataExpected = {
            id: comment.id.value,
            descripcion: comment.descripcion.value,
            calificacion: comment.calificacion.value,
            creator: null,
            created_at: comment.created_at.value,
            updated_at: comment.updated_at.value,
            created_by: comment.created_by.value,
            updated_by: null,
        };
        const response = await TestHelper.getRequest(`${baseUrl}/${comment.id.value}`);
        expect(response.status).toBe(200);
        expect(response.data.data).toEqual(dataExpected);
    });

    it('should fetch all Comment', async () => {
        await CommentsMother.createRandomComment(repository, caseId);
        await CommentsMother.createRandomComment(repository, caseId);
        const response = await TestHelper.getRequest(baseUrl);
        expect(response.status).toBe(200);
    });

    it('should fetch comments using search', async () => {
        const dtoCriteria = {
            filter: [
                {
                    field: 'caso_id',
                    operator: 'eq',
                    value: caseId,
                    type: 'AND',
                },
            ],
            relationship: null,
            limit: 1,
            offset: 0,
        };

        const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);
        expect(response.status).toBe(200);
        expect(response.data.data.items.length).toEqual(1);
    });

    it('should update a Comment', async () => {
        const comment = await CommentsMother.createComment(repository, caseId);
        const payload = {
            descripcion: 'updated',
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${comment.id.value}`, payload);
        expect(response.status).toBe(200);
    });

    it('should return notFound when the resource does not exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}/resource`);
        expect(response).toHaveProperty('status', 403);
    });
});
