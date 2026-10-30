import { jest } from '@jest/globals';
import { HttpResponse, Response } from '@kace/api-common';
import {
    CASE_BULK_ASSIGNMENT_PARTIAL,
    CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE,
    CASE_ASSIGNMENT_GROUP_UNAVAILABLE,
    CASE_ASSIGNMENT_USER_UNAVAILABLE,
    CASE_ASSIGNMENT_USER_GROUP_UNAVAILABLE,
} from '@kace/error-codes';
import { CustomError } from '@kace/core/src/shared/index.js';

class MockBaseController {
    constructor(event, knexConfig) {
        this.event = event;
        this.knexConfig = knexConfig;
        this.user = {
            hasPermission: jest.fn().mockReturnValue(true),
        };
    }

    payload() {
        return typeof this.event.body === 'string' ? JSON.parse(this.event.body || '{}') : this.event.body;
    }
}

jest.unstable_mockModule('@kace/api-common', () => ({
    HttpResponse,
    Response,
    BaseController: MockBaseController,
}));

const mockCaseBulkAssignerExecute = jest.fn();
jest.unstable_mockModule('@kace/core/src/cases/index.js', () => ({
    CaseBulkAssigner: jest.fn().mockImplementation(() => ({
        execute: mockCaseBulkAssignerExecute,
    })),
    KnexCaseRepository: jest.fn(),
}));

jest.unstable_mockModule('@kace/core/src/users/index.js', () => ({
    KnexUsersRepository: jest.fn(),
}));

jest.unstable_mockModule('@kace/core/src/grupos/index.js', () => ({
    KnexGroupsRepository: jest.fn(),
}));

jest.unstable_mockModule('@kace/core/src/user-group-relationships/index.js', () => ({
    KnexUserGroupRelationshipRepository: jest.fn(),
}));

jest.unstable_mockModule('@kace/core/src/global-config/index.js', () => ({
    KnexGlobalConfigurationRepository: jest.fn(),
}));

jest.unstable_mockModule('@kace/core/src/shared/assignation/AssignationService.js', () => ({
    AssignationService: jest.fn(),
}));

const { BulkAssignController } = await import('../src/BulkAssignController.mjs');

describe('BulkAssignController', () => {
    const validGroupId = '00000000-0000-4000-8000-000000000001';
    const caseId1 = '00000000-0000-4000-8000-000000000002';
    const caseId2 = '00000000-0000-4000-8000-000000000003';
    const mockKnexConfig = { client: 'sqlite3' };

    function createMockEvent(payload) {
        return {
            body: JSON.stringify(payload),
        };
    }

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns 403 when user lacks permission', async () => {
        const event = createMockEvent({ case_ids: [caseId1], group_id: validGroupId });
        const controller = new BulkAssignController(event, mockKnexConfig);
        controller.user.hasPermission.mockReturnValue(false);

        const result = await controller.actionCreate();
        const json = result.toJson();

        expect(json.statusCode).toBe(403);
    });

    it('returns 400 when payload validation fails (empty case_ids)', async () => {
        const event = createMockEvent({ case_ids: [], group_id: validGroupId });
        const controller = new BulkAssignController(event, mockKnexConfig);

        const result = await controller.actionCreate();
        const json = result.toJson();

        expect(json.statusCode).toBe(400);
    });

    it('returns 200 with code undefined and counts on total success', async () => {
        const event = createMockEvent({ case_ids: [caseId1, caseId2], group_id: validGroupId });
        const controller = new BulkAssignController(event, mockKnexConfig);

        mockCaseBulkAssignerExecute.mockResolvedValue({
            assigned: [caseId1, caseId2],
            skipped: [],
        });

        const result = await controller.actionCreate();
        const json = result.toJson();

        expect(json.statusCode).toBe(200);
        const body = JSON.parse(json.body);
        expect(body.data?.code).toBeUndefined();
        expect(body.metadata?.assignedCount).toBe(2);
        expect(body.metadata?.skippedCount).toBe(0);
        expect(body.metadata?.skippedIds).toEqual([]);
        expect(body.metadata?.skippedReferences).toEqual([]);
    });

    it('returns 200 with CASE_BULK_ASSIGNMENT_PARTIAL and populated skipped arrays on partial success', async () => {
        const event = createMockEvent({ case_ids: [caseId1, caseId2], group_id: validGroupId });
        const controller = new BulkAssignController(event, mockKnexConfig);

        mockCaseBulkAssignerExecute.mockResolvedValue({
            assigned: [caseId1],
            skipped: [{ caseId: caseId2, reference: 1002, reason: 'no_responsible_available' }],
        });

        const result = await controller.actionCreate();
        const json = result.toJson();

        expect(json.statusCode).toBe(200);
        const body = JSON.parse(json.body);
        expect(body.data?.code).toBe(CASE_BULK_ASSIGNMENT_PARTIAL);
        expect(body.metadata?.assignedCount).toBe(1);
        expect(body.metadata?.skippedCount).toBe(1);
        expect(body.metadata?.skippedIds).toEqual([caseId2]);
        expect(body.metadata?.skippedReferences).toEqual([1002]);
    });

    it('returns 200 with CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE when all cases are skipped (total failure)', async () => {
        const event = createMockEvent({ case_ids: [caseId1, caseId2], group_id: validGroupId });
        const controller = new BulkAssignController(event, mockKnexConfig);

        mockCaseBulkAssignerExecute.mockResolvedValue({
            assigned: [],
            skipped: [
                { caseId: caseId1, reference: 1001, reason: 'no_responsible_available' },
                { caseId: caseId2, reference: 1002, reason: 'no_responsible_available' },
            ],
        });

        const result = await controller.actionCreate();
        const json = result.toJson();

        expect(json.statusCode).toBe(200);
        const body = JSON.parse(json.body);
        expect(body.data?.code).toBe(CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE);
        expect(body.metadata?.assignedCount).toBe(0);
        expect(body.metadata?.skippedCount).toBe(2);
        expect(body.metadata?.skippedIds).toEqual([caseId1, caseId2]);
        expect(body.metadata?.skippedReferences).toEqual([1001, 1002]);
    });

    it('returns 200 with metadata null and code undefined on legacy path (explicit responsible_id)', async () => {
        const responsibleId = '00000000-0000-4000-8000-000000000009';
        const event = createMockEvent({
            case_ids: [caseId1],
            group_id: validGroupId,
            responsible_id: responsibleId,
        });
        const controller = new BulkAssignController(event, mockKnexConfig);

        mockCaseBulkAssignerExecute.mockResolvedValue(null);

        const result = await controller.actionCreate();
        const json = result.toJson();

        expect(json.statusCode).toBe(200);
        const body = JSON.parse(json.body);
        expect(body.metadata?.assignedCount).toBeUndefined();
        expect(body.metadata?.skippedCount).toBeUndefined();
        expect(body.data?.code).toBeUndefined();
    });

    it('returns 404 with canonical publicErrorCode when CustomError 404 is thrown', async () => {
        const event = createMockEvent({ case_ids: [caseId1], group_id: validGroupId });
        const controller = new BulkAssignController(event, mockKnexConfig);

        mockCaseBulkAssignerExecute.mockRejectedValue(
            new CustomError('Case not found', 404, [], CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE)
        );

        const result = await controller.actionCreate();
        const json = result.toJson();

        expect(json.statusCode).toBe(404);
        const body = JSON.parse(json.body);
        expect(body.data?.code).toBe(CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE);
    });

    it('returns 400 with canonical publicErrorCode when CustomError 400 is thrown', async () => {
        const event = createMockEvent({ case_ids: [caseId1], group_id: validGroupId });
        const controller = new BulkAssignController(event, mockKnexConfig);

        mockCaseBulkAssignerExecute.mockRejectedValue(
            new CustomError('Cannot assign closed case', 400, [], '0x030006')
        );

        const result = await controller.actionCreate();
        const json = result.toJson();

        expect(json.statusCode).toBe(400);
        const body = JSON.parse(json.body);
        expect(body.data?.code).toBe('0x030006');
    });

    describe('BulkAssignController error propagation (422)', () => {
        const validPayload = {
            case_ids: ['d3b07384-d113-4903-a24a-7140e6c6027a'],
            group_id: '123e4567-e89b-12d3-a456-426614174000',
            responsible_id: '223e4567-e89b-12d3-a456-426614174001',
        };

        it('propagates publicErrorCode 0x030068 (CASE_ASSIGNMENT_GROUP_UNAVAILABLE) and status 422 when group is unavailable', async () => {
            mockCaseBulkAssignerExecute.mockRejectedValueOnce(
                new CustomError(
                    'The group you are trying to assign does not exist or is unavailable.',
                    422,
                    ['groupId'],
                    CASE_ASSIGNMENT_GROUP_UNAVAILABLE
                )
            );

            const event = createMockEvent(validPayload);
            const controller = new BulkAssignController(event, mockKnexConfig);
            const response = await controller.actionCreate();
            const json = response.toJson();

            expect(json.statusCode).toBe(422);
            const body = JSON.parse(json.body);
            expect(body.code ?? body.data?.code).toBe(CASE_ASSIGNMENT_GROUP_UNAVAILABLE);
        });

        it('propagates publicErrorCode 0x030069 (CASE_ASSIGNMENT_USER_UNAVAILABLE) and status 422 when user is unavailable', async () => {
            mockCaseBulkAssignerExecute.mockRejectedValueOnce(
                new CustomError(
                    'The user you are trying to assign does not exist or is unavailable.',
                    422,
                    ['responsibleId'],
                    CASE_ASSIGNMENT_USER_UNAVAILABLE
                )
            );

            const event = createMockEvent(validPayload);
            const controller = new BulkAssignController(event, mockKnexConfig);
            const response = await controller.actionCreate();
            const json = response.toJson();

            expect(json.statusCode).toBe(422);
            const body = JSON.parse(json.body);
            expect(body.code ?? body.data?.code).toBe(CASE_ASSIGNMENT_USER_UNAVAILABLE);
        });

        it('propagates publicErrorCode 0x030070 (CASE_ASSIGNMENT_USER_GROUP_UNAVAILABLE) and status 422 when user-group relationship is invalid', async () => {
            mockCaseBulkAssignerExecute.mockRejectedValueOnce(
                new CustomError(
                    'The user does not belong to the specified group.',
                    422,
                    ['responsibleId'],
                    CASE_ASSIGNMENT_USER_GROUP_UNAVAILABLE
                )
            );

            const event = createMockEvent(validPayload);
            const controller = new BulkAssignController(event, mockKnexConfig);
            const response = await controller.actionCreate();
            const json = response.toJson();

            expect(json.statusCode).toBe(422);
            const body = JSON.parse(json.body);
            expect(body.code ?? body.data?.code).toBe(CASE_ASSIGNMENT_USER_GROUP_UNAVAILABLE);
        });
    });
});
