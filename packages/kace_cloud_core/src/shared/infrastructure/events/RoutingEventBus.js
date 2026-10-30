// Static import: @aws-sdk/client-sqs is bundled into the Lambda zip by esbuild
// (no externalModules in KApiStack), so lazy import would offer no cold-start benefit.
import { SendMessageCommand, SendMessageBatchCommand } from '@aws-sdk/client-sqs';
import pLimit from 'p-limit';
import { EventBus } from '../../application/events/EventBus.js';
import { Helper } from '../utils/Helper.js';

const SQS_BATCH_MAX_ENTRIES = 10;
const MAX_BATCH_CONCURRENCY = 5;

/**
 * RoutingEventBus publishes domain events to the SQS FIFO queue mapped
 * for each eventName, plus a best-effort sidecar publish to an archive bus
 * (EventBridge) for replay/audit purposes.
 *
 * Replaces HybridEventBus. Differences:
 *  - Single transport in hot path (SQS), per-event queue
 *  - EventBridge is sidecar only — failures do NOT break publishing
 *  - Unmapped events fail-fast at publish time (throw)
 */
export class RoutingEventBus extends EventBus {
    /** @type {import('@aws-sdk/client-sqs').SQSClient} */
    #sqsClient;
    /** @type {EventBus} */
    #archiveBus;
    /** @type {Map<string,string>} */
    #queueMap;

    /**
     * @param {Object} config
     * @param {import('@aws-sdk/client-sqs').SQSClient} config.sqsClient
     * @param {EventBus} config.archiveBus - EventBus that publishes to EventBridge for archive
     * @param {Record<string,string>} config.queueMap - eventName → queueUrl
     */
    constructor({ sqsClient, archiveBus, queueMap }) {
        super();
        if (!sqsClient) throw new Error('RoutingEventBus: sqsClient is required');
        if (!archiveBus) throw new Error('RoutingEventBus: archiveBus is required');
        if (!queueMap) throw new Error('RoutingEventBus: queueMap is required');

        this.#sqsClient = sqsClient;
        this.#archiveBus = archiveBus;
        this.#queueMap = new Map(Object.entries(queueMap));
    }

    /**
     * @param {import('../../domain/events/DomainEvent.js').DomainEvent} event
     */
    async publish(event) {
        if (!event) return;

        const queueUrl = this.#resolveQueue(event.eventName);

        // Blocking hot path: SQS. Archive is best-effort in parallel.
        const [sqsResult] = await Promise.all([this.#sendToSqs(queueUrl, event), this.#archiveBestEffort(event)]);
        return sqsResult;
    }

    /**
     * @param {Array<import('../../domain/events/DomainEvent.js').DomainEvent>} events
     */
    async publishBatch(events) {
        if (!events || events.length === 0) return { successful: 0, failed: 0, failedAggregateIds: [] };

        // Group by queueUrl
        const groups = new Map(); // queueUrl → events[]
        for (const event of events) {
            const queueUrl = this.#resolveQueue(event.eventName);
            if (!groups.has(queueUrl)) groups.set(queueUrl, []);
            groups.get(queueUrl).push(event);
        }

        // Chunk each group into SQS_BATCH_MAX_ENTRIES (10) — bounded fan-out + archive sidecar
        const chunks = [];
        for (const [queueUrl, groupEvents] of groups) {
            for (let i = 0; i < groupEvents.length; i += SQS_BATCH_MAX_ENTRIES) {
                chunks.push({ queueUrl, chunk: groupEvents.slice(i, i + SQS_BATCH_MAX_ENTRIES) });
            }
        }

        const limit = pLimit(MAX_BATCH_CONCURRENCY);
        const sqsPromises = chunks.map(({ queueUrl, chunk }) => limit(() => this.#sendBatchToSqs(queueUrl, chunk)));

        const [sqsResults] = await Promise.all([Promise.all(sqsPromises), this.#archiveBatchBestEffort(events)]);

        return sqsResults.reduce(
            (acc, r) => ({
                successful: acc.successful + r.successful,
                failed: acc.failed + r.failed,
                failedAggregateIds: [...acc.failedAggregateIds, ...(r.failedAggregateIds ?? [])],
            }),
            { successful: 0, failed: 0, failedAggregateIds: [] }
        );
    }

    subscribe(_eventName, _handler) {
        throw new Error('RoutingEventBus does not support subscribe.');
    }

    unsubscribe(_eventName, _handler) {
        throw new Error('RoutingEventBus does not support unsubscribe.');
    }

    #resolveQueue(eventName) {
        const url = this.#queueMap.get(eventName);
        if (!url) {
            throw new Error(`RoutingEventBus: no queue registered for ${eventName}`);
        }
        return url;
    }

    #resolveMessageGroupId(event) {
        return event.messageGroupId ?? event.aggregateId;
    }

    #resolveMessageDeduplicationId(event) {
        return event.messageDeduplicationId ?? event.eventId;
    }

    async #sendToSqs(queueUrl, event) {
        const startedAt = process.hrtime.bigint();
        const command = new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify(event.toJson()),
            MessageGroupId: this.#resolveMessageGroupId(event),
            MessageDeduplicationId: this.#resolveMessageDeduplicationId(event),
            MessageAttributes: {
                eventName: { DataType: 'String', StringValue: event.eventName },
                tenantId: { DataType: 'String', StringValue: event.metadata?.tenant_id ?? 'unknown' },
            },
        });
        const result = await this.#sqsClient.send(command);
        Helper.logMetric(
            'RoutingEventBus.PublishLatency',
            Number(process.hrtime.bigint() - startedAt) / 1_000_000,
            'Milliseconds',
            {
                EventName: event.eventName,
                Target: 'sqs',
            }
        );
        return result;
    }

    async #sendBatchToSqs(queueUrl, chunk) {
        const command = new SendMessageBatchCommand({
            QueueUrl: queueUrl,
            Entries: chunk.map((event, idx) => ({
                Id: `e${idx}`,
                MessageBody: JSON.stringify(event.toJson()),
                MessageGroupId: this.#resolveMessageGroupId(event),
                MessageDeduplicationId: this.#resolveMessageDeduplicationId(event),
                MessageAttributes: {
                    eventName: { DataType: 'String', StringValue: event.eventName },
                    tenantId: { DataType: 'String', StringValue: event.metadata?.tenant_id ?? 'unknown' },
                },
            })),
        });
        const result = await this.#sqsClient.send(command);
        const failedEntries = result.Failed ?? [];
        if (failedEntries.length > 0) {
            Helper.logError('RoutingEventBus: partial batch failure', {
                queueUrl,
                failed: failedEntries,
            });
        }
        const failedAggregateIds = failedEntries
            .map((entry) => chunk[Number(entry.Id.slice(1))]?.aggregateId)
            .filter((id) => id !== undefined);
        return {
            successful: (result.Successful ?? []).length,
            failed: failedEntries.length,
            failedAggregateIds,
        };
    }

    async #archiveBestEffort(event) {
        try {
            await this.#archiveBus.publish(event);
        } catch (error) {
            Helper.logMetric('RoutingEventBus.ArchiveSidecarFailures', 1, 'Count', { EventName: event.eventName });
            Helper.logError('RoutingEventBus: archive sidecar publish failed (continuing)', {
                eventId: event.eventId,
                eventName: event.eventName,
                error: error.message,
            });
        }
    }

    async #archiveBatchBestEffort(events) {
        try {
            await this.#archiveBus.publishBatch(events);
        } catch (error) {
            Helper.logMetric('RoutingEventBus.ArchiveSidecarFailures', events.length, 'Count', {
                EventName: events[0]?.eventName ?? 'unknown',
            });
            Helper.logError('RoutingEventBus: archive sidecar publishBatch failed (continuing)', {
                count: events.length,
                error: error.message,
            });
        }
    }
}
