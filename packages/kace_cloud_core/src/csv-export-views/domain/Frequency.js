import { Helper } from '../../shared';

export class Frequency {
    static HOURS = new Frequency('HOURS', 'hours');
    static DAYS = new Frequency('DAYS', 'days');
    static WEEKS = new Frequency('WEEKS', 'weeks');
    static MONTHS = new Frequency('MONTHS', 'months');

    constructor(key, value) {
        this.#ensureIsValidFrequency(value);
        this.key = key;
        this.value = value;

        Object.freeze(this);
    }

    static fromValue(value) {
        const map = {
            hours: Frequency.HOURS,
            days: Frequency.DAYS,
            weeks: Frequency.WEEKS,
            months: Frequency.MONTHS,
        };

        if (!map[value]) {
            Helper.logError(`Invalid frequency value: ${value}`);
            throw new Error(`Invalid frequency value: ${value}`);
        }
        return map[value];
    }

    #ensureIsValidFrequency(value) {
        const validValue = new Set(['hours', 'days', 'weeks', 'months']);
        if (!validValue.has(value)) {
            Helper.logError(`The value must be a valid Frequency value: ${value}`);
            throw new Error(`The value must be a valid Frequency value: ${value}`);
        }
    }

    static toJson() {
        const json = {};
        for (const key of Object.keys(Frequency)) {
            if (Frequency[key] instanceof Frequency) {
                json[key] = Frequency[key].value;
            }
        }
        return json;
    }
}
