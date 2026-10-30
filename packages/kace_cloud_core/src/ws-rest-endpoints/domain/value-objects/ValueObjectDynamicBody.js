import { ValueObjectBoolean } from '../../../shared/domain/value-object/ValueObjectBoolean';

export class ValueObjectDynamicBody extends ValueObjectBoolean {
    constructor(value) {
        super('is_dynamic_body', value);
    }
}
