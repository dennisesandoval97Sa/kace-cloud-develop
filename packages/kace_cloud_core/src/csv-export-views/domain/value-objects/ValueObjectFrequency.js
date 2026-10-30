import { ValueObjectEnum } from '../../../shared';
import { Frequency } from '../Frequency';

export class ValueObjectFrequency extends ValueObjectEnum {
    constructor(field, value, nullable) {
        super(field, value, Frequency.toJson(), nullable);
    }
}
