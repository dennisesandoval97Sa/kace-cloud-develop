import { jest } from '@jest/globals';
import { ChannelHubWorkspacePriorityReorderOutboxPublisher } from '../../src/channel-hub-workspace-priorities/application/publish/ChannelHubWorkspacePriorityReorderOutboxPublisher.js';

const OPERATION_ID = '11111111-1111-4111-8111-111111111111';
const EVENT_ID = '22222222-2222-4222-8222-222222222222';
const OWNER_ID = '33333333-3333-4333-8333-333333333333';
const EVENT = {
    eventId: EVENT_ID,
    eventName: 'kace.core.channel_hub_workspace_priority_reorder.requested',
    aggregateId: '44444444-4444-4444-8444-444444444444',
    occurredOn: '2026-08-25T12:00:00.000Z',
    payload: { operationId: OPERATION_ID },
    metadata: { tenant_id: 'tenant-a', user_id: null, correlation_id: null, causation_id: null },
};

const createSubject = () => {
    const operationRepository = {
        claimPendingPublications: jest.fn().mockResolvedValue([
            {
                operationId: OPERATION_ID,
                eventId: EVENT_ID,
                event: EVENT,
                publishAttemptCount: 1,
            },
        ]),
        markPublicationPublished: jest.fn().mockResolvedValue({ publishedAt: new Date() }),
        releasePublicationClaim: jest.fn().mockResolvedValue({}),
    };
    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    return {
        subject: new ChannelHubWorkspacePriorityReorderOutboxPublisher({
            operationRepository,
            eventBus,
            ownerIdFactory: () => OWNER_ID,
            now: () => new Date('2026-08-25T12:01:00.000Z'),
        }),
        operationRepository,
        eventBus,
    };
};

describe('ChannelHubWorkspacePriorityReorderOutboxPublisher', () => {
    it('claims and publishes a staged event with its original event id', async () => {
        const { subject, operationRepository, eventBus } = createSubject();

        const result = await subject.publishDue();

        expect(eventBus.publish).toHaveBeenCalledWith(
            expect.objectContaining({ eventId: EVENT_ID, aggregateId: EVENT.aggregateId })
        );
        expect(eventBus.publish.mock.calls[0][0].toJson()).toEqual(EVENT);
        expect(operationRepository.markPublicationPublished).toHaveBeenCalledWith(OPERATION_ID, {
            eventId: EVENT_ID,
            ownerId: OWNER_ID,
            now: new Date('2026-08-25T12:01:00.000Z'),
        });
        expect(result).toEqual({ claimed: 1, published: 1, failed: 0 });
    });

    it('releases a failed publication claim with exponential retry backoff and continues the scan', async () => {
        const { subject, operationRepository, eventBus } = createSubject();
        operationRepository.claimPendingPublications.mockResolvedValue([
            {
                operationId: OPERATION_ID,
                eventId: EVENT_ID,
                event: EVENT,
                publishAttemptCount: 3,
            },
            {
                operationId: '55555555-5555-4555-8555-555555555555',
                eventId: '66666666-6666-4666-8666-666666666666',
                event: {
                    ...EVENT,
                    eventId: '66666666-6666-4666-8666-666666666666',
                    payload: { operationId: '55555555-5555-4555-8555-555555555555' },
                },
                publishAttemptCount: 1,
            },
        ]);
        eventBus.publish.mockRejectedValueOnce(new Error('SQS unavailable')).mockResolvedValueOnce(undefined);

        const result = await subject.publishDue();

        expect(operationRepository.releasePublicationClaim).toHaveBeenCalledWith(OPERATION_ID, {
            ownerId: OWNER_ID,
            nextAttemptAt: new Date('2026-08-25T12:01:04.000Z'),
        });
        expect(result).toEqual({ claimed: 2, published: 1, failed: 1 });
    });
});
