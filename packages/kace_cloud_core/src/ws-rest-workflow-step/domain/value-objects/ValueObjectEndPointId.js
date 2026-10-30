import { ValueObjectUuid } from '../../../shared/domain/value-object/ValueObjectUuid.js';

export class ValueObjectEndPointId extends ValueObjectUuid {
    /**
     * @param {String} value
     */
    constructor(value) {
        const allowsNull = true;
        super('endpoint_id', value, allowsNull);
    }
}
