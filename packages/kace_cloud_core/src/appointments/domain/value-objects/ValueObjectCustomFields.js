import { ValueObjectJson } from '../../../shared/index.js';

export class ValueObjectCustomFields extends ValueObjectJson {
    /**
     * @param {string} field
     * @param {object} value
     */
    constructor(field, value) {
        const allowsNull = true;
        super(field, value, allowsNull);
    }
}
