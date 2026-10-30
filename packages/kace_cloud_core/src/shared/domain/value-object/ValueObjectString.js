import { ValueObject } from './ValueObject.js';
import { Guards } from '../guards/Guards.js';
import { SQLInjectionGuard } from '../guards/SQLInjectionGuard.js';
import { XSSGuard } from '../guards/XSSGuard.js';

export class ValueObjectString extends ValueObject {
    constructor(field, value, nullable = false, maxLength = 30000, skipXssGuard = false, skipSqlGuard = false) {
        super(field, value);
        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        } else if (!value && nullable) {
            return;
        } else {
            Guards.stringType(this);
            value = value.trim();
            Guards.stringMaxLength(this, maxLength);
            if (!skipSqlGuard) {
                SQLInjectionGuard.validate(value, field);
            }
            if (!skipXssGuard) {
                XSSGuard.validate(value);
            }
        }
    }
}
