import { ValueObjectUuid } from '../../../shared/domain/value-object/ValueObjectUuid.js';

export class ValueObjectUnsatisfied extends ValueObjectUuid {
    /**
     * @param {String} value
     */
    constructor(value) {
        super('unsatisfied', value, true);
    }
}
