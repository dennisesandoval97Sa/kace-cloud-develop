import { Guards, ValidationFailError, ValueObject } from '../../../shared';

export class ValueObjectInterval extends ValueObject {
    constructor(field, value, nullable = false) {
        super(field, value);
        if (!value && !nullable) {
            throw new ValidationFailError('The value cannot be null', this.field);
        }
        if (!value && nullable) {
            return;
        }
        Guards.integerType(this);
        Guards.IntegerInRange(this, 1, 365);
    }
}
