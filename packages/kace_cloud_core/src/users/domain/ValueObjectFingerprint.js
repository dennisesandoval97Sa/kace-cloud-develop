import { Guards, Helper, ValueObject } from '../../shared/index.js';

export class ValueObjectFingerprint extends ValueObject {
    constructor(field, value, nullable = false) {
        super(field, value);
        if (!value && !nullable) {
            Helper.logError(`${this.field}: The value cannot be null`);
            throw new Error(`${this.field}: The value cannot be null`);
        }
        if (!value && nullable) {
            return;
        }
        Guards.stringType(this);
    }
}
