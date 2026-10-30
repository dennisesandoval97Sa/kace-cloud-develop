import { jest } from '@jest/globals';
import { RoutingEventBus } from '../../../../src/shared/infrastructure/events/RoutingEventBus.js';
import { Helper } from '../../../../src/shared/infrastructure/utils/Helper.js';

function makeMockSqsClient() {
    return { send: jest.fn().mockResolvedValue({ MessageId: 'msg-1' }) };
}

function makeMockArchiveBus() {
    return {
        publish: jest.fn().mockResolvedValue(undefined),
        publishBatch: jest.fn().mockResolvedValue({ successful: 0, failed: 0 }),
    };
}

function makeEvent(overrides = {}) {
    return {
        eventId: 'evt-1',
        eventName: 'kace.core.case.created',
        aggregateId: 'agg-1',
        occurredOn: new Date().toISOString(),
        payload: { foo: 'bar' },
        metadata: { tenant_id: 't-1' },
        toJson() {
            return {
                eventId: this.eventId,
                eventName: this.eventName,
                aggregateId: this.aggregateId,
                occurredOn: this.occurredOn,
                payload: this.payload,
                metadata: this.metadata,
            };
        },
        ...overrides,
    };
}

const queueMap = {
    'kace.core.case.created': 'https://sqs.test/cases.fifo',
    'kace.core.case.updated': 'https://sqs.test/cases.fifo',
    'kace.core.action_job.created': 'https://sqs.test/action-jobs.fifo',
};

describe('RoutingEventBus.publish', () => {
    let sqsClient;
    let archiveBus;
    let bus;

    beforeEach(() => {
        sqsClient = makeMockSqsClient();
        archiveBus = makeMockArchiveBus();
        bus = new RoutingEventBus({ sqsClient, archiveBus, queueMap });
        jest.spyOn(Helper, 'logMetric').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('sends event to the SQS queue mapped from eventName', async () => {
        const event = makeEvent({ eventName: 'kace.core.case.created' });
        await bus.publish(event);

        expect(sqsClient.send).toHaveBeenCalledTimes(1);
        const command = sqsClient.send.mock.calls[0][0];
        expect(command.input.QueueUrl).toBe('https://sqs.test/cases.fifo');
    });

    it('uses aggregateId as MessageGroupId', async () => {
        const event = makeEvent({ aggregateId: 'case-123' });
        await bus.publish(event);

        const command = sqsClient.send.mock.calls[0][0];
        expect(command.input.MessageGroupId).toBe('case-123');
    });

    it('uses eventId as MessageDeduplicationId', async () => {
        const event = makeEvent({ eventId: 'unique-evt-id' });
        await bus.publish(event);

        const command = sqsClient.send.mock.calls[0][0];
        expect(command.input.MessageDeduplicationId).toBe('unique-evt-id');
    });

    it('also publishes sidecar to archive bus', async () => {
        const event = makeEvent();
        await bus.publish(event);

        expect(archiveBus.publish).toHaveBeenCalledTimes(1);
        expect(archiveBus.publish).toHaveBeenCalledWith(event);
    });

    it('resolves successfully even if archive bus throws (best-effort)', async () => {
        archiveBus.publish.mockRejectedValueOnce(new Error('eventbridge down'));
        const event = makeEvent();

        await expect(bus.publish(event)).resolves.not.toThrow();
        expect(sqsClient.send).toHaveBeenCalledTimes(1);
    });

    it('rejects if SQS send throws', async () => {
        sqsClient.send.mockRejectedValueOnce(new Error('sqs unavailable'));
        const event = makeEvent();

        await expect(bus.publish(event)).rejects.toThrow(/sqs unavailable/);
    });

    it('throws when event is not registered in queueMap (fail-fast)', async () => {
        const event = makeEvent({ eventName: 'kace.core.unknown.thing' });
        await expect(bus.publish(event)).rejects.toThrow(/no queue registered for kace.core.unknown.thing/);
        expect(sqsClient.send).not.toHaveBeenCalled();
    });

    it('emits PublishLatency metric with Target=sqs on successful send', async () => {
        await bus.publish(makeEvent({ eventName: 'kace.core.case.created' }));
        expect(Helper.logMetric).toHaveBeenCalledWith(
            'RoutingEventBus.PublishLatency',
            expect.any(Number),
            'Milliseconds',
            { EventName: 'kace.core.case.created', Target: 'sqs' }
        );
    });

    it('emits ArchiveSidecarFailures metric when the archive bus throws', async () => {
        archiveBus.publish.mockRejectedValueOnce(new Error('eventbridge down'));
        await bus.publish(makeEvent({ eventName: 'kace.core.case.created' }));
        expect(Helper.logMetric).toHaveBeenCalledWith('RoutingEventBus.ArchiveSidecarFailures', 1, 'Count', {
            EventName: 'kace.core.case.created',
        });
    });
});

describe('RoutingEventBus.publishBatch', () => {
    let sqsClient;
    let archiveBus;
    let bus;

    beforeEach(() => {
        sqsClient = makeMockSqsClient();
        archiveBus = makeMockArchiveBus();
        bus = new RoutingEventBus({ sqsClient, archiveBus, queueMap });
        jest.spyOn(Helper, 'logMetric').mockImplementation(() => {});
    });

    afterEach(() => jest.restoreAllMocks());

    it('groups events by queueUrl into SendMessageBatch commands', async () => {
        const events = [
            makeEvent({ eventId: 'a', eventName: 'kace.core.case.created' }),
            makeEvent({ eventId: 'b', eventName: 'kace.core.case.updated' }),
            makeEvent({ eventId: 'c', eventName: 'kace.core.action_job.created' }),
        ];
        await bus.publishBatch(events);

        // 2 batches: cases (2 events) + action-jobs (1 event)
        expect(sqsClient.send).toHaveBeenCalledTimes(2);
        const queues = sqsClient.send.mock.calls.map((c) => c[0].input.QueueUrl).sort();
        expect(queues).toEqual(['https://sqs.test/action-jobs.fifo', 'https://sqs.test/cases.fifo']);
    });

    it('caps each batch at 10 entries (SQS hard limit)', async () => {
        const events = Array.from({ length: 12 }, (_, i) =>
            makeEvent({ eventId: `evt-${i}`, eventName: 'kace.core.case.created' })
        );
        await bus.publishBatch(events);

        expect(sqsClient.send).toHaveBeenCalledTimes(2);
        expect(sqsClient.send.mock.calls[0][0].input.Entries).toHaveLength(10);
        expect(sqsClient.send.mock.calls[1][0].input.Entries).toHaveLength(2);
    });

    it('also publishes the whole batch to archive bus', async () => {
        const events = [makeEvent({ eventName: 'kace.core.case.created' })];
        await bus.publishBatch(events);

        expect(archiveBus.publishBatch).toHaveBeenCalledWith(events);
    });

    it('archive sidecar failure does not break the batch', async () => {
        archiveBus.publishBatch.mockRejectedValueOnce(new Error('eventbridge down'));
        const events = [makeEvent({ eventName: 'kace.core.case.created' })];

        await expect(bus.publishBatch(events)).resolves.toBeDefined();
    });

    it('counts failed entries from a partial SQS batch result', async () => {
        sqsClient.send.mockResolvedValueOnce({ Successful: [{ Id: 'e0' }], Failed: [{ Id: 'e1' }] });
        const events = [
            makeEvent({ eventId: 'a', eventName: 'kace.core.case.created' }),
            makeEvent({ eventId: 'b', eventName: 'kace.core.case.created' }),
        ];
        const result = await bus.publishBatch(events);
        expect(result.failed).toBe(1);
        expect(result.successful).toBe(1);
    });

    it('emits ArchiveSidecarFailures metric when the batch archive throws', async () => {
        archiveBus.publishBatch.mockRejectedValueOnce(new Error('eventbridge down'));
        const events = [
            makeEvent({ eventId: 'a', eventName: 'kace.core.case.created' }),
            makeEvent({ eventId: 'b', eventName: 'kace.core.case.created' }),
        ];
        await bus.publishBatch(events);
        expect(Helper.logMetric).toHaveBeenCalledWith('RoutingEventBus.ArchiveSidecarFailures', 2, 'Count', {
            EventName: 'kace.core.case.created',
        });
    });

    it('returns failedAggregateIds mapping failed entries back to their aggregateId', async () => {
        sqsClient.send.mockResolvedValueOnce({ Successful: [{ Id: 'e0' }], Failed: [{ Id: 'e1' }] });
        const events = [
            makeEvent({ eventId: 'a', aggregateId: 'exec-1', eventName: 'kace.core.case.created' }),
            makeEvent({ eventId: 'b', aggregateId: 'exec-2', eventName: 'kace.core.case.created' }),
        ];
        const result = await bus.publishBatch(events);
        expect(result.failedAggregateIds).toEqual(['exec-2']);
    });

    it('aggregates failedAggregateIds across chunks', async () => {
        sqsClient.send
            .mockResolvedValueOnce({ Successful: [{ Id: 'e0' }], Failed: [{ Id: 'e1' }] })
            .mockResolvedValueOnce({ Successful: [{ Id: 'e0' }], Failed: [{ Id: 'e1' }] });
        const events = Array.from({ length: 12 }, (_, i) =>
            makeEvent({ eventId: `evt-${i}`, aggregateId: `exec-${i}`, eventName: 'kace.core.case.created' })
        );
        const result = await bus.publishBatch(events);
        expect(result.failed).toBe(2);
        expect(result.failedAggregateIds).toEqual(['exec-1', 'exec-11']);
    });

    it('never runs more than MAX_BATCH_CONCURRENCY chunk sends in flight at once', async () => {
        let inFlight = 0;
        let maxInFlight = 0;
        sqsClient.send.mockImplementation(async () => {
            inFlight += 1;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await new Promise((resolve) => setTimeout(resolve, 5));
            inFlight -= 1;
            return { Successful: [{ Id: 'e0' }], Failed: [] };
        });
        const events = Array.from({ length: 80 }, (_, i) =>
            makeEvent({ eventId: `evt-${i}`, aggregateId: `exec-${i}`, eventName: 'kace.core.case.created' })
        );
        await bus.publishBatch(events);
        expect(maxInFlight).toBeLessThanOrEqual(5);
    });

    it('uses each event aggregateId as its per-entry MessageGroupId (high-cardinality, FIFO-parallel)', async () => {
        const events = [
            makeEvent({ eventId: 'a', aggregateId: 'exec-1', eventName: 'kace.core.case.created' }),
            makeEvent({ eventId: 'b', aggregateId: 'exec-2', eventName: 'kace.core.case.created' }),
        ];
        await bus.publishBatch(events);

        const entries = sqsClient.send.mock.calls[0][0].input.Entries;
        const groupIds = entries.map((e) => e.MessageGroupId).sort();
        expect(groupIds).toEqual(['exec-1', 'exec-2']);
    });

    it('sets an explicit MessageDeduplicationId per entry (queue is contentBasedDeduplication=false)', async () => {
        const events = [makeEvent({ eventId: 'dedup-1', aggregateId: 'exec-1', eventName: 'kace.core.case.created' })];
        await bus.publishBatch(events);

        const entry = sqsClient.send.mock.calls[0][0].input.Entries[0];
        expect(entry.MessageDeduplicationId).toBe('dedup-1');
    });
});
