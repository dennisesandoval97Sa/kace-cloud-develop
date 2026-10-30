import { ValueObjectUuid } from '../../../shared/index.js';

export class ValueObjectAssignedTo extends ValueObjectUuid {
    /**
     * @param {string} field
     * @param {string} value
     */
    constructor(field, value) {
        const allowsNull = true;
        super(field, value, allowsNull);
    }
}
