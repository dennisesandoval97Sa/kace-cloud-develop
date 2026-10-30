import { jest } from '@jest/globals';
import { DomainEvent } from '../../../../src/shared/domain/events/DomainEvent.js';
import { ValueObjectUuid } from '../../../../src/shared/domain/value-object/ValueObjectUuid.js';
import { ProcessActionQueueOnCronJobRequested } from '../../../../src/actions-queue-executions/application/event-handlers/ProcessActionQueueOnCronJobRequested.js';
import { ActionTriggers } from '../../../../src/shared/domain/enum/ActionTriggersEnum.js';

describe('ProcessActionQueueOnCronJobRequested', () => {
    const executionId = ValueObjectUuid.random();
    const actionId = ValueObjectUuid.random();
    const caseId = ValueObjectUuid.random();
    const clientId = ValueObjectUuid.random();

    function createDomainEvent(payloadOverrides = {}) {
        return new DomainEvent({
            eventName: 'kace.core.automated_actions.requested',
            aggregateId: executionId,
            payload: {
                executionId,
                actionId,
                caseId,
                clientId,
                triggerType: ActionTriggers.CRON_JOB.value,
                ...payloadOverrides,
            },
            metadata: {
                tenant_id: 'tenant-1',
                user_id: 'user-1',
            },
        });
    }

    function createMockExecutor(resolvedValue) {
        return {
            executeByEventPayload: jest.fn().mockResolvedValue(
                resolvedValue || {
                    toJson: () => ({
                        data: { processed: 1, successful: 1, failed: 0 },
                    }),
                }
            ),
        };
    }

    it('should execute action queue with full payload when event is consumed', async () => {
        const mockExecutor = createMockExecutor();
        const handler = new ProcessActionQueueOnCronJobRequested(mockExecutor);

        await handler.handle(createDomainEvent());

        expect(mockExecutor.executeByEventPayload).toHaveBeenCalledTimes(1);
        expect(mockExecutor.executeByEventPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                executionId,
                actionId,
                caseId,
                clientId,
                triggerType: ActionTriggers.CRON_JOB.value,
                created_by: 'user-1',
                created_at: expect.any(String),
            })
        );
    });

    it('should propagate executor errors for retry handling', async () => {
        const mockExecutor = {
            executeByEventPayload: jest.fn().mockRejectedValue(new Error('queue processing failed')),
        };

        const handler = new ProcessActionQueueOnCronJobRequested(mockExecutor);

        await expect(handler.handle(createDomainEvent())).rejects.toThrow('queue processing failed');
    });

    it('should fallback to aggregateId when payload.executionId is not provided', async () => {
        const mockExecutor = createMockExecutor();
        const handler = new ProcessActionQueueOnCronJobRequested(mockExecutor);

        await handler.handle(
            new DomainEvent({
                eventName: 'kace.core.automated_actions.requested',
                aggregateId: executionId,
                payload: {
                    actionId,
                    caseId,
                    triggerType: ActionTriggers.CRON_JOB.value,
                },
                metadata: { tenant_id: 'tenant-1' },
            })
        );

        expect(mockExecutor.executeByEventPayload).toHaveBeenCalledWith(
            expect.objectContaining({
                executionId,
                actionId,
                caseId,
                triggerType: ActionTriggers.CRON_JOB.value,
                created_at: expect.any(String),
                created_by: expect.any(String),
            })
        );
    });

    it('should throw when actionId is missing from payload', async () => {
        const mockExecutor = createMockExecutor();
        const handler = new ProcessActionQueueOnCronJobRequested(mockExecutor);

        await expect(handler.handle(createDomainEvent({ actionId: undefined }))).rejects.toThrow(
            'executionId, actionId and caseId are required'
        );
    });

    it('should throw when caseId is missing from payload', async () => {
        const mockExecutor = createMockExecutor();
        const handler = new ProcessActionQueueOnCronJobRequested(mockExecutor);

        await expect(handler.handle(createDomainEvent({ caseId: undefined }))).rejects.toThrow(
            'executionId, actionId and caseId are required'
        );
    });
});
