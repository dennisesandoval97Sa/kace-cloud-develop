import { Guards } from '../../../shared';
import { ValueObjectString } from '../../../shared/domain/value-object/ValueObjectString';

export class ValueObjectScope extends ValueObjectString {
    constructor(value, nullable = false) {
        super('scope', value ?? null, nullable);

        if (this.value === null) return;

        Guards.stringMaxLength(this, 255);
    }
}

