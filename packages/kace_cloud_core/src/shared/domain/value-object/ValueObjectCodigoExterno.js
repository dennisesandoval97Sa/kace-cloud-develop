import { ValueObject } from './ValueObject.js';
import { Guards } from '../guards/Guards.js';

export class ValueObjectCodigoExterno extends ValueObject {
    constructor(field, value, nullable = false) {
        super(field, value);
        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        } else if (!value && nullable) {
            return;
        } else {
            Guards.stringType(this);
            Guards.stringMaxLength(this, 45);
        }
    }
}
