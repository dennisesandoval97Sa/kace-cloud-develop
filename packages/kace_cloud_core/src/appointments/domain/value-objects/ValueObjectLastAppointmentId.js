import { ValueObjectUuid } from '../../../shared/index.js';

export class ValueObjectLastAppointmentId extends ValueObjectUuid {
    /**
     * @param {string} field
     * @param {string} value
     */
    constructor(field, value) {
        const allowsNull = true;
        super(field, value, allowsNull);
    }
}
