import { ValueObject } from './ValueObject';
import { Guards } from '../guards/Guards.js';

export class ValueObjectInt extends ValueObject {
    constructor(field, value, nullable = false) {
        super(field, value);
        const isNull = value === null || value === undefined;
        if (isNull && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        } else if (isNull && nullable) {
            return;
        } else {
            Guards.integerType(this);
        }
    }
}
