import { Guards, ValueObjectString } from '../../../shared';

export class ValueObjectCode extends ValueObjectString {
    constructor(field, value, nullable) {
        super(field, value, nullable);

        if (nullable) return;

        Guards.stringMaxLength(this, 1000);
    }
}
