import { Guards } from '../../shared/domain/guards/Guards';
import { ValueObjectString } from '../../shared/domain/value-object/ValueObjectString';

export class ValueObjectSecret extends ValueObjectString {
    constructor(field, value, nullable) {
        super(field, value, nullable);
        Guards.stringMaxLength(this, 10000);
        Guards.stringMinLength(this, 1);
    }
}
