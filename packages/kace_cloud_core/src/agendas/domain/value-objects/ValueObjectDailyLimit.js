import { Guards, ValueObjectInt } from '../../../shared/index.js';

export class ValueObjectDailyLimit extends ValueObjectInt {
    constructor(field, value) {
        super(field, value);
        Guards.IntegerInRange(this, 0, 1000);
    }
}
