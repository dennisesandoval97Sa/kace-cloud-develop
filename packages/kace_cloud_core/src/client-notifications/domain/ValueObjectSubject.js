import { ValueObjectString } from '../../shared/domain/value-object/ValueObjectString.js';
import { Guards } from '../../shared/domain/guards/Guards.js';

export class ValueObjectSubject extends ValueObjectString {
    constructor(field, value, nullable = false) {
        super(field, value, nullable);

        if (this.value === null) return;

        Guards.stringMaxLength(this, 25);
    }
}
