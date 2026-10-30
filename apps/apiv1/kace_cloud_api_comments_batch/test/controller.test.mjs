import { production as knexConfig } from '@kace/database/knexfile';
import { jest } from '@jest/globals';
import {
    createApiEvent,
    createAuthenticatedUser,
    permission,
} from '@kace/api-common/tests/helpers/ObjectIdentityFixtures.js';
import { Controller } from '../src/controller.mjs';

const CASE_ID = '55555555-5555-4555-8555-555555555555';
const OTHER_CASE_ID = '66666666-6666-4666-8666-666666666666';
const MISSING_CASE_ID = '77777777-7777-4777-8777-777777777777';

const item = (overrides = {}) => ({
    descripcion: 'A comment long enough to pass validation',
    calificacion: 5,
    caso_id: CASE_ID,
    ...overrides,
});

/**
 * Records every `repository.table(name)` call so the tests can assert how many
 * relationship SELECTs the controller actually issues.
 */
const createRepositoryStub = ({ missingIds = [] } = {}) => {
    const tableCalls = [];
    const transaction = { commit: jest.fn().mockResolvedValue(), rollback: jest.fn().mockResolvedValue() };

    return {
        tableCalls,
        transaction,
        save: jest.fn().mockResolvedValue(),
        saveHistory: jest.fn().mockResolvedValue(),
        startTransaction: jest.fn().mockResolvedValue(transaction),
        table(name) {
            const call = { table: name, id: undefined };
            tableCalls.push(call);
            const query = {
                select: jest.fn().mockReturnThis(),
                where: jest.fn((criteria) => {
                    call.id = criteria.id;
                    return query;
                }),
                whereNull: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                modify(callback) {
                    callback?.(this);
                    return this;
                },
                first: jest.fn(async () => (missingIds.includes(call.id) ? null : { id: call.id })),
            };
            return query;
        },
    };
};

const instantiateController = ({ body, permissions, missingIds = [] } = {}) => {
    const controller = new Controller(createApiEvent({ body }), knexConfig);
    controller.user = createAuthenticatedUser({
        permissions: permissions ?? {
            administrador: [permission('administrador', 'comments', 'CommentsCreate')],
        },
    });
    controller.started_at = new Date('2026-07-29T12:00:00.000Z');
    controller.repository = createRepositoryStub({ missingIds });
    return controller;
};

describe('CommentsBatchController', () => {
    it('returns 403 when the user lacks administrador.comments.CommentsCreate', async () => {
        const controller = instantiateController({
            body: [item()],
            permissions: { administrador: [] },
        });

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(403);
        expect(controller.repository.startTransaction).not.toHaveBeenCalled();
        expect(controller.repository.tableCalls).toHaveLength(0);
    });

    it('checks each distinct caso_id only once instead of once per item', async () => {
        const controller = instantiateController({
            body: [item(), item(), item(), item({ caso_id: OTHER_CASE_ID })],
        });

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(201);
        expect(response.data.ids).toHaveLength(4);

        // 4 items, 2 distinct cases -> 2 SELECTs, not 4.
        const caseLookups = controller.repository.tableCalls.filter((call) => call.table === 'cases');
        expect(caseLookups).toHaveLength(2);
        expect(caseLookups.map((call) => call.id)).toEqual([CASE_ID, OTHER_CASE_ID]);
    });

    it('generates a distinct server-side id per item and saves them all in one transaction', async () => {
        const controller = instantiateController({ body: [item(), item(), item()] });

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(201);
        expect(new Set(response.data.ids).size).toBe(3);
        expect(controller.repository.startTransaction).toHaveBeenCalledTimes(1);
        expect(controller.repository.save).toHaveBeenCalledTimes(3);
        expect(controller.repository.saveHistory).toHaveBeenCalledTimes(3);
        expect(controller.repository.transaction.commit).toHaveBeenCalledTimes(1);
    });

    it('ignores a client-supplied id and never trusts it as the comment id', async () => {
        const forgedId = '99999999-9999-4999-8999-999999999999';
        const controller = instantiateController({ body: [item({ id: forgedId })] });

        const response = await controller.actionCreate();

        // `id` is not part of the schema, so the request is rejected outright.
        expect(response.statusCode).toBe(400);
        expect(controller.repository.startTransaction).not.toHaveBeenCalled();
    });

    it('returns 404 and opens no transaction when an item references a missing case', async () => {
        const controller = instantiateController({
            body: [item(), item({ caso_id: MISSING_CASE_ID })],
            missingIds: [MISSING_CASE_ID],
        });

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(404);
        expect(controller.repository.startTransaction).not.toHaveBeenCalled();
        expect(controller.repository.save).not.toHaveBeenCalled();
    });

    it('returns 400 when the batch exceeds the 500 item limit', async () => {
        const controller = instantiateController({
            body: Array.from({ length: 501 }, () => item()),
        });

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(400);
        expect(controller.repository.tableCalls).toHaveLength(0);
    });

    it('returns 400 when the batch is empty', async () => {
        const controller = instantiateController({ body: [] });

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(400);
        expect(controller.repository.startTransaction).not.toHaveBeenCalled();
    });
});
