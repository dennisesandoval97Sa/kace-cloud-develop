import { ValueObjectString } from '../../../shared/index.js';

export class ValueObjectOperator extends ValueObjectString {
    /**
     * @param {String} value
     */
    constructor(value) {
        super('operator', value, true);
    }
}
