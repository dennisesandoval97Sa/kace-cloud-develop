import { ValueObject } from '../../shared/domain/value-object/ValueObject';
import { Guards } from '../../shared/domain/guards/Guards';
import { Helper } from '../../shared';

export class ValueObjectWorkDays extends ValueObject {
    constructor(field, value, nullable = false) {
        super(field, value);

        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        }
        if (!value && nullable) {
            return;
        }

        Guards.objectType(this);
        this.#ensureValueIsValid();
    }

    #ensureValueIsValid() {
        const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

        for (const day in this.value) {
            if (!validDays.includes(day)) {
                Helper.logError(`${day} is not a valid day in ${this.field}`);
                throw new Error(`${day} is not a valid day in ${this.field}`);
            }

            const { start, end } = this.value[day];
            if (!this.#isValidTimeString(start) || !this.#isValidTimeString(end)) {
                Helper.logError(`Invalid times for ${day} in ${this.field}`);
                throw new Error(`Invalid times for ${day} in ${this.field}`);
            }
        }
    }

    #isValidTimeString(timeString) {
        const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
        return timeRegex.test(timeString);
    }
}
