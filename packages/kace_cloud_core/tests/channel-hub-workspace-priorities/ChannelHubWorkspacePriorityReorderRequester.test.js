import { jest } from '@jest/globals';
import { ChannelHubWorkspacePriorityReorderRequester } from '../../src/channel-hub-workspace-priorities/application/request/ChannelHubWorkspacePriorityReorderRequester.js';
import { ChannelHubWorkspacePriorityReorderRequested } from '../../src/channel-hub-workspace-priorities/domain/events/ChannelHubWorkspacePriorityReorderRequested.js';
import { CustomError } from '../../src/shared/errors/CustomError.js';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const request = {
    revision: 'revision-1',
    orderedWorkspaceIds: ['workspace-sales', 'workspace-support'],
    requestedBy: USER_ID,
    metadata: { tenant_id: 'tenant-a', user_id: USER_ID },
};

const createSubject = () => {
    const priorityManager = { validateReorderRequest: jest.fn().mockResolvedValue({}) };
    const operationRepository = {
        findActiveByAccountId: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        markFailed: jest.fn().mockResolvedValue({ status: 'failed' }),
    };
    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    const outboxPublisher = { publishOperation: jest.fn().mockResolvedValue({ claimed: 1, published: 1, failed: 0 }) };
    return {
        subject: new ChannelHubWorkspacePriorityReorderRequester({
            priorityManager,
            operationRepository,
            eventBus,
            outboxPublisher,
        }),
        priorityManager,
        operationRepository,
        eventBus,
        outboxPublisher,
    };
};

describe('ChannelHubWorkspacePriorityReorderRequester', () => {
    it('reserves the account, validates the request, and publishes an account-grouped event', async () => {
        const { subject, priorityManager, operationRepository, outboxPublisher } = createSubject();

        const receipt = await subject.execute(ACCOUNT_ID, request);

        expect(priorityManager.validateReorderRequest).toHaveBeenCalledWith(ACCOUNT_ID, {
            revision: request.revision,
            orderedWorkspaceIds: request.orderedWorkspaceIds,
        });
        expect(operationRepository.create).toHaveBeenCalledWith({
            operationId: receipt.operationId,
            accountId: ACCOUNT_ID,
            revision: request.revision,
            orderedWorkspaceIds: request.orderedWorkspaceIds,
            requestedBy: USER_ID,
            event: expect.any(ChannelHubWorkspacePriorityReorderRequested),
        });
        expect(operationRepository.create.mock.invocationCallOrder[0]).toBeLessThan(
            priorityManager.validateReorderRequest.mock.invocationCallOrder[0]
        );
        const event = operationRepository.create.mock.calls[0][0].event;
        expect(event).toBeInstanceOf(ChannelHubWorkspacePriorityReorderRequested);
        expect(event.eventName).toBe('kace.core.channel_hub_workspace_priority_reorder.requested');
        expect(event.aggregateId).toBe(ACCOUNT_ID);
        expect(event.payload).toEqual({ operationId: receipt.operationId });
        expect(outboxPublisher.publishOperation).toHaveBeenCalledWith(receipt.operationId);
        expect(receipt).toEqual({ operationId: expect.any(String), status: 'pending' });
    });

    it('surfaces the repository 409 when another operation already owns the account lock', async () => {
        const { subject, priorityManager, operationRepository, eventBus } = createSubject();
        operationRepository.create.mockRejectedValue(
            new CustomError('A workspace priority reorder is already active for this account', 409)
        );

        await expect(subject.execute(ACCOUNT_ID, request)).rejects.toMatchObject({ statusCode: 409 });
        expect(priorityManager.validateReorderRequest).not.toHaveBeenCalled();
        expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('returns the active operation receipt before validating against changing live priorities', async () => {
        const { subject, priorityManager, operationRepository, eventBus } = createSubject();
        operationRepository.findActiveByAccountId.mockResolvedValue({
            operationId: '33333333-3333-4333-8333-333333333333',
            status: 'in_progress',
        });

        await expect(subject.execute(ACCOUNT_ID, request)).rejects.toMatchObject({
            statusCode: 409,
            activeOperation: {
                operationId: '33333333-3333-4333-8333-333333333333',
                status: 'in_progress',
            },
        });
        expect(priorityManager.validateReorderRequest).not.toHaveBeenCalled();
        expect(operationRepository.create).not.toHaveBeenCalled();
        expect(eventBus.publish).not.toHaveBeenCalled();
        expect.assertions(4);
    });

    it('marks the reservation failed and does not publish when live validation rejects the request', async () => {
        const { subject, priorityManager, operationRepository, eventBus } = createSubject();
        const validationError = new CustomError('Workspace priority order has changed', 409);
        priorityManager.validateReorderRequest.mockRejectedValue(validationError);

        await expect(subject.execute(ACCOUNT_ID, request)).rejects.toBe(validationError);

        const operationId = operationRepository.create.mock.calls[0][0].operationId;
        expect(operationRepository.markFailed).toHaveBeenCalledWith(operationId, validationError);
        expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('keeps the durable receipt pending when immediate publication fails for autonomous retry', async () => {
        const { subject, operationRepository, outboxPublisher } = createSubject();
        const publishError = new Error(
            'User arn:aws:sts::714281575970:assumed-role/channel-hub is not authorized to call sqs:SendMessage'
        );
        outboxPublisher.publishOperation.mockResolvedValue({ claimed: 1, published: 0, failed: 1 });

        await expect(subject.execute(ACCOUNT_ID, request)).resolves.toEqual({
            operationId: expect.any(String),
            status: 'pending',
        });
        expect(operationRepository.markFailed).not.toHaveBeenCalled();
        expect(JSON.stringify(operationRepository.create.mock.calls)).not.toContain(publishError.message);
    });
});
