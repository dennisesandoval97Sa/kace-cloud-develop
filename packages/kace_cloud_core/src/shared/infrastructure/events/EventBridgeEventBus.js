import { EventBus } from '../../application/events/EventBus.js';
import { Helper } from '../utils/Helper.js';

/**
 * AWS EventBridge implementation of the EventBus.
 * Publishes domain events to an EventBridge custom event bus for fan-out
 * to multiple consumers via content-based filtering rules.
 *
 * Features:
 * - Content-based filtering (consumers only receive relevant events)
 * - Fan-out to multiple targets (Lambda, SQS, SNS, Step Functions, etc.)
 * - Schema registry for event versioning
 * - Archive and replay capabilities
 * - Batch publishing (max 10 entries per PutEvents call)
 *
 * Note: subscribe/unsubscribe are not supported — use EventBridge rules and targets instead.
 *
 * @example
 * import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
 *
 * const eventBridgeEventBus = new EventBridgeEventBus({
 *     eventBridgeClient: new EventBridgeClient({ region: 'us-east-1' }),
 *     eventBusName: 'kace-events',
 *     source: 'kace.core',
 * });
 *
 * await eventBridgeEventBus.publish(caseCreatedEvent);
 */
export class EventBridgeEventBus extends EventBus {
    /** @type {import('@aws-sdk/client-eventbridge').EventBridgeClient} */
    #eventBridgeClient;

    /** @type {string} */
    #eventBusName;

    /** @type {string} */
    #source;

    /** @type {number} Max entries per EventBridge PutEvents call */
    static MAX_BATCH_SIZE = 10;

    /**
     * @param {Object} config
     * @param {import('@aws-sdk/client-eventbridge').EventBridgeClient} config.eventBridgeClient - Pre-configured EventBridge client
     * @param {string} [config.eventBusName='default'] - The EventBridge bus name
     * @param {string} [config.source='kace.core'] - Event source identifier
     */
    constructor({ eventBridgeClient, eventBusName = 'default', source = 'kace.core' }) {
        super();

        if (!eventBridgeClient) {
            throw new Error('EventBridgeEventBus: eventBridgeClient is required');
        }

        this.#eventBridgeClient = eventBridgeClient;
        this.#eventBusName = eventBusName;
        this.#source = source;
    }

    /**
     * Publishes a single domain event to EventBridge
     * @param {import('../../domain/events/DomainEvent.js').DomainEvent} event - The event to publish
     * @returns {Promise<void>}
     */
    async publish(event) {
        if (!event) {
            return;
        }

        const entry = this.#buildEntry(event);

        Helper.logDebug('EventBridgeEventBus: Publishing event', {
            eventName: event.eventName,
            aggregateId: event.aggregateId,
            eventBusName: this.#eventBusName,
        });

        const { PutEventsCommand } = await import('@aws-sdk/client-eventbridge');
        const command = new PutEventsCommand({ Entries: [entry] });
        const response = await this.#eventBridgeClient.send(command);

        if (response.FailedEntryCount > 0) {
            const failedEntry = response.Entries[0];
            const errorMessage = `EventBridgeEventBus: Failed to publish event: ${failedEntry.ErrorCode} - ${failedEntry.ErrorMessage}`;
            Helper.logError(errorMessage, { eventName: event.eventName });
            throw new Error(errorMessage);
        }

        Helper.logDebug('EventBridgeEventBus: Event published successfully', {
            eventName: event.eventName,
            eventId: response.Entries[0].EventId,
        });
    }

    /**
     * Publishes multiple domain events in batch (max 10 per PutEvents call)
     * @param {Array<import('../../domain/events/DomainEvent.js').DomainEvent>} events
     * @returns {Promise<{successful: number, failed: number}>}
     */
    async publishBatch(events) {
        if (!events || events.length === 0) {
            return { successful: 0, failed: 0 };
        }

        const batches = this.#chunkArray(events, EventBridgeEventBus.MAX_BATCH_SIZE);

        Helper.logDebug('EventBridgeEventBus: Publishing batch', {
            totalEvents: events.length,
            batches: batches.length,
        });

        let totalSuccessful = 0;
        let totalFailed = 0;

        const { PutEventsCommand } = await import('@aws-sdk/client-eventbridge');

        for (const batch of batches) {
            const entries = batch.map((event) => this.#buildEntry(event));
            const command = new PutEventsCommand({ Entries: entries });
            const response = await this.#eventBridgeClient.send(command);

            const failedCount = response.FailedEntryCount || 0;
            const successCount = batch.length - failedCount;

            totalSuccessful += successCount;
            totalFailed += failedCount;

            if (failedCount > 0) {
                const failedEntries = response.Entries.filter((e) => e.ErrorCode);
                Helper.logError('EventBridgeEventBus: Some events failed in batch', {
                    failed: failedEntries,
                });
            }
        }

        Helper.logDebug('EventBridgeEventBus: Batch published', {
            successful: totalSuccessful,
            failed: totalFailed,
        });

        return { successful: totalSuccessful, failed: totalFailed };
    }

    /**
     * Not supported for EventBridge. Use EventBridge rules and targets instead.
     * @throws {Error} Always throws
     */
    subscribe(_eventName, _handler) {
        throw new Error('EventBridgeEventBus does not support subscribe. Use EventBridge rules and targets instead.');
    }

    /**
     * Not supported for EventBridge. Use EventBridge rules and targets instead.
     * @throws {Error} Always throws
     */
    unsubscribe(_eventName, _handler) {
        throw new Error('EventBridgeEventBus does not support unsubscribe. Use EventBridge rules and targets instead.');
    }

    /**
     * Builds an EventBridge PutEvents entry from a domain event
     * @private
     * @param {import('../../domain/events/DomainEvent.js').DomainEvent} event
     * @returns {Object}
     */
    #buildEntry(event) {
        return {
            Source: this.#source,
            DetailType: event.eventName,
            Detail: JSON.stringify(event.toJson()),
            EventBusName: this.#eventBusName,
            Resources: [event.aggregateId],
            Time: new Date(event.occurredOn),
        };
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
