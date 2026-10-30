import { ValueObjectBoolean } from '../../../shared/index.js';

export class ValueObjectIsForWeekend extends ValueObjectBoolean {
    constructor(field, value) {
        super(field, value, true);
    }

    get value() {
        return super.value ?? false;
    }
}
