import { ValueObjectString } from '../../shared/domain/value-object/ValueObjectString.js';
import { Guards } from '../../shared/domain/guards/Guards.js';

export class ValueObjectSchemaName extends ValueObjectString {
    constructor(value) {
        super('name', value, false);
        Guards.stringMaxLength(this, 50);
    }
}
