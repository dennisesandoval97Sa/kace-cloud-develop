import { ValueObjectString } from '../../../shared/index.js';

export class ValueObjectIp4Address extends ValueObjectString {
    /**
     * @param {string} field
     * @param {string} value
     */
    constructor(field, value) {
        super(field, value);
    }
}
