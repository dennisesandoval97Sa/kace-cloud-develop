import { ValueObjectString } from '../../../shared/domain/value-object/ValueObjectString.js';

export class ValueObjectStaticValue extends ValueObjectString {
    /**
     * @param {object} value
     * @param {nullable} nullable
     */
    constructor(value, nullable = true) {
        super('value_static', value, nullable);
    }
}
