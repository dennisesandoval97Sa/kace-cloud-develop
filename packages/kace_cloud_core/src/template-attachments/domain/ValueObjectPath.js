import { ValueObjectString } from '../../shared/index.js';
import { Guards } from '../../shared/index.js';

export class ValueObjectPath extends ValueObjectString {
    constructor(field, value, nullable = false) {
        super(field, value, nullable);

        if (this.value === null) return;

        Guards.stringMaxLength(this, 1000);
    }
}
