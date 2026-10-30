import { Guards, ValueObject } from '../../shared/index.js';

export class ValueObjectSessionId extends ValueObject {
    constructor(value, nullable = false) {
        super('session_id', value);
        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        } else if (!value && nullable) {
            return;
        } else {
            Guards.stringType(this);
            Guards.stringMaxLength(this, 100);
        }
    }
}
