import { ValueObjectUuid } from '../../../shared/index.js';

export class ValueObjectActionId extends ValueObjectUuid {
    constructor(value) {
        super('action_id', value, false);
    }
}
