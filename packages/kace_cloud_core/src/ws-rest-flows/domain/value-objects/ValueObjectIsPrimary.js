import { ValueObjectBoolean } from '../../../shared/index.js';

export class ValueObjectIsPrimary extends ValueObjectBoolean {
    constructor(value = true) {
        super('is_primary', value);
    }
}
