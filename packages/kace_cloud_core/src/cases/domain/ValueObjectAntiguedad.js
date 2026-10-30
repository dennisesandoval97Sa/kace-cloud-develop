import { Guards, ValueObject } from '../../shared';

export class ValueObjectAntiguedad extends ValueObject {
    constructor(field, value, nullable = false) {
        super(field, value);

        if (!value && !nullable) {
            throw new Error('The value cannot be null');
        } else if (!value && nullable) {
            return;
        } else {
            Guards.stringType(this);
            Guards.stringMaxLength(this, 100);
        }
    }
}
