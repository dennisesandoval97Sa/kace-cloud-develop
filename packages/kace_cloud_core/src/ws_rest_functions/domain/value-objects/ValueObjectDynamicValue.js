import { ValueObjectBoolean } from '../../../shared/domain/value-object/ValueObjectBoolean.js';

export class ValueObjectDynamicValue extends ValueObjectBoolean {
    /**
     * @param {object} value
     */
    constructor(value) {
        super('value_dynamic', value);
    }
}
