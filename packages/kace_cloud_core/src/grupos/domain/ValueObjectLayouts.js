import { ValueObjectJson } from '../../shared/domain/value-object/ValueObjectJson';

export class ValueObjectLayouts extends ValueObjectJson {
    constructor(field, value, nullable) {
        super(field, value, nullable);
        if (nullable) return;
    }
}
