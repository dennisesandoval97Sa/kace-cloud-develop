import { jest } from '@jest/globals';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, PurgeQueueCommand } from '@aws-sdk/client-sqs';
import { RoutingEventBus } from '../../../../src/shared/infrastructure/events/RoutingEventBus.js';
import { DomainEvent } from '../../../../src/shared/domain/events/DomainEvent.js';
import { v4 as uuidV4 } from 'uuid';

// Cola FIFO ad-hoc para este test (debe existir previamente en dev/LocalStack):
//   {svc}-integration-test-events-queue.fifo
const TEST_QUEUE_URL = process.env.INTEGRATION_TEST_QUEUE_URL;

// KACE-SKIP(decision-pendiente): requiere una cola SQS real via
// INTEGRATION_TEST_QUEUE_URL; sin ella no hay nada que ejercitar.
const skipIfNoQueue = TEST_QUEUE_URL ? describe : describe.skip;

skipIfNoQueue('RoutingEventBus integration (real SQS)', () => {
    const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });
    const archiveBusStub = {
        publish: jest.fn().mockResolvedValue(undefined),
        publishBatch: jest.fn().mockResolvedValue({ successful: 0, failed: 0 }),
    };
    const queueMap = { 'kace.core.case.created': TEST_QUEUE_URL };
    const bus = new RoutingEventBus({ sqsClient, archiveBus: archiveBusStub, queueMap });

    beforeAll(async () => {
        // Purge to avoid interference (only safe in dev/test queues)
        try {
            await sqsClient.send(new PurgeQueueCommand({ QueueUrl: TEST_QUEUE_URL }));
        } catch {
            // PurgeQueue can only be called once per 60s; ignore.
        }
    }, 30_000);

    it('publishes a single event and it appears in the queue', async () => {
        const aggregateId = uuidV4();
        const event = new DomainEvent({
            eventName: 'kace.core.case.created',
            aggregateId,
            payload: { foo: 'bar' },
            metadata: { tenant_id: 'it-tenant' },
        });

        await bus.publish(event);

        const received = await sqsClient.send(
            new ReceiveMessageCommand({
                QueueUrl: TEST_QUEUE_URL,
                MaxNumberOfMessages: 1,
                WaitTimeSeconds: 5,
            })
        );

        expect(received.Messages).toHaveLength(1);
        const body = JSON.parse(received.Messages[0].Body);
        expect(body.aggregateId).toBe(aggregateId);
        expect(body.eventName).toBe('kace.core.case.created');
    }, 30_000);

    it('preserves order within the same MessageGroupId (aggregateId)', async () => {
        const aggregateId = uuidV4();
        const events = Array.from(
            { length: 5 },
            (_, i) =>
                new DomainEvent({
                    eventName: 'kace.core.case.created',
                    aggregateId,
                    payload: { seq: i },
                    metadata: { tenant_id: 'it-tenant' },
                })
        );

        for (const e of events) {
            await bus.publish(e);
        }

        // SQS may return fewer than requested per call — accumulate across polls.
        const collected = [];
        const deadline = Date.now() + 20_000;
        while (collected.length < 5 && Date.now() < deadline) {
            const received = await sqsClient.send(
                new ReceiveMessageCommand({
                    QueueUrl: TEST_QUEUE_URL,
                    MaxNumberOfMessages: 5,
                    WaitTimeSeconds: 5,
                })
            );
            for (const m of received.Messages ?? []) {
                collected.push(JSON.parse(m.Body).payload.seq);
                await sqsClient.send(
                    new DeleteMessageCommand({
                        QueueUrl: TEST_QUEUE_URL,
                        ReceiptHandle: m.ReceiptHandle,
                    })
                );
            }
        }

        expect(collected).toEqual([0, 1, 2, 3, 4]);
    }, 30_000);

    it('dedups identical eventId within FIFO 5-minute window', async () => {
        const eventId = uuidV4();
        const aggregateId = uuidV4();
        const baseProps = {
            eventName: 'kace.core.case.created',
            aggregateId,
            payload: { foo: 'dedup-test' },
            metadata: { tenant_id: 'it-tenant' },
        };
        // Two events with the same eventId
        const e1 = new DomainEvent({ ...baseProps, eventId });
        const e2 = new DomainEvent({ ...baseProps, eventId });

        await bus.publish(e1);
        await bus.publish(e2);

        const received = await sqsClient.send(
            new ReceiveMessageCommand({
                QueueUrl: TEST_QUEUE_URL,
                MaxNumberOfMessages: 10,
                WaitTimeSeconds: 5,
            })
        );

        const aggregateMessages = (received.Messages ?? []).filter(
            (m) => JSON.parse(m.Body).aggregateId === aggregateId
        );
        expect(aggregateMessages).toHaveLength(1);
    }, 30_000);
});
