import { jest } from '@jest/globals';
import { CustomError, ValidationFailError } from '@kace/core/src/shared/index.js';

const CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE = '0x030005';

import { HttpResponse } from '@kace/api-common/src/http_responses/HttpResponse.js';

const mockConnection = jest.fn();
mockConnection.client = {
    raw: (sql) => sql,
};

class MockBaseController {
    constructor(event, knexConfig) {
        this.event = event;
        this.knexConfig = knexConfig;
        this.database_connection = mockConnection;
        this.user = {
            hasPermission: jest.fn().mockReturnValue(true),
        };
    }

    pathParameters() {
        return this.event.pathParameters || {};
    }

    validateId(id) {
        return Boolean(id);
    }

    payload() {
        return JSON.parse(this.event.body || '{}');
    }
}

jest.unstable_mockModule('@kace/api-common', () => ({
    HttpResponse,
    BaseController: MockBaseController,
}));

const mockCaseGroupAssignerExecute = jest.fn();
jest.unstable_mockModule('@kace/core/src/cases/application/assign/CaseGroupAssigner', () => ({
    CaseGroupAssigner: jest.fn().mockImplementation(() => ({
        execute: mockCaseGroupAssignerExecute,
    })),
}));

const { Controller } = await import('../src/Controller.mjs');

describe('GroupCasesAssignment Controller', () => {
    const validGroupId = '00000000-0000-4000-8000-000000000001';
    const mockKnexConfig = { client: 'sqlite3' };

    function createMockEvent(groupId, payload = { cases: ['00000000-0000-4000-8000-000000000002'] }) {
        return {
            pathParameters: { id: groupId },
            body: JSON.stringify(payload),
        };
    }

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns HttpResponse.notFound with status 404 and code when CustomError is thrown', async () => {
        const event = createMockEvent(validGroupId);
        const controller = new Controller(event, mockKnexConfig);

        const queryBuilder = {
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({ id: validGroupId }),
        };
        mockConnection.mockReturnValue(queryBuilder);
        controller.repository.qualifiedName = jest.fn().mockReturnValue('grupos');

        // Mock CaseGroupAssigner throwing CustomError (e.g. no responsible available)
        mockCaseGroupAssignerExecute.mockRejectedValue(
            new CustomError(
                'Could not assign a person responsible for any of the requested cases',
                404,
                [],
                CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE
            )
        );

        const result = await controller.actionUpdate();
        const json = result.toJson();

        expect(json.statusCode).toBe(404);
        const body = JSON.parse(json.body);
        expect(body.data?.code).toBe(CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE);
    });

    it('returns HttpResponse.validationsFail when ValidationFailError is thrown', async () => {
        const event = createMockEvent(validGroupId);
        const controller = new Controller(event, mockKnexConfig);

        const queryBuilder = {
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({ id: validGroupId }),
        };
        mockConnection.mockReturnValue(queryBuilder);
        controller.repository.qualifiedName = jest.fn().mockReturnValue('grupos');

        mockCaseGroupAssignerExecute.mockRejectedValue(
            new ValidationFailError('Validation error message', 'fieldName')
        );

        const result = await controller.actionUpdate();
        const json = result.toJson();

        expect(json.statusCode).toBe(400);
    });

    it('returns HttpResponse.ok with status 200 and assignedCount when all cases succeed', async () => {
        const caseId1 = '00000000-0000-4000-8000-000000000002';
        const caseId2 = '00000000-0000-4000-8000-000000000003';
        const event = createMockEvent(validGroupId, { cases: [caseId1, caseId2] });
        const controller = new Controller(event, mockKnexConfig);

        const queryBuilder = {
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({ id: validGroupId }),
        };
        mockConnection.mockReturnValue(queryBuilder);
        controller.repository.qualifiedName = jest.fn().mockReturnValue('grupos');

        mockCaseGroupAssignerExecute.mockResolvedValue(undefined);

        const result = await controller.actionUpdate();
        const json = result.toJson();

        expect(json.statusCode).toBe(200);
        const body = JSON.parse(json.body);
        expect(body.metadata?.assignedCount).toBe(2);
        expect(body.metadata?.failedCount).toBe(0);
        expect(body.metadata?.failed).toBeUndefined();
    });

    it('returns HttpResponse.ok with status 200, counts, and sanitized failed entries on partial success', async () => {
        const caseId1 = '00000000-0000-4000-8000-000000000002';
        const caseId2 = '00000000-0000-4000-8000-000000000003';
        const event = createMockEvent(validGroupId, { cases: [caseId1, caseId2] });
        const controller = new Controller(event, mockKnexConfig);

        const queryBuilder = {
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue({ id: validGroupId }),
        };
        mockConnection.mockReturnValue(queryBuilder);
        controller.repository.qualifiedName = jest.fn().mockReturnValue('grupos');

        mockCaseGroupAssignerExecute
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(
                new CustomError(
                    'Sensitive internal message that must never be exposed',
                    404,
                    [],
                    CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE
                )
            );

        const result = await controller.actionUpdate();
        const json = result.toJson();

        expect(json.statusCode).toBe(200);
        const body = JSON.parse(json.body);
        expect(body.metadata?.assignedCount).toBe(1);
        expect(body.metadata?.failedCount).toBe(1);
        expect(body.metadata?.failed).toHaveLength(1);
        expect(body.metadata?.failed[0]).toEqual({
            caseId: caseId2,
            code: CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE,
            reason: 'not_found_or_unavailable',
        });
        expect(body.metadata?.failed[0].message).toBeUndefined();
    });
});
