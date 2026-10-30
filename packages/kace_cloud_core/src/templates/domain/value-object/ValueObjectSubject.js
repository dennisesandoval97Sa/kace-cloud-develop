import { Guards, ValueObjectString } from '../../../shared/index.js';

export class ValueObjectSubject extends ValueObjectString {
    constructor(field, value, nullable = false) {
        super(field, value, nullable);

        Guards.stringMaxLength(this, 150);
    }
}
