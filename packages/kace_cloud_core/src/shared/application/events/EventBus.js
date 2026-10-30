/**
 * EventBus is a port (interface) that defines the contract for event publishing and subscription.
 * This follows the hexagonal architecture pattern - implementations are in the infrastructure layer.
 *
 * @interface
 * @example
 * // Infrastructure implementation
 * class RabbitMQEventBus extends EventBus {
 *     async publish(event) {
 *         await this.channel.publish('events', event.eventName, event.toJson());
 *     }
 * }
 *
 * // Usage in use case
 * class CaseCreator {
 *     constructor(repository, eventBus) {
 *         this.eventBus = eventBus;
 *     }
 *
 *     async execute(dto) {
 *         const case = Case.create(dto);
 *         await this.repository.save(case);
 *         const events = case.pullDomainEvents();
 *         await this.eventBus.publishBatch(events);
 *     }
 * }
 */
export class EventBus {
    /**
     * Publishes a single domain event
     * @param {import('../../domain/events/DomainEvent.js').DomainEvent} event - The event to publish
     * @returns {Promise<void>}
     * @throws {Error} If not implemented by subclass
     */
    async publish(event) {
        throw new Error('EventBus.publish() must be implemented by subclass');
    }

    /**
     * Publishes multiple domain events
     * @param {Array<import('../../domain/events/DomainEvent.js').DomainEvent>} events - The events to publish
     * @returns {Promise<void>}
     * @throws {Error} If not implemented by subclass
     */
    async publishBatch(events) {
        throw new Error('EventBus.publishBatch() must be implemented by subclass');
    }

    /**
     * Subscribes a handler to a specific event type
     * @param {string} eventName - The event name to subscribe to (use '*' for all events)
     * @param {Function} handler - The handler function to call when the event is published
     * @returns {void}
     * @throws {Error} If not implemented by subclass
     */
    subscribe(eventName, handler) {
        throw new Error('EventBus.subscribe() must be implemented by subclass');
    }

    /**
     * Unsubscribes a handler from a specific event type
     * @param {string} eventName - The event name to unsubscribe from
     * @param {Function} handler - The handler function to remove
     * @returns {void}
     * @throws {Error} If not implemented by subclass
     */
    unsubscribe(eventName, handler) {
        throw new Error('EventBus.unsubscribe() must be implemented by subclass');
    }
}
