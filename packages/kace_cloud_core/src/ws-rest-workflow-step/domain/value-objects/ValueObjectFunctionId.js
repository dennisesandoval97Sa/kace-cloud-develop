import { ValueObjectUuid } from '../../../shared/domain/value-object/ValueObjectUuid.js';

export class ValueObjectFunctionId extends ValueObjectUuid {
    /**
     * @param {String} value
     */
    constructor(value) {
        const allowsNull = true;
        super('function_id', value, allowsNull);
    }
}
