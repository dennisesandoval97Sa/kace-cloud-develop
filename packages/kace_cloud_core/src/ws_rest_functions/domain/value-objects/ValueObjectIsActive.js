import { ValueObjectBoolean } from '../../../shared/domain/value-object/ValueObjectBoolean.js';

export class ValueObjectIsActive extends ValueObjectBoolean {
    /**
     * @param {object} value
     */
    constructor(value) {
        super('is_active', value);
    }
}
