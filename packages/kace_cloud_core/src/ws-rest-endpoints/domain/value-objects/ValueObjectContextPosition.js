import { Guards, ValueObjectString } from '../../../shared';

export class ValueObjectContextPosition extends ValueObjectString {
    constructor(value) {
        super('context_position', value);

        Guards.stringMaxLength(this, 255);
    }
}
