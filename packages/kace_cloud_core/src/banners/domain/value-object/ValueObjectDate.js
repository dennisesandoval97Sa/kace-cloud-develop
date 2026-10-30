import { ValueObject } from '../../../shared';

export class ValueObjectDate extends ValueObject {
    /**
     * @type {Date}
     * is initialized in the constructor
     */
    #value;

    constructor(field, value, nullable) {
        super(field, value, nullable);

        const dateValue = new Date(value);
        this.#ensureIsDate(dateValue, field);
        /**
         * Crear una nueva instancia con la hora establecida a 00:00:00 sin modificar el valor original
         */
        this.#value = new Date(Date.UTC(dateValue.getUTCFullYear(), dateValue.getUTCMonth(), dateValue.getUTCDate()));
    }

    get value() {
        return this.#value.toISOString().split('T')[0];
    }

    get date() {
        return this.#value;
    }

    #ensureIsDate(value, field) {
        if (isNaN(value.getTime())) {
            throw new Error(`${field}: Invalid date value ${value}`);
        }
    }
}
