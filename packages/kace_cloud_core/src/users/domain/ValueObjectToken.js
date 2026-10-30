import { Guards, ValueObject } from '../../shared';

export class ValueObjectToken extends ValueObject {
    constructor(field, value, nullable) {
        super(field, value);
        if (!nullable && !value) throw new Error(`${this.field}: The value cannot be null`);
        if (nullable && !value) return;

        Guards.stringType(this);
        Guards.stringMaxLength(this, 4000);
        Guards.stringMinLength(this, 1);
    }
}
