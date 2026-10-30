import { Guards, ValueObjectString } from '../../shared';

export class ValueObjectIcon extends ValueObjectString {
    constructor(field, value, isNull) {
        super(field, value, isNull);

        Guards.stringMaxLength(this, 1000);
        Guards.stringMinLength(this, 1);
    }
}
