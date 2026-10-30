import { Aggregates } from '../Aggregates.js';

export class ValueObjectAggregate {
    /** @type {Aggregates} is initialized in the constructor */
    #value;

    constructor(field, value) {
        this.#value = Aggregates.fromValue(value);
        this.field = field;
        Object.freeze(this);
    }

    get value() {
        return this.#value.value;
    }
}
