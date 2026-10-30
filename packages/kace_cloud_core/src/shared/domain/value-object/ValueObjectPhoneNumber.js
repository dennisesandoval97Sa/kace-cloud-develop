import { Guards } from '../guards/Guards.js';
import { ValueObject } from './ValueObject.js';

export class ValueObjectPhoneNumber extends ValueObject {
    constructor(field, value, nullable = false) {
        super(field, value);
        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        } else if (!value && nullable) {
            return;
        } else {
            Guards.stringType(this);
            Guards.stringMaxLength(this, 10);
            Guards.stringMinLength(this, 10);
            Guards.stringPattern(this, /^[0-9]*$/, `${this.field}: The phone number must contain only numbers`);
        }
    }
}
