import { ValueObject } from '../../../shared/domain/value-object/ValueObject.js';
import { Guards } from '../../../shared/domain/guards/Guards.js';

export class ValueObjectURL extends ValueObject {
    constructor(field, value, nullable = false) {
        super(field, value);

        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        }
        if (!value && nullable) {
            return;
        }

        Guards.stringType(this);
        Guards.stringMaxLength(this, 1000);
    }
}
