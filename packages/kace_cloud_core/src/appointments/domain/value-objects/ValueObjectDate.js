import { ValueObject } from '../../../shared';

export class ValueObjectDate extends ValueObject {
    /** @type {Date} is initialized in the constructor */
    #value;

    /**
     * @param {string} field
     * @param {string|Date} value
     */
    constructor(field, value) {
        super(field, value);

        if (!value) {
            throw new Error(`${field}: The value cannot be null or undefined.`);
        }

        const dateValue = new Date(value);
        this.#ensureIsDate(dateValue, field);

        this.#value = new Date(Date.UTC(dateValue.getUTCFullYear(), dateValue.getUTCMonth(), dateValue.getUTCDate()));
    }

    /**
     * Return date in format ISO (YYYY-MM-DD).
     * @returns {string}
     */
    get value() {
        return this.#value.toISOString().split('T')[0];
    }

    /**
     * @returns {Date}
     */
    get date() {
        return this.#value;
    }

    /**
     * @param {Date} value
     * @param {string} field
     */
    #ensureIsDate(value, field) {
        if (isNaN(value.getTime())) {
            throw new Error(`${field}: Invalid date value ${value}`);
        }
    }
}
