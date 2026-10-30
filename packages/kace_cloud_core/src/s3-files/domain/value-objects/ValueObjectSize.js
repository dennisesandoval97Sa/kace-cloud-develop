import { ValueObject } from '../../../shared/domain/value-object/ValueObject.js';
import { Guards } from '../../../shared/domain/guards/Guards.js';

export class ValueObjectSize extends ValueObject {
    constructor(value, nullable = false) {
        super('size', Number(value));

        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        }
        if (!value && nullable) {
            return;
        }

        Guards.integerType(this);
        Guards.IntegerInRange(this, 1, Infinity);
    }
}
