import { production as knexConfig } from '@kace/database';
import { jest } from '@jest/globals';
import { createApiEvent, createAuthenticatedUser } from '@kace/api-common/tests/helpers/ObjectIdentityFixtures.js';
import { Controller } from '../src/Controller.mjs';

const createRelationshipConnection = (caseId) => () => {
    const query = {
        select: jest.fn(() => query),
        where: jest.fn(() => query),
        modify: jest.fn((callback) => {
            callback({
                whereNull: jest.fn(() => query),
                andWhere: jest.fn(() => query),
            });
            return query;
        }),
        first: jest.fn(async () => ({ id: caseId })),
    };
    return query;
};

describe('CaseSessionDuration object identity authorization', () => {
    it('replaces request-body id and binds case_id through an authorized case relationship', async () => {
        const requestBodyId = '99999999-9999-4999-8999-999999999999';
        const caseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        let savedSession = null;
        const event = createApiEvent({
            body: {
                id: requestBodyId,
                case_id: caseId,
                event_type: 'VIEW',
                created_by: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            },
        });
        const controller = new Controller(event, knexConfig);
        controller.user = createAuthenticatedUser();
        controller.repository = {
            table: createRelationshipConnection(caseId),
            find: jest.fn(async () => null),
            save: jest.fn(async (sessionDuration) => {
                savedSession = sessionDuration;
            }),
        };
        controller.casesRepository = {
            find: jest.fn(async () => ({ id: { value: caseId } })),
        };

        const response = await controller.actionCreate();

        expect(response.statusCode).toBe(201);
        expect(savedSession.id.value).not.toBe(requestBodyId);
        expect(savedSession.case_id.value).toBe(caseId);
        expect(savedSession.created_by.value).toBe(controller.user.id.value);
        expect(controller.casesRepository.find).toHaveBeenCalledTimes(1);
    });
});
