import { ValueObject } from '../../shared/domain/value-object/ValueObject.js';
import { Guards } from '../../shared/domain/guards/Guards.js';

export class ValueObjectHolidayDates extends ValueObject {
    constructor(field, value, nullable = false) {
        super(field, value);

        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        }
        if (!value && nullable) {
            return;
        }

        Guards.arrayType(this);
        this.#ensureValueIsValid();
    }

    #ensureValueIsValid() {
        this.value.forEach((date, index) => {
            if (!this.#isValidDateString(date)) {
                throw new Error(`${this.field}[${index}] - (${date}) debe ser una fecha válida en formato YYYY-MM-DD`);
            }
        });
    }

    #isValidDateString(dateString) {
        const regex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
        return regex.test(dateString) && !isNaN(Date.parse(dateString));
    }
}
