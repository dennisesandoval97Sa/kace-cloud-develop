import { Guards, ValueObject } from '../../shared/index.js';

export class ValueObjectSize extends ValueObject {
    constructor(field, value, nullable = false) {
        super(field, +value);

        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        }
        if (!value && nullable) {
            return;
        }

        Guards.integerType(this);
        this.#ensureValueIsValid();
    }

    #ensureValueIsValid() {
        if (this.value <= 0) {
            throw new Error(`${this.field} must be a positive number.`);
        }
    }
}
