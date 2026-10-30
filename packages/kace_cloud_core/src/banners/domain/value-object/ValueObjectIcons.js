import { Guards, ValueObjectString } from '../../../shared';

export class ValueObjectIcons extends ValueObjectString {
    constructor(field, value, nullable = false) {
        super(field, value, nullable);
        Guards.stringMaxLength(this, 100);
    }
}
