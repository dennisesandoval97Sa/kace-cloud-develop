import { ValueObjectUuid } from '../../../shared/domain/value-object/ValueObjectUuid.js';

export class ValueObjectSatisfied extends ValueObjectUuid {
    /**
     * @param {String} value
     */
    constructor(value) {
        super('satisfied', value, true);
    }
}
