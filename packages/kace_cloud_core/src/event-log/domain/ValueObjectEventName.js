import { Guards, ValueObjectString } from '../../shared/index.js';

export class ValueObjectEventName extends ValueObjectString {
    constructor(label, value, nullable = false) {
        super(label, value, nullable);
        if (nullable) return;
        Guards.stringMaxLength(this, 255);
        Guards.stringMinLength(this, 1);
    }
}
