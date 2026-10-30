import { Guards } from '../../../shared';
import { ValueObject } from '../../../shared/domain/value-object/ValueObject';

export class ValueObjectLoginEndpoint extends ValueObject {
    constructor(value, nullable = false) {
        super('login_endpoint', value);

        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        }
        if (!value && nullable) {
            return;
        }
        Guards.stringType(this);
        Guards.stringMaxLength(this, 255);
    }
}
