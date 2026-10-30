import { ValueObjectUuid } from '../value-object/ValueObjectUuid.js';
import { ValueObjectTimestamp } from '../value-object/ValueObjectTimestamp.js';

/**
 * Base class for all domain events in the system.
 * Domain events represent something significant that happened in the domain.
 * They are immutable and contain all information needed to describe the event.
 *
 * @example
 * class CaseCreatedEvent extends DomainEvent {
 *     static EVENT_NAME = 'kace.core.case.created';
 *
 *     constructor({ aggregateId, payload, metadata }) {
 *         super({
 *             eventName: CaseCreatedEvent.EVENT_NAME,
 *             aggregateId,
 *             payload,
 *             metadata,
 *         });
 *     }
 * }
 */
export class DomainEvent {
    /** @type {string} */
    #eventId;
    /** @type {string} */
    #eventName;
    /** @type {string} */
    #aggregateId;
    /** @type {string} */
    #occurredOn;
    /** @type {Object} */
    #payload;
    /** @type {Object} */
    #metadata;

    /**
     * Creates a new domain event
     * @param {Object} params - Event parameters
     * @param {string} params.eventName - The name of the event (e.g., 'case.created')
     * @param {string} params.aggregateId - The ID of the aggregate that produced this event
     * @param {Object} [params.payload={}] - Event-specific data
     * @param {Object} [params.metadata={}] - Event metadata
     * @param {string} [params.metadata.tenant_id] - Tenant identifier
     * @param {string} [params.metadata.user_id] - User who triggered the event
     * @param {string} [params.metadata.correlation_id] - ID to correlate related events
     * @param {string} [params.metadata.causation_id] - ID of the event that caused this one
     * @param {string} [params.eventId] - Optional event ID (auto-generated if not provided)
     * @param {string} [params.occurredOn] - Optional timestamp (auto-generated if not provided)
     */
    constructor({ eventName, aggregateId, payload = {}, metadata = {}, eventId, occurredOn }) {
        if (!eventName) {
            throw new Error('DomainEvent: eventName is required');
        }
        if (!aggregateId) {
            throw new Error('DomainEvent: aggregateId is required');
        }

        // Validate aggregateId is a valid UUID
        new ValueObjectUuid('aggregateId', aggregateId);

        // Generate or validate eventId
        this.#eventId = eventId || ValueObjectUuid.random();
        if (eventId) {
            new ValueObjectUuid('eventId', eventId);
        }

        this.#eventName = eventName;
        this.#aggregateId = aggregateId;

        // Generate or validate occurredOn
        const timestamp = occurredOn
            ? new ValueObjectTimestamp('occurredOn', occurredOn)
            : new ValueObjectTimestamp('occurredOn', new Date().toISOString());
        this.#occurredOn = timestamp.value;

        // Deep freeze payload and metadata to ensure immutability
        this.#payload = Object.freeze({ ...payload });
        this.#metadata = Object.freeze({
            tenant_id: metadata.tenant_id || null,
            user_id: metadata.user_id || null,
            correlation_id: metadata.correlation_id || null,
            causation_id: metadata.causation_id || null,
            ...metadata,
        });

        // Freeze the entire object to ensure immutability
        Object.freeze(this);
    }

    /**
     * Unique identifier for this event instance
     * @returns {string}
     */
    get eventId() {
        return this.#eventId;
    }

    /**
     * The name/type of this event
     * @returns {string}
     */
    get eventName() {
        return this.#eventName;
    }

    /**
     * The ID of the aggregate that produced this event
     * @returns {string}
     */
    get aggregateId() {
        return this.#aggregateId;
    }

    /**
     * When this event occurred (ISO 8601 timestamp)
     * @returns {string}
     */
    get occurredOn() {
        return this.#occurredOn;
    }

    /**
     * Event-specific data
     * @returns {Object}
     */
    get payload() {
        return this.#payload;
    }

    /**
     * Event metadata (tenant, user, correlation, causation IDs)
     * @returns {Object}
     */
    get metadata() {
        return this.#metadata;
    }

    /**
     * Converts the event to a plain JSON object for serialization
     * @returns {Object}
     */
    toJson() {
        return {
            eventId: this.#eventId,
            eventName: this.#eventName,
            aggregateId: this.#aggregateId,
            occurredOn: this.#occurredOn,
            payload: { ...this.#payload },
            metadata: { ...this.#metadata },
        };
    }

    /**
     * Reconstructs a DomainEvent from a JSON object
     * @param {Object} json - The JSON representation of the event
     * @returns {DomainEvent}
     */
    static fromJson(json) {
        if (!json || typeof json !== 'object') {
            throw new Error('DomainEvent.fromJson: invalid JSON input');
        }

        return new DomainEvent({
            eventId: json.eventId,
            eventName: json.eventName,
            aggregateId: json.aggregateId,
            occurredOn: json.occurredOn,
            payload: json.payload || {},
            metadata: json.metadata || {},
        });
    }
}
