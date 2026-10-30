import { ValidationFailError, ValueObject } from '../../../shared';

export class ValueObjectTime extends ValueObject {
    #TIME_REGEX = new RegExp('^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$');

    constructor(field, value) {
        super(field, value);
        this.#validateTimeFormat(value);
    }

    #validateTimeFormat(value) {
        if (!this.#TIME_REGEX.test(value)) {
            throw new ValidationFailError(`Invalid time format for ${this.field}: "${value}"`, this.field);
        }
    }
}
