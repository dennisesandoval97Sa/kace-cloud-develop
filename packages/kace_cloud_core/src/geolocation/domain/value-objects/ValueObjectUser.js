import { ValueObjectUuid } from '../../../shared/index.js';

export class ValueObjectUser extends ValueObjectUuid {
    /**
     * @param {string} field
     * @param {string} value
     */
    constructor(field, value) {
        super(field, value);
    }
}
