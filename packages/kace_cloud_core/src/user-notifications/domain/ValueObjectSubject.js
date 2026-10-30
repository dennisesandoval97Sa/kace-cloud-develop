import { ValueObjectString } from '../../shared/domain/value-object/ValueObjectString.js';
import { Guards } from '../../shared/domain/guards/Guards.js';

export class ValueObjectSubject extends ValueObjectString {
    constructor(field, value, nullable = false) {
        super(field, value, nullable);

        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        }
        if (!value && nullable) {
            return;
        }
        Guards.stringMaxLength(this, 25);
    }
}
