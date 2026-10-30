import { ValueObjectBoolean } from '../../shared';

export class ValueObjectRequireObservation extends ValueObjectBoolean {
    constructor(field, value, nullable) {
        super(field, value, nullable);
    }
}
