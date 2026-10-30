import { AutomationSettingsFinder } from './AutomationSettingsFinder.js';

export const AUTOMATION_NOT_APPLICABLE_REASON = {
    AUTOMATION_NOT_FOUND: 'automation_not_found',
    WINDOW_NOT_STARTED: 'automation_window_not_started',
    WINDOW_EXPIRED: 'automation_window_expired',
    INVALID_CRON: 'invalid_cron',
    CRON_MISMATCH: 'cron_mismatch',
};

export class AutomationValidationService {
    /**
     * @Type {AutomationSettingsFinder} is initialized in the constructor
     */
    #automationSettingsFinder;

    /**
     * @type {Object} monthMap - Maps month abbreviations to their corresponding numbers.
     *
     * Use `monthMap` to convert month abbreviations (e.g., 'JAN', 'FEB') to their corresponding numbers (e.g., '1', '2').
     */
    #monthMap = {
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

    /**
     * @type {Object} dayOfWeekMap - Maps day of the week abbreviations to their corresponding numbers.
     *
     * Use `dayOfWeekMap` to convert day of the week abbreviations (e.g., 'SUN', 'MON') to their corresponding numbers (e.g., '0', '1').
     */
    #dayOfWeekMap = {
        MON: '1',
        TUE: '2',
        WED: '3',
        THU: '4',
        FRI: '5',
        SAT: '6',
        SUN: '7',
    };

    /**
     * Constructs a new instance of AutomationValidationService.
     * @param {KnexAutomationSettingsRepository} repository - The repository used to find AutomationSettings.
     */
    constructor(repository) {
        this.#automationSettingsFinder = new AutomationSettingsFinder(repository);
    }

    /**
     * Validates the automation setting based on its id.
     * @param {*} id - The id of the automation setting to be validated.
     * @returns {Promise<boolean>} - Returns true if the automation setting is valid and should run, false otherwise.
     */
    async execute(id) {
        const { applicable } = await this.evaluate(id);
        return applicable;
    }

    /**
     * Like execute(), but explains WHY the automation is not applicable so the
     * caller can surface it (e.g. assignment-run observability).
     * @param {*} id - The id of the automation setting to be validated.
     * @returns {Promise<{applicable: boolean, reason: string|null}>} reason is one of AUTOMATION_NOT_APPLICABLE_REASON when applicable=false.
     */
    async evaluate(id) {
        const automationSetting = await this.#automationSettingsFinder.execute(id);
        if (!automationSetting || automationSetting.isDeleted()) {
            return { applicable: false, reason: AUTOMATION_NOT_APPLICABLE_REASON.AUTOMATION_NOT_FOUND };
        }

        const dateNow = new Date();

        // Negaciones (y no <) para que una fecha inválida (NaN) también descarte, igual que antes.
        if (!(new Date(automationSetting.start_date.value) <= dateNow)) {
            return { applicable: false, reason: AUTOMATION_NOT_APPLICABLE_REASON.WINDOW_NOT_STARTED };
        }
        if (!(dateNow <= new Date(automationSetting.end_date.value))) {
            return { applicable: false, reason: AUTOMATION_NOT_APPLICABLE_REASON.WINDOW_EXPIRED };
        }

        if (!this.#validateLength(automationSetting.frequency.value)) {
            return { applicable: false, reason: AUTOMATION_NOT_APPLICABLE_REASON.INVALID_CRON };
        }
        if (!this.#shouldRun(automationSetting.frequency.value, dateNow)) {
            return { applicable: false, reason: AUTOMATION_NOT_APPLICABLE_REASON.CRON_MISMATCH };
        }

        return { applicable: true, reason: null };
    }

    /**
     * normalizes the month or day of the week field in the cron expression.
     * @param {String} cronField part of the cron expression
     * @param {String} fieldName name of the field to be normalized
     * - `month`: The month of the date.
     * - `dayOfWeek`: The day of the week of the date.
     * - otherwise, it will return the cronField as is.
     * @returns {String} - Returns the normalized cron field.
     */
    #normalizeMonthOrDayWeek(cronField, fieldName) {
        if (fieldName === 'month' && this.#monthMap[cronField.toUpperCase()]) {
            return this.#monthMap[cronField.toUpperCase()];
        }
        if (fieldName === 'dayOfWeek' && this.#dayOfWeekMap[cronField.toUpperCase()]) {
            return this.#dayOfWeekMap[cronField.toUpperCase()];
        }
        return cronField;
    }

    /**
     * Validates the cron field against the current value.
     *
     * @param {String} cronField part of the cron expression
     * @param {Number} currentValue current value of the date
     * @param {String} fieldName name of the field to be validated
     * @returns {Boolean} true if the cron expression is valid for the current value, false otherwise
     */
    #isMatch(cronField, currentValue, fieldName) {
        if (cronField === '*' || cronField === '?') return true;

        cronField = this.#normalizeMonthOrDayWeek(cronField, fieldName);

        if (cronField.includes(',')) {
            return cronField.split(',').some((part) => this.#isMatch(part, currentValue, fieldName));
        }

        if (cronField.includes('-')) {
            const [start, end] = cronField.split('-').map(Number);
            return currentValue >= start && currentValue <= end;
        }

        if (cronField.includes('/')) {
            const [base, step] = cronField.split('/');
            const baseValue = base === '*' ? 0 : Number(base);
            return (currentValue - baseValue) % Number(step) === 0;
        }

        if (cronField.includes('L') || cronField.includes('W') || cronField.includes('#')) {
            return false;
        }

        return Number(cronField) === currentValue;
    }

    /**
     * Validates the length of the cron expression.
     * @param {String} cronExpr - The cron expression to be validated.
     * @returns {Boolean|Array} - Returns false if the length is invalid, otherwise returns the split cron expression.
     */
    #validateLength(cronExpr) {
        const parts = cronExpr.trim().split(/\s+/);
        if (parts.length < 5 || parts.length > 7) {
            return false;
        }
        return parts;
    }

    /**
     * Formats the date into an object with the required properties.
     * @param {String} date - The date to be formatted.
     * @returns {Object} - An object containing the formatted date properties.
     * - `minute`: The minute of the date.
     * - `hour`: The hour of the date.
     * - `dayOfMonth`: The day of the month of the date.
     * - `month`: The month of the date.
     * - `dayOfWeek`: The day of the week of the date.
     * - `year`: The year of the date.
     */
    #dateTimeFormat(date) {
        return {
            minute: date.getMinutes(),
            hour: date.getHours(),
            dayOfMonth: date.getDate(),
            month: date.getMonth() + 1,
            dayOfWeek: date.getDay() === 0 ? 7 : date.getDay(),
            year: date.getFullYear(),
        };
    }

    /**
     * Validates if the cron expression should run based on the current date.
     * @param {String} cronExpr  cron expression to be validated
     * @param {Date} currentDate current date to be validated against
     * @returns {Boolean} - Returns true if the cron expression should run, false otherwise.
     */
    #shouldRun(cronExpr, currentDate) {
        const splitCron = this.#validateLength(cronExpr);

        if (!splitCron) {
            return false;
        }

        const [minute, hour, dayOfMonth, month, dayOfWeek, year = '*'] = splitCron;

        const currentValues = this.#dateTimeFormat(currentDate);

        return (
            this.#isMatch(minute, currentValues.minute, 'minute') &&
            this.#isMatch(hour, currentValues.hour, 'hour') &&
            this.#isMatch(dayOfMonth, currentValues.dayOfMonth, 'dayOfMonth') &&
            this.#isMatch(month, currentValues.month, 'month') &&
            this.#isMatch(dayOfWeek, currentValues.dayOfWeek, 'dayOfWeek') &&
            this.#isMatch(year, currentValues.year, 'year')
        );
    }
}
