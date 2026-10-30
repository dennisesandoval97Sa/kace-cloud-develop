import { InvalidArgumentError } from '../../shared/errors/InvalidArgumentError.js';

export class Types {
    static MINUTES = new Types('MINUTES', 'Minutes');
    static HOURS = new Types('HOURS', 'Hours');
    static DAYS = new Types('DAYS', 'Days');

    constructor(key, value) {
        this.#ensureIsValidMedition(value);

        this.key = key;
        this.value = value;

        Object.freeze(this);
    }

    static fromValue(value) {
        if (value === 'Minutes') {
            return Types.MINUTES;
        }
        if (value === 'Hours') {
            return Types.HOURS;
        }
        if (value === 'Days') {
            return Types.DAYS;
        }
        // A client sends this value: a plain Error turned an unknown type into a 500.
        throw new InvalidArgumentError('Invalid value');
    }

    #ensureIsValidMedition(value) {
        if (!value) {
            throw new Error('The value cannot be null');
        }
        if (value !== 'Minutes' && value !== 'Hours' && value !== 'Days') {
            throw new Error(`The value must be a valid Medition: ${value}`);
        }
    }

    static toJson() {
        return {
            MINUTES: Types.MINUTES.value,
            HOURS: Types.HOURS.value,
            DAYS: Types.DAYS.value,
        };
    }
}
