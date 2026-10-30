import { Guards, ValueObjectString } from '../../../shared';

export class ValueObjectHabeasData extends ValueObjectString {
    constructor(field, value, nullable) {
        super(field, value, nullable);

        const isNull = value === null || value === undefined;
        if (isNull && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        } else if (isNull && nullable) {
            return;
        } else {
            Guards.stringMaxLength(this, 100);
        }
    }
}
