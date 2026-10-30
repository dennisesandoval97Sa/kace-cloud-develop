import { ValueObjectJson } from '../../../shared/index.js';

export class ValueObjectMetadata extends ValueObjectJson {
    /**
     * @param {string} field
     * @param {object} value
     */
    constructor(field, value) {
        super(field, value, true);
    }
}
