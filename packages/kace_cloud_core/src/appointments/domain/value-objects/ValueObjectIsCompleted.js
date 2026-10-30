import { ValueObjectBoolean } from '../../../shared/index.js';

export class ValueObjectIsCompleted extends ValueObjectBoolean {
    /**
     * @param {string} field
     * @param {string} value
     */
    constructor(field, value) {
        const allowsNull = true;
        super(field, value, allowsNull);
    }
}
