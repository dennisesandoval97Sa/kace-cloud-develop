import { Helper, StatusEnum } from '../../index.js';

export class ValueObjectStatus {
    /** @type {Boolean} is initialized in the constructor */
    #value;
    constructor(field, value, nullable) {
        this.field = field;

        const isNull = value === null || value === undefined;
        if (isNull && !nullable) {
            Helper.logError(`${this.field}: The value cannot be null`);
            throw new Error(`${this.field}: The value cannot be null`);
        }
        if (isNull && nullable) {
            return;
        }

        const status = StatusEnum.fromValue(value);
        this.#value = status.value;
    }

    get value() {
        return this.#value;
    }
}
