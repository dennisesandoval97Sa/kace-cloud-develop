import { ValueObjectDescription as ValueObjectDescriptionBase } from '../../../shared/domain/value-object/ValueObjectDescription.js';

export class ValueObjectDescription extends ValueObjectDescriptionBase {
    /**
     * @param {object} value
     */
    constructor(value) {
        super('description', value);
    }
}
