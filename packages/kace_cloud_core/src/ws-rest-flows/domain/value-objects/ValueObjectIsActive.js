import { ValueObjectBoolean } from '../../../shared/index.js';

export class ValueObjectIsActive extends ValueObjectBoolean {
    constructor(value) {
        super('is_active', value);
    }
}
