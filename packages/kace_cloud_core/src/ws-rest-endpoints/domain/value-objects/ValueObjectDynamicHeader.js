import { ValueObjectBoolean } from '../../../shared/domain/value-object/ValueObjectBoolean';

export class ValueObjectDynamicHeader extends ValueObjectBoolean {
    constructor(value) {
        super('is_dynamic_header', value);
    }
}
