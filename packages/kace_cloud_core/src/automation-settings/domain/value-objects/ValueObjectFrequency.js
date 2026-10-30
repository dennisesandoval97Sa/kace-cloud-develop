import { ValueObjectString } from '../../../shared/domain/value-object/ValueObjectString.js';

export class ValueObjectFrequency extends ValueObjectString {
    constructor(value) {
        super('frequency', value);
    }
}
