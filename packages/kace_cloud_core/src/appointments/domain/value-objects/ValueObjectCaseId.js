import { ValueObjectUuid } from '../../../shared/index.js';

export class ValueObjectCaseId extends ValueObjectUuid {
    /**
     * @param {string} field
     * @param {string} value
     */
    constructor(field, value) {
        super(field, value);
    }
}
