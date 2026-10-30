import { ValueObjectString } from '../../shared/domain/value-object/ValueObjectString.js';
import { Guards } from '../../shared/domain/guards/Guards.js';
import { ValidationFailError } from '../../shared/index.js';

export class VOTableName extends ValueObjectString {
    constructor(value) {
        super('tablename', value, false);

        Guards.stringMaxLength(this, 45);

        if (!value.startsWith('aux_')) {
            throw new ValidationFailError(`the tableName must be starts with "aux_".`, value);
        }

        if ((value.match(/aux_/g) || []).length > 1) {
            throw new ValidationFailError(`Invalid tableName value`, value);
        }
    }
}
