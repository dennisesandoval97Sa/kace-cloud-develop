import { ValueObjectString } from '../../../shared/domain/value-object/ValueObjectString.js';
import { Guards } from '../../../shared/domain/guards/Guards.js';

export class ValueObjectFileName extends ValueObjectString {
    constructor(value, nullable = false) {
        super('file_name', value, nullable);

        if (this.value === null) return;

        Guards.stringMaxLength(this, 100);
    }
}
