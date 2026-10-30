import { Guards } from '../../../shared/domain/guards/Guards.js';
import { ValueObjectString } from '../../../shared/index.js';

export class ValueObjectFilePath extends ValueObjectString {
    constructor(value, nullable = false) {
        super('file_path', value, nullable);
        if (nullable) return;
        Guards.stringMaxLength(this, 500);
        Guards.stringMinLength(this, 5);
    }
}
