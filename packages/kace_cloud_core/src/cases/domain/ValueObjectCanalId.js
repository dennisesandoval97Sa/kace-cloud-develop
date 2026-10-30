import { Guards, ValueObjectInt } from '../../shared';

export class ValueObjectCanalId extends ValueObjectInt {
    constructor(field, value, nullable) {
        super(field, value, nullable);
        if (value === null) return;
        Guards.IntegerInRange(this, 1, 50);
    }
}
