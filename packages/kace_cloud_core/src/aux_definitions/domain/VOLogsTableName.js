import { ValueObjectString } from '../../shared/domain/value-object/ValueObjectString.js';
import { Guards } from '../../shared/domain/guards/Guards.js';

export class VOLogsTableName extends ValueObjectString {
    constructor(value) {
        super('logs_tablename', value, false);

        Guards.stringMaxLength(this, 45);
    }
}
