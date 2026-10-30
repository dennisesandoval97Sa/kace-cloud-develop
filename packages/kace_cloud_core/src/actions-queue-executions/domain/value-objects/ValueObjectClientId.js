import { ValueObjectUuid } from '../../../shared/index.js';

export class ValueObjectClientId extends ValueObjectUuid {
    constructor(value) {
        super('client_id', value, true);
    }
}
