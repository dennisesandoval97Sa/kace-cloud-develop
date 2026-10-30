import { ValueObjectString } from '../../../shared/domain/value-object/ValueObjectString.js';
import { Guards } from '../../../shared/domain/guards/Guards.js';

export class ValueObjectS3FileName extends ValueObjectString {
    constructor(value, nullable = false) {
        super('s3_file_name', value, nullable);

        if (this.value === null) return;

        Guards.stringMaxLength(this, 100);
    }
}
