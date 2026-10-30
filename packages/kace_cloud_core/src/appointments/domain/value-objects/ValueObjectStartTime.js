import { ValueObjectTimestamp } from '../../../shared/index.js';

export class ValueObjectStartTime extends ValueObjectTimestamp {
    /**
     * @param {string} field
     * @param {string} value
     */
    constructor(field, value) {
        super(field, value);
    }
}
