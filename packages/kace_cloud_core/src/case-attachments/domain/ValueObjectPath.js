import { Guards, ValueObject } from '../../shared/index.js';

export class ValueObjectPath extends ValueObject {
    constructor(field, value, nullable = false) {
        super(field, value);

        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        }
        if (!value && nullable) {
            return;
        }

        Guards.stringType(this);
        Guards.stringMaxLength(this, 1000);
    }
}
