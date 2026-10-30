import { Guards, ValueObjectString } from '@kace/core/src/shared';

export class ValueObjectBoardName extends ValueObjectString {
    constructor(value) {
        super('name', value, false);
        Guards.stringMaxLength(this, 50);
    }
}
