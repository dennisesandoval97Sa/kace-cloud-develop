import { ValueObjectString } from '../../shared/domain/value-object/ValueObjectString.js';
import { Guards } from '../../shared/domain/guards/Guards.js';

export class ValueObjectExternalId extends ValueObjectString {
    constructor(field, value, nullable = true) {
        super(field, value, nullable);

        if (this.value === null) return;

        Guards.stringMaxLength(this, 45);
    }
}
