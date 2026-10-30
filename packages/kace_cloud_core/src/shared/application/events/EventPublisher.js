import { Helper } from '../../infrastructure/utils/Helper.js';

/**
 * Application service for publishing domain events.
 * This service wraps the EventBus port and provides additional functionality
 * like logging and error handling.
 *
 * @example
 * const eventBus = new InMemoryEventBus();
 * const eventPublisher = new EventPublisher(eventBus);
 *
 * // Publish single event
 * await eventPublisher.publish(new CaseCreatedEvent({ ... }));
 *
 * // Publish multiple events from an aggregate
 * const events = case.pullDomainEvents();
 * await eventPublisher.publishAll(events);
 */
export class EventPublisher {
    /** @type {import('./EventBus.js').EventBus} */
    #eventBus;

    /**
     * Creates a new EventPublisher
     * @param {import('./EventBus.js').EventBus} eventBus - The event bus implementation to use
     * @throws {Error} If eventBus is not provided
     */
    constructor(eventBus) {
        if (!eventBus) {
            throw new Error('EventPublisher: eventBus is required');
        }
        this.#eventBus = eventBus;
    }

    /**
     * Publishes a single domain event
     * @param {import('../../domain/events/DomainEvent.js').DomainEvent} event - The event to publish
     * @returns {Promise<void>}
     */
    async publish(event) {
        if (!event) {
            Helper.logDebug('EventPublisher.publish: No event provided, skipping');
            return;
        }

        Helper.logDebug('EventPublisher: Publishing event', {
            eventId: event.eventId,
            eventName: event.eventName,
            aggregateId: event.aggregateId,
        });

        try {
            await this.#eventBus.publish(event);
            Helper.logDebug('EventPublisher: Event published successfully', {
                eventId: event.eventId,
            });
        } catch (error) {
            Helper.logError('EventPublisher: Failed to publish event', {
                eventId: event.eventId,
                eventName: event.eventName,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Publishes multiple domain events
     * @param {Array<import('../../domain/events/DomainEvent.js').DomainEvent>} events - The events to publish
     * @returns {Promise<void>}
     */
    async publishAll(events) {
        if (!events || events.length === 0) {
            Helper.logDebug('EventPublisher.publishAll: No events to publish, skipping');
            return;
        }

        Helper.logInfo('EventPublisher: Publishing batch of events', {
            count: events.length,
            eventNames: [...new Set(events.map((e) => e.eventName))],
        });

        try {
            const result = await this.#eventBus.publishBatch(events);
            Helper.logDebug('EventPublisher: Batch published successfully', {
                count: events.length,
            });
            return result;
        } catch (error) {
            Helper.logError('EventPublisher: Failed to publish batch', {
                count: events.length,
                error: error.message,
            });
            throw error;
        }
    }
}
