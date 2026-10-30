import { Guards, ValueObject } from '../../../shared';

export class ValueObjectPriority extends ValueObject {
    constructor(field, value, nullable = false) {
        super(field, +value);

        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        }
        if (!value && nullable) {
            return;
        }

        Guards.integerType(this);
        Guards.IntegerInRange(this, 1, 99);
    }
}
