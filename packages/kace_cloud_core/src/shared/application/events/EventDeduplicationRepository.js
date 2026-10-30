/**
 * Port (interface) for event deduplication persistence.
 * Implementations check whether a domain event has already been processed
 * and record processed events to prevent duplicate handling.
 *
 * This is a "Port" in Hexagonal Architecture — it defines what the application
 * needs without specifying how persistence works (PostgreSQL, DynamoDB, etc.)
 */
export class EventDeduplicationRepository {
    /**
     * Checks whether an event with the given ID has already been processed.
     * @param {string} eventId - The unique event identifier
     * @returns {Promise<boolean>} true if the event was already processed
     * @abstract
     */
    async exists(eventId) {
        throw new Error('EventDeduplicationRepository.exists() must be implemented');
    }

    /**
     * Records that an event has been processed.
     * @param {string} eventId - The unique event identifier
     * @param {string} eventName - The event type name
     * @param {string} aggregateId - The aggregate that produced the event
     * @returns {Promise<void>}
     * @abstract
     */
    async save(eventId, eventName, aggregateId) {
        throw new Error('EventDeduplicationRepository.save() must be implemented');
    }
}
