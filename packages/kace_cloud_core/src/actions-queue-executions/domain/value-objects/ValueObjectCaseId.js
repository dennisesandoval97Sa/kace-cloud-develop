import { ValueObjectUuid } from '../../../shared/index.js';

export class ValueObjectCaseId extends ValueObjectUuid {
    constructor(value) {
        super('case_id', value, true);
    }
}
