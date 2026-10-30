import { describe, expect, it } from '@jest/globals';
import {
    WorkspacePriorityApplication,
    WorkspacePriorityConflictError,
    workspacePriorityOperationResponse,
} from '../src/WorkspacePriorityApplication.mjs';

const ACCOUNT_ID = '22222222-2222-4222-8222-222222222222';
const OPERATION_ID = '66666666-6666-4666-8666-666666666666';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const TENANT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

class PriorityManagerFake {
    requests = [];
    priorities = { items: [], revision: 'revision-1', canReorder: false, conflicts: [] };

    async get(accountId) {
        this.requests.push(accountId);
        return this.priorities;
    }
}

class ReorderRequesterFake {
    requests = [];
    receipt = { operationId: OPERATION_ID, status: 'pending' };
    failure = null;

    async execute(accountId, command) {
        this.requests.push({ accountId, command });
        if (this.failure) throw this.failure;
        return this.receipt;
    }
}

class OperationRepositoryFake {
    operations = new Map();
    destroyCalls = 0;

    async findById(operationId) {
        return this.operations.get(operationId) ?? null;
    }

    async destroyConnection() {
        this.destroyCalls += 1;
    }
}

const createApplication = (reorderConflictType) => {
    const priorityManager = new PriorityManagerFake();
    const reorderRequester = new ReorderRequesterFake();
    const operationRepository = new OperationRepositoryFake();
    return {
        application: new WorkspacePriorityApplication({
            priorityManager,
            reorderRequester,
            operationRepository,
            reorderConflictType,
        }),
        priorityManager,
        reorderRequester,
        operationRepository,
    };
};

describe('WorkspacePriorityApplication', () => {
    it('lists the live workspace processing order for the requested account', async () => {
        const { application, priorityManager } = createApplication();

        await expect(application.list(ACCOUNT_ID)).resolves.toEqual(priorityManager.priorities);
        expect(priorityManager.requests).toEqual([ACCOUNT_ID]);
    });

    it('adds the authenticated actor to a durable reorder request and returns its receipt', async () => {
        const { application, reorderRequester } = createApplication();
        const command = {
            revision: 'revision-1',
            orderedWorkspaceIds: ['55555555-5555-4555-8555-555555555555'],
        };

        await expect(
            application.requestReorder(ACCOUNT_ID, command, { tenantId: TENANT_ID, userId: USER_ID })
        ).resolves.toEqual({ operationId: OPERATION_ID, status: 'pending' });
        expect(reorderRequester.requests).toEqual([
            {
                accountId: ACCOUNT_ID,
                command: {
                    ...command,
                    requestedBy: USER_ID,
                    metadata: { tenant_id: TENANT_ID, user_id: USER_ID },
                },
            },
        ]);
    });

    it('maps only the configured domain conflict type to the public receipt boundary', async () => {
        class DomainReorderConflict extends Error {}
        const { application, reorderRequester } = createApplication(DomainReorderConflict);
        reorderRequester.failure = Object.assign(new DomainReorderConflict('Already active'), {
            statusCode: 409,
            activeOperation: { operationId: OPERATION_ID, status: 'pending' },
        });

        await expect(
            application.requestReorder(
                ACCOUNT_ID,
                { revision: 'revision-1', orderedWorkspaceIds: [] },
                { tenantId: TENANT_ID, userId: USER_ID }
            )
        ).rejects.toMatchObject({
            constructor: WorkspacePriorityConflictError,
            statusCode: 409,
            activeOperation: { operationId: OPERATION_ID, status: 'pending' },
        });
    });

    it('returns a sanitized operation only when it belongs to the requested account', async () => {
        const { application, operationRepository } = createApplication();
        operationRepository.operations.set(OPERATION_ID, {
            operationId: OPERATION_ID,
            accountId: ACCOUNT_ID,
            status: 'failed',
            result: null,
            error: { code: '0x060004', message: 'private upstream response' },
            errorMessage: 'private upstream response',
        });

        await expect(application.findOperation(ACCOUNT_ID, OPERATION_ID)).resolves.toEqual({
            operationId: OPERATION_ID,
            status: 'failed',
            result: null,
            errorCode: '0x060004',
        });
        await expect(application.findOperation('another-account', OPERATION_ID)).resolves.toBeNull();
    });

    it('serializes repository results without decoding alternate runtime representations', () => {
        expect(
            workspacePriorityOperationResponse({
                operationId: OPERATION_ID,
                status: 'completed',
                result: { revision: 'revision-2' },
                errorCode: null,
            })
        ).toEqual({
            operationId: OPERATION_ID,
            status: 'completed',
            result: { revision: 'revision-2' },
            errorCode: null,
        });
    });

    it('releases the independently configured operation repository pool', async () => {
        const { application, operationRepository } = createApplication();

        await application.destroy();

        expect(operationRepository.destroyCalls).toBe(1);
    });

    it('normalizes well-formed stored error codes and rejects malformed values', () => {
        expect(
            workspacePriorityOperationResponse({
                operationId: OPERATION_ID,
                status: 'failed',
                errorCode: ' 0x060004 ',
            }).errorCode
        ).toBe('0x060004');

        for (const errorCode of ['0x06000A', '0X060004', '0x06004', '060004', '', null, 60004]) {
            expect(
                workspacePriorityOperationResponse({
                    operationId: OPERATION_ID,
                    status: 'failed',
                    errorCode,
                }).errorCode
            ).toBeNull();
        }
    });
});
