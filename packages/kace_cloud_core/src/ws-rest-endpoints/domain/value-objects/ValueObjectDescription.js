import { ValueObjectDescription as ValueObjectDescriptionBase } from '../../../shared/domain/value-object/ValueObjectDescription.js';

export class ValueObjectDescription extends ValueObjectDescriptionBase {
    constructor(value) {
        super('description', value);
    }
}
