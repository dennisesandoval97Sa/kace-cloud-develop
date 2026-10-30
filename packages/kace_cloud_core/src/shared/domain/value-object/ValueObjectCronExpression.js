import { ValidationFailError } from '../../errors/ValidationFailError.js';
import { Guards } from '../guards/Guards.js';
import { ValueObject } from './ValueObject.js';

export class ValueObjectCronExpression extends ValueObject {
    static #MONTH_NAMES = {
        JAN: '1',
        FEB: '2',
        MAR: '3',
        APR: '4',
        MAY: '5',
        JUN: '6',
        JUL: '7',
        AUG: '8',
        SEP: '9',
        OCT: '10',
        NOV: '11',
        DEC: '12',
    };

    static #DAY_NAMES = {
        SUN: '7',
        MON: '1',
        TUE: '2',
        WED: '3',
        THU: '4',
        FRI: '5',
        SAT: '6',
    };

    constructor(field, value, nullable = false) {
        super(field, value);

        if (!nullable && !value) {
            throw new ValidationFailError(`The value cannot be null`, field);
        }

        if (nullable && !value) return;

        Guards.stringType(this);
        this.#validate(value);
    }

    #validate(value) {
        const trimmed = value.trim();

        if (!trimmed) {
            throw new ValidationFailError('Cron expression cannot be empty', this.field);
        }

        const fields = trimmed.split(/\s+/);

        if (fields.length < 5 || fields.length > 6) {
            throw new ValidationFailError(`Cron expression must have 5 or 6 fields, got ${fields.length}`, this.field);
        }

        let [minutes, hours, dayOfMonth, month, dayOfWeek, year] = fields;

        month = this.#normalizeField(month, 'month');
        dayOfWeek = this.#normalizeField(dayOfWeek, 'dayOfWeek');

        this.#validateField(minutes, 'minutes', 0, 59);
        this.#validateField(hours, 'hours', 0, 23);
        this.#validateField(dayOfMonth, 'day-of-month', 1, 31);
        this.#validateField(month, 'month', 1, 12);
        this.#validateField(dayOfWeek, 'day-of-week', 0, 7);

        if (year !== undefined) {
            this.#validateField(year, 'year', 1970, 2099);
        }

        return trimmed;
    }

    #normalizeField(field, type) {
        if (type === 'month') {
            return field.replace(
                /\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b/g,
                (match) => ValueObjectCronExpression.#MONTH_NAMES[match]
            );
        }

        if (type === 'dayOfWeek') {
            return field.replace(
                /\b(SUN|MON|TUE|WED|THU|FRI|SAT)\b/g,
                (match) => ValueObjectCronExpression.#DAY_NAMES[match]
            );
        }

        return field;
    }

    #validateField(field, fieldName, min, max) {
        if (field === '*') return;
        if (field === '?' && (fieldName === 'day-of-month' || fieldName === 'day-of-week')) return;

        if (field.includes(',')) {
            const values = field.split(',');
            for (const value of values) {
                this.#validateSingleValue(value.trim(), fieldName, min, max);
            }
            return;
        }

        if (field.includes('-')) {
            const parts = field.split('-');
            if (parts.length !== 2) {
                throw new ValidationFailError(`Invalid range format in ${fieldName}: ${field}`, this.field);
            }
            const start = parseInt(parts[0]);
            const end = parseInt(parts[1]);

            if (isNaN(start) || isNaN(end)) {
                throw new ValidationFailError(`Invalid range values in ${fieldName}: ${field}`, this.field);
            }

            if (start > end) {
                throw new ValidationFailError(
                    `Invalid range in ${fieldName}: start (${start}) must be <= end (${end})`,
                    this.field
                );
            }

            this.#validateNumber(start, fieldName, min, max);
            this.#validateNumber(end, fieldName, min, max);
            return;
        }

        if (field.includes('/')) {
            const parts = field.split('/');
            if (parts.length !== 2) {
                throw new ValidationFailError(`Invalid step format in ${fieldName}: ${field}`, this.field);
            }

            const base = parts[0];
            const step = parseInt(parts[1]);

            if (isNaN(step) || step <= 0) {
                throw new ValidationFailError(`Invalid step value in ${fieldName}: ${parts[1]}`, this.field);
            }

            if (base === '*') return;

            this.#validateSingleValue(base, fieldName, min, max);
            return;
        }

        this.#validateSingleValue(field, fieldName, min, max);
    }

    #validateSingleValue(value, fieldName, min, max) {
        const num = parseInt(value);
        if (isNaN(num)) {
            throw new ValidationFailError(`Invalid numeric value in ${fieldName}: ${value}`, this.field);
        }
        this.#validateNumber(num, fieldName, min, max);
    }

    #validateNumber(num, fieldName, min, max) {
        if (num < min || num > max) {
            throw new ValidationFailError(`${fieldName} value ${num} is out of range [${min}-${max}]`, this.field);
        }
    }

    getFields() {
        const fields = this.value.split(/\s+/);

        const result = {
            minutes: fields[0],
            hours: fields[1],
            dayOfMonth: fields[2],
            month: fields[3],
            dayOfWeek: fields[4],
        };

        if (fields.length === 6) {
            result.year = fields[5];
        }

        return result;
    }

    getDescription() {
        const fields = this.getFields();
        let description = '';

        description += `At ${fields.minutes} minutes past ${fields.hours} hour(s)`;

        if (fields.dayOfMonth !== '*') {
            description += ` on day ${fields.dayOfMonth} of the month`;
        }

        if (fields.month !== '*') {
            description += ` in month ${fields.month}`;
        }

        if (fields.dayOfWeek !== '*') {
            description += ` on ${fields.dayOfWeek} day(s) of the week`;
        }

        if (fields.year !== undefined && fields.year !== '*') {
            description += ` in year ${fields.year}`;
        }

        return description;
    }

    static isValid(expression) {
        try {
            new ValueObjectCronExpression('cronExpression', expression);
            return true;
        } catch {
            return false;
        }
    }
}
