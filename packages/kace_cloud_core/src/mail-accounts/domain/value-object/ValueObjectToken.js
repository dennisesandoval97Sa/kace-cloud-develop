import { Guards, ValueObjectString } from '../../../shared';

export class ValueObjectToken extends ValueObjectString {
    constructor(field, value, nullable) {
        super(field, value, nullable);

        if (nullable) return;

        Guards.stringMaxLength(this, 10000);
    }
}
