import { ValueObject } from './ValueObject.js';
import { Guards } from '../guards/Guards.js';

export class ValueObjectBoolean extends ValueObject {
    constructor(field, value, nullable = false) {
        super(field, value);

        if (!nullable && (value === undefined || value === null || value === '')) {
            throw new Error(`${field}: The value cannot be null`);
        } else if (nullable && (value === undefined || value === null || value === '')) {
            return;
        } else {
            Guards.booleanType(this);
        }
    }
}
