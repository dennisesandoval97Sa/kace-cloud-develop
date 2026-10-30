import { Helper } from '../../infrastructure/utils/Helper.js';

/**
 * Application service that provides idempotent event processing.
 * Ensures each domain event is handled exactly once, even when
 * SQS delivers the same message multiple times (at-least-once delivery).
 */
export class EventDeduplicator {
    /** @type {EventDeduplicationRepository} */
    #repository;

    /**
     * @param {EventDeduplicationRepository} repository
     */
    constructor(repository) {
        if (!repository) {
            throw new Error('EventDeduplicator: repository is required');
        }
        this.#repository = repository;
    }

    /**
     * Checks if a domain event has already been processed.
     * @param {string} eventId - The unique event identifier
     * @returns {Promise<boolean>}
     */
    async isAlreadyProcessed(eventId) {
        const exists = await this.#repository.exists(eventId);
        if (exists) {
            Helper.logInfo('EventDeduplicator: Event already processed', { eventId });
        }
        return exists;
    }

    /**
     * Records that a domain event has been successfully processed.
     * Call this after all handlers for the event have completed.
     * @param {DomainEvent} domainEvent
     * @returns {Promise<void>}
     */
    async markAsProcessed(domainEvent) {
        await this.#repository.save(domainEvent.eventId, domainEvent.eventName, domainEvent.aggregateId);
        Helper.logDebug('EventDeduplicator: Event marked as processed', {
            eventId: domainEvent.eventId,
            eventName: domainEvent.eventName,
        });
    }
}
