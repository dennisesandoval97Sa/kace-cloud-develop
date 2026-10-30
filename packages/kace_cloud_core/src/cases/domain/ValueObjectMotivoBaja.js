import { Guards, ValueObjectString } from '../../shared/index.js';

export class ValueObjectMotivoBaja extends ValueObjectString {
    constructor(field, value, nullable = false) {
        super(field, value, nullable);

        if (!value && !nullable) {
            throw new Error('The value cannot be null');
        } else if (!value && nullable) {
            return;
        } else {
            Guards.stringType(this);
            Guards.stringMaxLength(this, 5000);
        }
    }
}
