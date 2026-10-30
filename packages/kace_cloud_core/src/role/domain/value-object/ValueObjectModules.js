import { ModulesEnums } from '../enums/ModulesEnums.js';

export class ValueObjectModules {
    /** @type {Types} is initialized in the constructor */
    #value;

    constructor(field, value, nullable = false) {
        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        }
        if (!value && nullable) {
            return;
        }
        this.field = field;
        this.#value = ModulesEnums.fromValue(value);
        Object.freeze(this);
    }

    get value() {
        return this.#value ? this.#value.value : null;
    }
}
