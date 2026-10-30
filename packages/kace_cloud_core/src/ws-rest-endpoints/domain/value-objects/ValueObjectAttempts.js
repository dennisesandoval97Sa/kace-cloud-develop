import { ValueObjectInt } from '../../../shared/domain/value-object/ValueObjectInt';

export class ValueObjectAttempts extends ValueObjectInt {
    constructor(value) {
        super('attempts', value);
    }
}
