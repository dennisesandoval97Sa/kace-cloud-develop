import { Guards } from '../../../shared/domain/guards/Guards.js';
import { ValueObjectString } from '../../../shared/index.js';

export class ValueObjectShortString50 extends ValueObjectString {
    constructor(label, value, nullable = false) {
        super(label, value, nullable);
        if (nullable) return;
        Guards.stringMaxLength(this, 50);
        Guards.stringMinLength(this, 1);
    }
}
