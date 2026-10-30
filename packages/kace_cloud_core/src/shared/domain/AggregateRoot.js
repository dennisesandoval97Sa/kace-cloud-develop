import { ValueObjectTimestamp } from './value-object/ValueObjectTimestamp';
import { ValueObjectUuid } from './value-object/ValueObjectUuid';
import { DeleteFieldsDoNotExistError } from '../errors/DeleteFieldsDoNotExistError.js';
import { Helper } from '../infrastructure/utils/Helper.js';

export class AggregateRoot {
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #id;
    /** @type {ValueObjectUuid} */
    #created_by = null;
    /** @type {ValueObjectTimestamp} */
    #updated_by = null;
    /** @type {ValueObjectTimestamp} */
    #created_at = null;
    /** @type {ValueObjectTimestamp} */
    #updated_at = null;
    /** @type {ValueObjectUuid} */
    #deleted_by = null;
    /** @type {ValueObjectTimestamp} */
    #deleted_at = null;
    /** @type {object} is initialized in the constructor */
    #changedAttributes;
    /** @type {Array<import('./events/DomainEvent.js').DomainEvent>} */
    #domainEvents = [];
    /** Fields that represent audit metadata only; changes limited to these are considered no-ops. */
    static #AUDIT_ONLY_FIELDS = ['updated_at', 'updated_by'];

    constructor(id) {
        this.#id = new ValueObjectUuid('id', id);
        this.#changedAttributes = {};
        this.#domainEvents = [];
    }

    /** @returns {ValueObjectUuid} */
    get id() {
        return this.#id;
    }

    /**
     *
     * @returns {ValueObjectTimestamp}
     */
    get created_at() {
        return this.#created_at;
    }

    set created_at(value) {
        if (this.#created_at === null || this.#created_at === undefined) {
            this.#created_at = new ValueObjectTimestamp('created at', value);
        }
    }

    /**
     *
     * @returns {ValueObjectUuid}
     */
    get created_by() {
        return this.#created_by;
    }

    set created_by(value) {
        if (this.#created_by === null || this.#created_by === undefined) {
            this.#created_by = new ValueObjectUuid('created by', value);
        }
    }

    /**
     *
     * @returns {ValueObjectTimestamp}
     */
    get updated_at() {
        return this.#updated_at;
    }

    set updated_at(value) {
        this.#updated_at = new ValueObjectTimestamp('updated at', value, true);
        if (value !== null && value !== undefined) {
            this.#changedAttributes.updated_at = this.#updated_at.value;
        }
    }

    /**
     *
     * @returns {ValueObjectTimestamp}
     */
    get updated_by() {
        return this.#updated_by;
    }

    set updated_by(value) {
        this.#updated_by = new ValueObjectUuid('updated by', value, true);
        if (value !== null && value !== undefined) {
            this.#changedAttributes.updated_by = this.#updated_by.value;
        }
    }

    /**
     *
     * @returns {ValueObjectTimestamp}
     */
    get deleted_at() {
        return this.#deleted_at;
    }

    set deleted_at(value) {
        this.#deleted_at = new ValueObjectTimestamp('deleted at', value, true);
        if (value !== null && value !== undefined) {
            this.#changedAttributes.deleted_at = this.#deleted_at.value;
        }
    }

    /**
     *
     * @returns {ValueObjectUuid}
     */
    get deleted_by() {
        return this.#deleted_by;
    }

    set deleted_by(value) {
        this.#deleted_by = new ValueObjectUuid('deleted by', value, true);
        if (value !== null && value !== undefined) {
            this.#changedAttributes.deleted_by = this.#deleted_by.value;
        }
    }

    /**
     *
     * @returns {Object}
     */
    get changedAttributes() {
        return this.#changedAttributes;
    }

    /**
     * Returns true if there is at least one pending change that is NOT an audit column.
     * Audit-only changes ({updated_at, updated_by}) represent a no-op write that should be
     * skipped to avoid serializing on a hot row (see SARA load test 2026-06-18, P0).
     * @returns {boolean}
     */
    hasMeaningfulChanges() {
        return Object.keys(this.#changedAttributes).some((key) => !AggregateRoot.#AUDIT_ONLY_FIELDS.includes(key));
    }

    /**
     * Updates the object with the provided data transfer object (DTO).
     *
     * This method takes a data transfer object containing key-value pairs
     * and updates the corresponding properties of the current object if they exist.
     * @param {Object} dto - The data transfer object containing the properties to update in the object.
     * @returns {void} This method does not return a value.
     */
    update(dto) {
        for (const [key, value] of Object.entries(dto)) {
            const comparisonKey =
                typeof this[key]?.value === 'object' ? JSON.stringify(this[key]?.value) : this[key]?.value;
            const comparisonValue = typeof value === 'object' ? JSON.stringify(value) : value;

            if (comparisonKey !== comparisonValue) {
                this[key] = value;
            }
        }
    }

    /**
     * Marks the Client object as deleted by setting the deleted_at and deleted_by properties.
     *
     * @param {Object} dto - The data transfer object containing the deleted_at and deleted_by properties.
     * @returns {void} This method does not return a value.
     */
    delete(dto) {
        if (!dto.hasOwnProperty('deleted_at') || !dto.hasOwnProperty('deleted_by')) {
            throw new DeleteFieldsDoNotExistError(this.constructor.name);
        }
        this.deleted_at = dto.deleted_at;
        this.deleted_by = dto.deleted_by;
    }
    /**
     * Resets the changed attributes.
     *
     * This method clears all the attributes that have been marked as changed
     * in the current instance.
     * @returns {void} This method does not return a value.
     */
    flushChanges(field = null) {
        if (field) {
            if (this.#changedAttributes.hasOwnProperty(field)) {
                delete this.#changedAttributes[field];
            }
        } else {
            this.#changedAttributes = {};
        }
    }

    /**
     * Converts the AggregateRoot instance to a JSON representation.
     * @returns {Object} A plain object representation of the AggregateRoot
     */
    toJson() {
        const json = {};

        const currentPrototype = Object.getPrototypeOf(this);
        const properties = Object.getOwnPropertyNames(currentPrototype);
        properties.forEach((property) => {
            if (!this[property]) {
                return;
            }

            try {
                if (typeof this[property] === 'object') {
                    json[property] = this[property].value;
                }
            } catch (e) {
                Helper.logInfo('propiedad:', property);
                Helper.logError('Error converting to JSON:', e);
                throw e;
            }
        });

        return {
            ...json,
            id: this.#id.value,
            created_at: this.#created_at?.value,
            created_by: this.#created_by?.value,
            updated_at: this.#updated_at?.value,
            updated_by: this.#updated_by?.value,
        };
    }

    isDeleted() {
        return this.deleted_by?.value;
    }

    /**
     * Records a domain event to be published later.
     * Events are collected and can be retrieved using pullDomainEvents().
     *
     * @param {import('./events/DomainEvent.js').DomainEvent} event - The domain event to record
     * @returns {void}
     */
    recordDomainEvent(event) {
        this.#domainEvents.push(event);
    }

    /**
     * Returns all recorded domain events and clears the internal list.
     * This is typically called after the aggregate is persisted to publish the events.
     *
     * @returns {Array<import('./events/DomainEvent.js').DomainEvent>} The list of recorded events
     */
    pullDomainEvents() {
        const events = [...this.#domainEvents];
        this.#domainEvents = [];
        return events;
    }

    /**
     * Checks if there are any pending domain events.
     *
     * @returns {boolean} True if there are pending events, false otherwise
     */
    hasDomainEvents() {
        return this.#domainEvents.length > 0;
    }
}
