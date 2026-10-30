import { ValueObjectTimestamp } from '../../../shared/index.js';

export class ValueObjectEndTime extends ValueObjectTimestamp {
    /**
     * @param {string} field
     * @param {string} value
     */
    constructor(field, value) {
        super(field, value);
    }
}
