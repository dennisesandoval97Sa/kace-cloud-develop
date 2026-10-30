import { ValueObjectBoolean } from '../../../shared/domain/value-object/ValueObjectBoolean';

export class ValueObjectActive extends ValueObjectBoolean {
    constructor(value) {
        super('is_active', value);
    }
}
