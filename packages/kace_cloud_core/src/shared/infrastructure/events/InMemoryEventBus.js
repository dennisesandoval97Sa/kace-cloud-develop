import { EventBus } from '../../application/events/EventBus.js';
import { Helper } from '../utils/Helper.js';

/**
 * In-memory implementation of the EventBus for testing and development.
 * Events are published synchronously to all registered handlers.
 *
 * Features:
 * - Supports wildcard '*' subscription to receive all events
 * - Graceful error handling - handler errors don't stop other handlers
 * - Useful helper methods: clear(), subscriberCount()
 *
 * @example
 * const eventBus = new InMemoryEventBus();
 *
 * // Subscribe to specific event
 * eventBus.subscribe('kace.core.case.created', async (event) => {
 *     console.log('Case created:', event.aggregateId);
 * });
 *
 * // Subscribe to all events
 * eventBus.subscribe('*', async (event) => {
 *     console.log('Event received:', event.eventName);
 * });
 *
 * // Publish event
 * await eventBus.publish(new CaseCreatedEvent({ ... }));
 */
export class InMemoryEventBus extends EventBus {
    /** @type {Map<string, Set<Function>>} */
    #subscribers;

    constructor() {
        super();
        this.#subscribers = new Map();
    }

    /**
     * Publishes a single domain event to all registered handlers
     * @param {import('../../domain/events/DomainEvent.js').DomainEvent} event - The event to publish
     * @returns {Promise<void>}
     */
    async publish(event) {
        if (!event) {
            return;
        }

        const eventName = event.eventName;
        const handlers = this.#getHandlersForEvent(eventName);

        Helper.logDebug('InMemoryEventBus: Publishing event', {
            eventName,
            handlerCount: handlers.length,
        });

        await this.#invokeHandlers(handlers, event);
    }

    /**
     * Publishes multiple domain events
     * @param {Array<import('../../domain/events/DomainEvent.js').DomainEvent>} events - The events to publish
     * @returns {Promise<void>}
     */
    async publishBatch(events) {
        if (!events || events.length === 0) {
            return;
        }

        for (const event of events) {
            await this.publish(event);
        }
    }

    /**
     * Subscribes a handler to a specific event type
     * @param {string} eventName - The event name to subscribe to (use '*' for all events)
     * @param {Function} handler - The handler function to call when the event is published
     * @throws {Error} If handler is not a function
     */
    subscribe(eventName, handler) {
        if (typeof handler !== 'function') {
            throw new Error('InMemoryEventBus.subscribe: handler must be a function');
        }

        if (!this.#subscribers.has(eventName)) {
            this.#subscribers.set(eventName, new Set());
        }

        this.#subscribers.get(eventName).add(handler);

        Helper.logDebug('InMemoryEventBus: Handler subscribed', {
            eventName,
            totalSubscribers: this.#subscribers.get(eventName).size,
        });
    }

    /**
     * Unsubscribes a handler from a specific event type
     * @param {string} eventName - The event name to unsubscribe from
     * @param {Function} handler - The handler function to remove
     */
    unsubscribe(eventName, handler) {
        if (!this.#subscribers.has(eventName)) {
            return;
        }

        this.#subscribers.get(eventName).delete(handler);

        // Clean up empty sets
        if (this.#subscribers.get(eventName).size === 0) {
            this.#subscribers.delete(eventName);
        }

        Helper.logDebug('InMemoryEventBus: Handler unsubscribed', {
            eventName,
        });
    }

    /**
     * Clears all subscribers. Useful for testing.
     */
    clear() {
        this.#subscribers.clear();
        Helper.logDebug('InMemoryEventBus: All subscribers cleared');
    }

    /**
     * Returns the total number of subscribers across all event types
     * @returns {number}
     */
    subscriberCount() {
        let count = 0;
        for (const handlers of this.#subscribers.values()) {
            count += handlers.size;
        }
        return count;
    }

    /**
     * Returns the number of subscribers for a specific event type
     * @param {string} eventName - The event name
     * @returns {number}
     */
    subscriberCountFor(eventName) {
        if (!this.#subscribers.has(eventName)) {
            return 0;
        }
        return this.#subscribers.get(eventName).size;
    }

    /**
     * Gets all handlers for a specific event (including wildcard handlers)
     * @private
     * @param {string} eventName - The event name
     * @returns {Function[]}
     */
    #getHandlersForEvent(eventName) {
        const handlers = [];

        // Add specific handlers for this event
        if (this.#subscribers.has(eventName)) {
            handlers.push(...this.#subscribers.get(eventName));
        }

        // Add wildcard handlers
        if (this.#subscribers.has('*')) {
            handlers.push(...this.#subscribers.get('*'));
        }

        return handlers;
    }

    /**
     * Invokes all handlers for an event, handling errors gracefully
     * @private
     * @param {Function[]} handlers - The handlers to invoke
     * @param {import('../../domain/events/DomainEvent.js').DomainEvent} event - The event
     */
    async #invokeHandlers(handlers, event) {
        for (const handler of handlers) {
            try {
                await handler(event);
            } catch (error) {
                // Log error but don't stop other handlers
                Helper.logError('InMemoryEventBus: Handler threw error', {
                    eventName: event.eventName,
                    eventId: event.eventId,
                    error: error.message,
                    stack: error.stack,
                });
            }
        }
    }
}
