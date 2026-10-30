import { jest } from '@jest/globals';
import { ChannelHubWorkspacePriorityReorderProcessor } from '../../src/channel-hub-workspace-priorities/application/process/ChannelHubWorkspacePriorityReorderProcessor.js';
import { CustomError } from '../../src/shared/errors/CustomError.js';

const OPERATION_ID = '11111111-1111-4111-8111-111111111111';
const ACCOUNT_ID = '22222222-2222-4222-8222-222222222222';
const OWNER_ID = '33333333-3333-4333-8333-333333333333';

class InMemoryOperationRepository {
    constructor(status = 'pending', attemptCount = 0) {
        this.operation = {
            operationId: OPERATION_ID,
            accountId: ACCOUNT_ID,
            revision: 'revision-1',
            orderedWorkspaceIds: ['workspace-sales', 'workspace-support'],
            status,
            attemptCount,
            result: null,
            error: null,
            validatedAt: status === 'in_progress' ? new Date() : null,
        };
    }

    findById = jest.fn(async () => ({ ...this.operation }));

    claim = jest.fn(async () => {
        this.operation.status = 'in_progress';
        this.operation.attemptCount += 1;
        this.operation.leaseOwnerId = OWNER_ID;
        return { ...this.operation };
    });

    heartbeat = jest.fn(async () => {
        return { ...this.operation };
    });

    markValidated = jest.fn(async () => {
        this.operation.validatedAt = new Date();
        return { ...this.operation };
    });

    markCompleted = jest.fn(async (_id, result, { ownerId } = {}) => {
        if (ownerId !== this.operation.leaseOwnerId) return null;
        this.operation.status = 'completed';
        this.operation.result = result;
        return { ...this.operation };
    });

    markFailed = jest.fn(async (_id, error, { incrementAttempt = false, ownerId = null } = {}) => {
        if (ownerId && ownerId !== this.operation.leaseOwnerId) return null;
        if (incrementAttempt) this.operation.attemptCount += 1;
        this.operation.status = 'failed';
        this.operation.error = { message: error.message };
        return { ...this.operation };
    });
}

const createSubject = ({
    status = 'pending',
    attemptCount = 0,
    maxAttempts = 3,
    maxDurationMs = 600_000,
    hasTimeForRemoteCall = () => true,
} = {}) => {
    const operationRepository = new InMemoryOperationRepository(status, attemptCount);
    const validatedSnapshot = { marker: 'validated' };
    const priorityManager = {
        validateReorderRequestWithSnapshot: jest.fn().mockResolvedValue(validatedSnapshot),
        reconcileNext: jest.fn(),
    };
    return {
        subject: new ChannelHubWorkspacePriorityReorderProcessor({
            priorityManager,
            operationRepository,
            maxAttempts,
            maxDurationMs,
            ownerIdFactory: () => OWNER_ID,
            hasTimeForRemoteCall,
        }),
        operationRepository,
        priorityManager,
        validatedSnapshot,
    };
};

describe('ChannelHubWorkspacePriorityReorderProcessor', () => {
    it('fails a pending first attempt when its revision became stale, without starting remote writes', async () => {
        const { subject, operationRepository, priorityManager } = createSubject();
        priorityManager.validateReorderRequestWithSnapshot.mockRejectedValue(
            new CustomError('Workspace priority order has changed; reload it before updating', 409)
        );

        const result = await subject.execute(OPERATION_ID);

        expect(result).toMatchObject({ status: 'failed', attemptCount: 1 });
        expect(operationRepository.claim).toHaveBeenCalled();
        expect(priorityManager.reconcileNext).not.toHaveBeenCalled();
    });

    it('retries a transient pending revision check and fails it when the attempt budget is exhausted', async () => {
        const { subject, operationRepository, priorityManager } = createSubject({ maxAttempts: 2 });
        const upstreamError = Object.assign(new Error('Channel Hub unavailable'), { upstreamStatus: 502 });
        priorityManager.validateReorderRequestWithSnapshot.mockRejectedValue(upstreamError);

        await expect(subject.execute(OPERATION_ID)).rejects.toBe(upstreamError);
        expect(operationRepository.operation).toMatchObject({ status: 'in_progress', attemptCount: 1 });

        const result = await subject.execute(OPERATION_ID);
        expect(result).toMatchObject({ status: 'failed', attemptCount: 2 });
        expect(operationRepository.claim).toHaveBeenCalledTimes(2);
    });

    it('completes a pending operation after the first verified reconciliation', async () => {
        const { subject, operationRepository, priorityManager } = createSubject();
        const verified = { revision: 'revision-2', items: [], canReorder: true, conflicts: [] };
        priorityManager.reconcileNext.mockResolvedValue({ completed: true, moved: null, result: verified });

        const result = await subject.execute(OPERATION_ID);

        expect(priorityManager.validateReorderRequestWithSnapshot).toHaveBeenCalledWith(ACCOUNT_ID, {
            revision: 'revision-1',
            orderedWorkspaceIds: ['workspace-sales', 'workspace-support'],
        });
        expect(operationRepository.claim).toHaveBeenCalledWith(
            OPERATION_ID,
            expect.objectContaining({ ownerId: OWNER_ID })
        );
        expect(operationRepository.markCompleted).toHaveBeenCalledWith(OPERATION_ID, verified, {
            ownerId: OWNER_ID,
        });
        expect(result).toMatchObject({ status: 'completed', attemptCount: 1, result: verified });
    });

    it('resumes an in-progress operation from live state without applying the original revision gate', async () => {
        const { subject, operationRepository, priorityManager } = createSubject({
            status: 'in_progress',
            attemptCount: 1,
        });
        priorityManager.reconcileNext
            .mockResolvedValueOnce({ completed: false, moved: { workspaceId: 'workspace-sales', priority: 1 } })
            .mockResolvedValueOnce({
                completed: true,
                moved: null,
                result: { revision: 'revision-final', items: [] },
            });

        const result = await subject.execute(OPERATION_ID);

        expect(priorityManager.validateReorderRequestWithSnapshot).not.toHaveBeenCalled();
        expect(operationRepository.claim).toHaveBeenCalledWith(
            OPERATION_ID,
            expect.objectContaining({ ownerId: OWNER_ID })
        );
        expect(priorityManager.reconcileNext).toHaveBeenCalledTimes(2);
        expect(result).toMatchObject({ status: 'completed', attemptCount: 2 });
    });

    it('throws transient upstream failures for retry, then marks failed at maxAttempts', async () => {
        const { subject, operationRepository, priorityManager } = createSubject({
            status: 'in_progress',
            attemptCount: 1,
            maxAttempts: 3,
        });
        const upstreamError = Object.assign(new Error('Channel Hub unavailable'), { upstreamStatus: 502 });
        priorityManager.reconcileNext.mockRejectedValue(upstreamError);

        await expect(subject.execute(OPERATION_ID)).rejects.toBe(upstreamError);
        expect(operationRepository.operation).toMatchObject({ status: 'in_progress', attemptCount: 2 });

        const result = await subject.execute(OPERATION_ID);
        expect(result).toMatchObject({ status: 'failed', attemptCount: 3 });
        expect(operationRepository.markFailed).toHaveBeenCalledWith(OPERATION_ID, upstreamError, {
            ownerId: OWNER_ID,
        });
    });

    it('leaves a timed-out operation resumable and throws for queue retry', async () => {
        const { subject, operationRepository, priorityManager } = createSubject({ maxDurationMs: 0 });

        await expect(subject.execute(OPERATION_ID)).rejects.toMatchObject({ statusCode: 502 });
        expect(operationRepository.operation).toMatchObject({ status: 'in_progress', attemptCount: 1 });
        expect(priorityManager.reconcileNext).not.toHaveBeenCalled();
    });

    it('marks configuration invariants terminal instead of retrying them', async () => {
        const { subject, priorityManager } = createSubject();
        priorityManager.reconcileNext.mockRejectedValue(
            new CustomError('orderedWorkspaceIds must contain every workspace exactly once', 409)
        );

        const result = await subject.execute(OPERATION_ID);

        expect(result).toMatchObject({ status: 'failed', attemptCount: 1 });
    });

    it('does not start reconciliation when another live owner holds the lease', async () => {
        const { subject, operationRepository, priorityManager } = createSubject({ status: 'in_progress' });
        operationRepository.claim.mockResolvedValue(null);

        await expect(subject.execute(OPERATION_ID)).rejects.toMatchObject({ statusCode: 502 });

        expect(operationRepository.heartbeat).not.toHaveBeenCalled();
        expect(priorityManager.reconcileNext).not.toHaveBeenCalled();
    });

    it('heartbeats ownership before each remote reconciliation and carries forward its refreshed snapshot', async () => {
        const { subject, operationRepository, priorityManager } = createSubject();
        const refreshedSnapshot = { marker: 'refreshed' };
        priorityManager.reconcileNext
            .mockResolvedValueOnce({
                completed: false,
                result: { revision: 'revision-2' },
                snapshot: refreshedSnapshot,
            })
            .mockResolvedValueOnce({
                completed: true,
                result: { revision: 'revision-final', items: [] },
                snapshot: { marker: 'final' },
            });

        await subject.execute(OPERATION_ID);

        expect(operationRepository.heartbeat).toHaveBeenCalledTimes(2);
        expect(priorityManager.reconcileNext).toHaveBeenNthCalledWith(
            2,
            ACCOUNT_ID,
            ['workspace-sales', 'workspace-support'],
            { snapshot: refreshedSnapshot }
        );
    });

    it('reuses the validated live snapshot for the first reconciliation', async () => {
        const { subject, priorityManager, validatedSnapshot } = createSubject();
        priorityManager.reconcileNext.mockResolvedValue({
            completed: true,
            result: { revision: 'revision-final', items: [] },
            snapshot: validatedSnapshot,
        });

        await subject.execute(OPERATION_ID);

        expect(priorityManager.reconcileNext).toHaveBeenCalledWith(
            ACCOUNT_ID,
            ['workspace-sales', 'workspace-support'],
            { snapshot: validatedSnapshot }
        );
    });

    it('stops before a remote reconciliation when the Lambda cleanup buffer is reached', async () => {
        const { subject, priorityManager } = createSubject({ hasTimeForRemoteCall: () => false });

        await expect(subject.execute(OPERATION_ID)).rejects.toMatchObject({ statusCode: 502 });
        expect(priorityManager.reconcileNext).not.toHaveBeenCalled();
    });
});
