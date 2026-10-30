import { EventBus } from '../../application/events/EventBus.js';
import { Helper } from '../utils/Helper.js';

/**
 * AWS SQS implementation of the EventBus.
 * Publishes domain events to an SQS queue for asynchronous processing by Lambda consumers.
 *
 * Features:
 * - Supports both Standard and FIFO queues
 * - FIFO queues use aggregateId as MessageGroupId for ordered delivery per aggregate
 * - Batch publishing (max 10 messages per SQS batch)
 * - Event metadata as SQS MessageAttributes for filtering
 *
 * Note: subscribe/unsubscribe are not supported — use Lambda event source mapping instead.
 *
 * @example
 * import { SQSClient } from '@aws-sdk/client-sqs';
 *
 * const sqsEventBus = new SQSEventBus({
 *     sqsClient: new SQSClient({ region: 'us-east-1' }),
 *     queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/kace-events-queue.fifo',
 * });
 *
 * await sqsEventBus.publish(caseCreatedEvent);
 */
export class SQSEventBus extends EventBus {
    /** @type {import('@aws-sdk/client-sqs').SQSClient} */
    #sqsClient;

    /** @type {string} */
    #queueUrl;

    /** @type {number} Max messages per SQS batch (SQS limit is 10) */
    static MAX_BATCH_SIZE = 10;

    /**
     * @param {Object} config
     * @param {import('@aws-sdk/client-sqs').SQSClient} config.sqsClient - Pre-configured SQS client instance
     * @param {string} config.queueUrl - The SQS queue URL to publish events to
     */
    constructor({ sqsClient, queueUrl }) {
        super();

        if (!sqsClient) {
            throw new Error('SQSEventBus: sqsClient is required');
        }
        if (!queueUrl) {
            throw new Error('SQSEventBus: queueUrl is required');
        }

        this.#sqsClient = sqsClient;
        this.#queueUrl = queueUrl;
    }

    /**
     * Publishes a single domain event to SQS
     * @param {import('../../domain/events/DomainEvent.js').DomainEvent} event - The event to publish
     * @returns {Promise<{messageId: string}>} The SQS MessageId
     */
    async publish(event) {
        if (!event) {
            return;
        }

        const messageBody = JSON.stringify(event.toJson());
        const isFifo = this.#isFifoQueue();

        const params = {
            QueueUrl: this.#queueUrl,
            MessageBody: messageBody,
            MessageAttributes: this.#buildMessageAttributes(event),
            ...(isFifo && {
                MessageGroupId: event.aggregateId,
                MessageDeduplicationId: event.eventId,
            }),
        };

        Helper.logDebug('SQSEventBus: Publishing event', {
            eventName: event.eventName,
            aggregateId: event.aggregateId,
            fifo: isFifo,
        });

        const { SendMessageCommand } = await import('@aws-sdk/client-sqs');
        const command = new SendMessageCommand(params);
        const response = await this.#sqsClient.send(command);

        Helper.logDebug('SQSEventBus: Event published successfully', {
            eventName: event.eventName,
            messageId: response.MessageId,
        });

        return { messageId: response.MessageId };
    }

    /**
     * Publishes multiple domain events in batch (max 10 per SQS batch)
     * @param {Array<import('../../domain/events/DomainEvent.js').DomainEvent>} events - The events to publish
     * @returns {Promise<{successful: number, failed: number}>} Count of successful and failed messages
     */
    async publishBatch(events) {
        if (!events || events.length === 0) {
            return { successful: 0, failed: 0 };
        }

        const isFifo = this.#isFifoQueue();
        const batches = this.#chunkArray(events, SQSEventBus.MAX_BATCH_SIZE);

        Helper.logDebug('SQSEventBus: Publishing batch', {
            totalEvents: events.length,
            batches: batches.length,
        });

        let totalSuccessful = 0;
        let totalFailed = 0;

        const { SendMessageBatchCommand } = await import('@aws-sdk/client-sqs');

        for (const batch of batches) {
            const entries = batch.map((event, index) => ({
                Id: `${index}`,
                MessageBody: JSON.stringify(event.toJson()),
                MessageAttributes: this.#buildMessageAttributes(event),
                ...(isFifo && {
                    MessageGroupId: event.aggregateId,
                    MessageDeduplicationId: event.eventId,
                }),
            }));

            const command = new SendMessageBatchCommand({
                QueueUrl: this.#queueUrl,
                Entries: entries,
            });

            const response = await this.#sqsClient.send(command);

            const successCount = response.Successful ? response.Successful.length : 0;
            const failCount = response.Failed ? response.Failed.length : 0;

            totalSuccessful += successCount;
            totalFailed += failCount;

            if (failCount > 0) {
                Helper.logError('SQSEventBus: Some messages failed in batch', {
                    failed: response.Failed,
                });
            }
        }

        Helper.logDebug('SQSEventBus: Batch published', {
            successful: totalSuccessful,
            failed: totalFailed,
        });

        return { successful: totalSuccessful, failed: totalFailed };
    }

    /**
     * Not supported for SQS. Use Lambda event source mapping instead.
     * @throws {Error} Always throws
     */
    subscribe(_eventName, _handler) {
        throw new Error('SQSEventBus does not support subscribe. Use Lambda event source mapping instead.');
    }

    /**
     * Not supported for SQS. Use Lambda event source mapping instead.
     * @throws {Error} Always throws
     */
    unsubscribe(_eventName, _handler) {
        throw new Error('SQSEventBus does not support unsubscribe. Use Lambda event source mapping instead.');
    }

    /**
     * Builds SQS MessageAttributes from a domain event for filtering
     * @private
     * @param {import('../../domain/events/DomainEvent.js').DomainEvent} event
     * @returns {Object}
     */
    #buildMessageAttributes(event) {
        const attributes = {
            eventName: {
                DataType: 'String',
                StringValue: event.eventName,
            },
        };

        if (event.metadata.tenant_id) {
            attributes.tenantId = {
                DataType: 'String',
                StringValue: event.metadata.tenant_id,
            };
        }

        if (event.metadata.correlation_id) {
            attributes.correlationId = {
                DataType: 'String',
                StringValue: event.metadata.correlation_id,
            };
        }

        return attributes;
    }

    /**
     * Checks if the queue URL points to a FIFO queue
     * @private
     * @returns {boolean}
     */
    #isFifoQueue() {
        return this.#queueUrl.endsWith('.fifo');
    }

    /**
     * Splits an array into chunks of a given size
     * @private
     * @param {Array} array
     * @param {number} size
     * @returns {Array<Array>}
     */
    #chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
}
