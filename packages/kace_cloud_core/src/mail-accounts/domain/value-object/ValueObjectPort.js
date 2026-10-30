import { Guards, ValueObjectInt } from '../../../shared';

export class ValueObjectPort extends ValueObjectInt {
    constructor(field, value, nullable) {
        super(field, value, nullable);

        if (nullable) return;

        Guards.IntegerInRange(this, 1, 65535);
    }
}
