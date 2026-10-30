import { Guards, ValueObjectString } from '../../shared';

export class ValueObjectType extends ValueObjectString {
    constructor(field, value, nullable) {
        super(field, value, nullable);
        Guards.stringMaxLength(this, 100);
        Guards.stringMinLength(this, 5);
    }
}
