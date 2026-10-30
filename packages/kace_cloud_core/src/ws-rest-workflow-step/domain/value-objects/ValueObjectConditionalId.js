import { ValueObjectUuid } from '../../../shared/domain/value-object/ValueObjectUuid.js';

export class ValueObjectConditionalId extends ValueObjectUuid {
    /**
     * @param {String} value
     */
    constructor(value) {
        super('conditional_id', value, true);
    }
}
