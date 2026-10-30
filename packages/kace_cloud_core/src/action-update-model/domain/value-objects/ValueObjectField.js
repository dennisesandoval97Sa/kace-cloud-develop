import { Guards } from '../../../shared/domain/guards/Guards.js';
import { ValueObjectString } from '../../../shared/domain/value-object/ValueObjectString.js';

export class ValueObjectField extends ValueObjectString {
    constructor(field, value, nullable = false) {
        super(field, value, nullable);

        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        }
        if (!value && nullable) {
            return;
        }
        Guards.stringType(this);
        Guards.stringMaxLength(this, 100);
    }
}
