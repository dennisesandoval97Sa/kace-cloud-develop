import { ValueObject } from './ValueObject.js';
import { Guards } from '../guards/Guards.js';

export class ValueObjectDecimal extends ValueObject {
    constructor(field, value, nullable = false) {
        super(field, value);
        const isNull = value === null || value === undefined;

        if (isNull && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        } else if (isNull && nullable) {
            return;
        } else {
            Guards.decimalType(this);
        }
    }
}
