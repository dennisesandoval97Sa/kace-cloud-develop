import { Guards, Helper, ValidationFailError, ValueObject } from '../../../shared/index.js';

export class ValueObjectTimeFilter extends ValueObject {
    constructor(field, value, nullable = false) {
        super(field, value);

        if (!value && !nullable) {
            throw new Error(`${this.field}: The value cannot be null`);
        }
        if (!value && nullable) {
            return;
        }

        Guards.objectType(this);
        this.#ensureTimeFilterIsValid();
    }

    #ensureTimeFilterIsValid() {
        try {
            this.#validateField(this.value.field);
            this.#validateInterval(this.value.interval);
            this.#validateUnit(this.value.unit);
            this.#validateReference(this.value.reference);
        } catch (error) {
            Helper.logError(`${this.field}: Invalid time_filter format - ${error.message}`);
            throw new ValidationFailError(`Invalid time_filter format - ${error.message}`, this.field);
        }
    }

    #validateField(field) {
        const validReferences = ['created_at', 'updated_at', 'fecha'];
        if (!validReferences.includes(field)) {
            Helper.logError(`${this.field}.field must be one of: ${validReferences.join(', ')}`);
            throw new ValidationFailError(`must be one of: ${validReferences.join(', ')}`, `${this.field}.field`);
        }
    }

    #validateInterval(interval) {
        if (typeof +interval !== 'number' || +interval <= 0) {
            Helper.logError(`${this.field}.interval must be a positive number`);
            throw new ValidationFailError(`must be a positive number`, `${this.field}.interval`);
        }
    }

    #validateUnit(unit) {
        const validUnits = ['hours', 'days', 'weeks', 'months'];
        if (!validUnits.includes(unit)) {
            Helper.logError(`${this.field}.unit must be one of: ${validUnits.join(', ')}`);
            throw new ValidationFailError(`must be one of: ${validUnits.join(', ')}`, `${this.field}.unit`);
        }
    }

    #validateReference(reference) {
        const validReferences = ['now', 'start_of_day', 'start_of_month'];
        if (!validReferences.includes(reference)) {
            Helper.logError(`${this.field}.reference must be one of: ${validReferences.join(', ')}`);
            throw new ValidationFailError(`must be one of: ${validReferences.join(', ')}`, `${this.field}.reference`);
        }
    }

    /**
     * Converts the time filter to an SQL query using a specified interval.
     * Uses either the current date (default) or a custom date.
     *
     * @param {dayjs} currentDate - Custom date (optional). Defaults to `NOW()`.
     * @returns {string} SQL query string.
     */
    toSQL(currentDate = null) {
        const interval = `${this.value.interval} ${this.value.unit}`;
        const baseDate = currentDate ? currentDate.format('YYYY-MM-DD HH:mm:ss') : 'NOW()';

        switch (this.value.reference) {
            case 'now':
                return `(${baseDate}) - INTERVAL '${interval}'`;
            case 'start_of_day':
                return `DATE_TRUNC('day', ${baseDate}) - INTERVAL '${interval}'`;
            case 'start_of_month':
                return `DATE_TRUNC('month', ${baseDate}) - INTERVAL '${interval}'`;
            default:
                throw new Error('Invalid time reference');
        }
    }

    toSQLite(currentDate = null) {
        const interval = `${this.value.interval} ${this.value.unit}`;
        const baseDate = currentDate ? currentDate.format('YYYY-MM-DD HH:mm:ss') : 'CURRENT_TIMESTAMP';

        switch (this.value.reference) {
            case 'now':
                return `DATETIME(${baseDate}, '-${interval}')`;
            case 'start_of_day':
                return `STRFTIME("%Y-%m-%d 00:00:00", ${baseDate}) - INTERVAL '${interval}'`;
            case 'start_of_month':
                return `STRFTIME("%Y-%m-01 00:00:00", ${baseDate}) - INTERVAL '${interval}'`;
            default:
                throw new Error('Invalid time reference');
        }
    }
}
