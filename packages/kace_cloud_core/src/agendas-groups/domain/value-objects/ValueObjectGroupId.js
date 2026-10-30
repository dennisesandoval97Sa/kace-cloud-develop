import { ValueObjectUuid } from '../../../shared/index.js';

export class ValueObjectGroupId extends ValueObjectUuid {
    constructor(field, value) {
        super(field, value);
    }
}
