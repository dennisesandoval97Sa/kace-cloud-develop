import { Guards, ValueObject } from '../../shared/index.js';

export default class ValueObjectPassword extends ValueObject {
    constructor(field, value, nullable = false) {
        super(field, value, nullable);
        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        } else if (!value && nullable) {
            return;
        } else {
            Guards.stringType(this);
        }
    }
}
