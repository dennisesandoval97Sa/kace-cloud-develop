import { ActionTypes } from '../ActionTypes';

export class ValueObjectActionType {
    /**
     * @type {ActionTypes}
     * is initialized in the constructor
     */
    #value;

    constructor(field, value, nullable = false) {
        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        }
        if (!value && nullable) {
            return;
        }

        this.#value = ActionTypes.fromValue(value);
        this.field = field;
        Object.freeze(this);
    }

    get value() {
        if (!this.#value) {
            return null;
        }

        return this.#value.value;
    }
}
