import { ValueObjectUuid } from '../../../shared/domain/value-object/ValueObjectUuid.js';

export class ValueObjectFlowId extends ValueObjectUuid {
    /**
     * @param {String} value
     */
    constructor(value) {
        super('flow_id', value);
    }
}
