import createDayjsInstance from '../../factories/DayjsFactory';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import duration from 'dayjs/plugin/duration';
import { CustomError } from '../../errors/CustomError.js';

const dayjs = createDayjsInstance({
    plugins: [isSameOrBefore, isSameOrAfter, duration],
});

// Upper bound for the day/period iteration loops below. Any legitimate ANS resolves in far fewer
// steps (vencido in its unit / working-time-per-day, plus skipped non-working days). A shift with
// no working days, or an ANS remainder landing on the `remainingTime === 1` hole, otherwise loops
// forever and freezes the event loop until the ECS health check kills the task. Exceeding this is a
// data/config bug, not a slow case, so we fail loudly and let the caller skip that case.
const MAX_EXPIRATION_ITERATIONS = 50000;

export class ExpirationCalculator {
    /** @type {dayjs.Dayjs | null} */
    #expiredAt = null;
    /** is initialized in the constructor*/
    #referenceDatetime;
    /** is initialized in the constructor*/
    #ans;
    /** is initialized in the constructor*/
    #currentDateTime;
    /** is initialized in the constructor*/
    #shifts;
    /** is initialized in the constructor*/
    #workDays;
    /** is initialized in the constructor*/
    #holidays;

    /**
     * Constructor for ExpirationCalculator.
     * @param {Object} calculateItems - Object with ans and shift properties.
     * @param {dayjs.Dayjs} currentDate - Current date and time (optional).
     * @throws {Error} If calculateItems not have ans or shift properties.
     * @param {string} referenceDate - The reference date for calculations (created_at or state_change_at).
     */
    constructor(calculateItems, currentDate = dayjs(), referenceDate) {
        if (!calculateItems.ans || !calculateItems.shift) {
            throw new Error('AnsCalculator: ans and shift values must be defined');
        }
        this.#referenceDatetime = dayjs(referenceDate);
        this.#ans = calculateItems.ans;
        this.#currentDateTime = dayjs(currentDate);

        this.#holidays = calculateItems.shift.holiday_dates.value;
        this.#shifts = calculateItems.shift.work_days.value;
        this.#workDays = this.#getWorkDays(calculateItems.shift.work_days);

        this.#expiredAt = this.#calculateExpiration();
    }

    /**
     * Gets the expiration date.
     * @returns {string} Expiration date.
     */
    get expiredAt() {
        return this.#expiredAt.toISOString();
    }

    /**
     * Convert work days object to a Set of day numbers.
     * @param {ValueObjectWorkDays} workDays - The work days object.
     * @returns {Array<number>} A Set of day numbers representing work days.
     */
    #getWorkDays(workDays) {
        const weekdayMap = {
            monday: 1,
            tuesday: 2,
            wednesday: 3,
            thursday: 4,
            friday: 5,
            saturday: 6,
            sunday: 0,
        };
        return Object.keys(workDays.value).map((day) => weekdayMap[day]);
    }

    /**
     * Check if a given date is a working day.
     * @param {dayjs.Dayjs} date - The date to check.
     * @returns {boolean} True if it's a working day, false otherwise.
     */
    #isWorkingDay(date) {
        return this.#workDays.includes(date.day()) && !this.#holidays.includes(date.format('YYYY-MM-DD'));
    }

    /**
     * Get the start time of a working day.
     * @param {dayjs.Dayjs} date - The date to get the start time for.
     * @param {('start' | 'end')} type - The type of working period to retrieve.
     * @returns {dayjs.Dayjs} The start time of the working day.
     */
    #getWorkDayBoundaries(date, type = 'start') {
        const time = this.#shifts[date.format('dddd').toLowerCase()]?.[type] || (type === 'start' ? '00:00' : '23:59');
        return this.#setDateWithTime(date, time);
    }

    /**
     * Set the time for a given date.
     * @param {dayjs.Dayjs} date - The date to set the time for.
     * @param {string} time - The time in 'HH:mm' format.
     * @returns {dayjs.Dayjs} The date with the specified time.
     */
    #setDateWithTime(date, time) {
        const [hour, minute] = time.split(':').map(Number);
        return date.hour(hour).minute(minute).second(0);
    }

    /**
     * Guards the iteration loops against never terminating (e.g. a shift with no working days).
     * @param {number} iterations - The current iteration count.
     * @throws {CustomError} When the iteration budget is exceeded.
     */
    #assertIterationBudget(iterations) {
        if (iterations > MAX_EXPIRATION_ITERATIONS) {
            throw new CustomError(
                `ExpirationCalculator: exceeded ${MAX_EXPIRATION_ITERATIONS} iterations ` +
                    `(medicion=${this.#ans.medicion_ans_id.value}, vencido=${this.#ans.vencido.value}). ` +
                    'Likely a shift with no working days or an invalid ANS configuration.',
                500,
                'expiration_calculator'
            );
        }
    }

    /**
     * Calculates the expiration date based on the measurement type (days, hours, minutes).
     * @returns {dayjs.Dayjs | null} The expiration date.
     * @throws {Error} If the measurement type is invalid.
     */
    #calculateExpiration() {
        let expirationDate;
        switch (this.#ans.medicion_ans_id.value) {
            case 'Days':
                expirationDate = this.#calculateExpirationInDays();
                break;
            case 'Hours':
                expirationDate = this.#calculateExpirationInHours();
                break;
            case 'Minutes':
                expirationDate = this.#calculateExpirationInMinutes();
                break;
            default:
                throw new CustomError('AnsCalculator: Invalid measurement type', 500, 'medicino_ans_id');
        }
        return expirationDate;
    }

    /**
     * Calculates the expiration date in days.
     * @returns {dayjs.Dayjs} The expiration date in days.
     */
    #calculateExpirationInDays() {
        let caseCurrentTimestamp = this.#referenceDatetime.clone();
        let daysExpended = 0;
        let accumulatedRemmaingTime = 0;
        let iterations = 0;

        while (daysExpended <= this.#ans.vencido.value) {
            this.#assertIterationBudget(++iterations);
            let startOfDay = this.#getWorkDayBoundaries(caseCurrentTimestamp, 'start');
            let endOfDay = this.#getWorkDayBoundaries(caseCurrentTimestamp, 'end');
            let newStartedDay;

            if (!this.#isWorkingDay(caseCurrentTimestamp)) {
                caseCurrentTimestamp = caseCurrentTimestamp.add(1, 'day');
                newStartedDay = this.#getWorkDayBoundaries(caseCurrentTimestamp, 'start');
                if (daysExpended === 0) {
                    caseCurrentTimestamp = caseCurrentTimestamp
                        .hour(newStartedDay.hour())
                        .minute(newStartedDay.minute());
                }
            } else if (caseCurrentTimestamp.isBefore(startOfDay)) {
                caseCurrentTimestamp = caseCurrentTimestamp.hour(startOfDay.hour()).minute(startOfDay.minute());
            } else if (caseCurrentTimestamp.isAfter(endOfDay)) {
                caseCurrentTimestamp = caseCurrentTimestamp.add(1, 'day');
                newStartedDay = this.#getWorkDayBoundaries(caseCurrentTimestamp, 'start');
                caseCurrentTimestamp = caseCurrentTimestamp.hour(newStartedDay.hour()).minute(newStartedDay.minute());
            } else {
                if (daysExpended < this.#ans.vencido.value) {
                    caseCurrentTimestamp = caseCurrentTimestamp.add(1, 'day');
                    if (this.#currentDateTime.isSameOrBefore(caseCurrentTimestamp, 'day')) {
                        accumulatedRemmaingTime++;
                    }
                }
                daysExpended++;
            }
        }

        return caseCurrentTimestamp;
    }

    /**
     * Calculates the expiration date in hours.
     */
    #calculateExpirationInHours(unit = 'hour') {
        let caseCurrentTimestamp = this.#referenceDatetime.clone();
        let remainingTime = this.#ans.vencido.value;

        if (unit === 'hour' && caseCurrentTimestamp.minute() > 0) {
            caseCurrentTimestamp = caseCurrentTimestamp.add(1, 'hour').startOf('hour');
        }

        let iterations = 0;
        while (remainingTime > 0) {
            this.#assertIterationBudget(++iterations);
            let startOfDay = this.#getWorkDayBoundaries(caseCurrentTimestamp, 'start');
            let endOfDay = this.#getWorkDayBoundaries(caseCurrentTimestamp, 'end');
            let newStartedDay;

            if (!this.#isWorkingDay(caseCurrentTimestamp)) {
                caseCurrentTimestamp = caseCurrentTimestamp.add(1, 'day');
                newStartedDay = this.#getWorkDayBoundaries(caseCurrentTimestamp, 'start');
                if (remainingTime === this.#ans.vencido.value) {
                    caseCurrentTimestamp = caseCurrentTimestamp
                        .hour(newStartedDay.hour())
                        .minute(newStartedDay.minute());
                }
            } else if (caseCurrentTimestamp.isBefore(startOfDay)) {
                caseCurrentTimestamp = caseCurrentTimestamp.hour(startOfDay.hour()).minute(startOfDay.minute());
            } else if (caseCurrentTimestamp.isAfter(endOfDay)) {
                caseCurrentTimestamp = caseCurrentTimestamp.add(1, 'day');
                newStartedDay = this.#getWorkDayBoundaries(caseCurrentTimestamp, 'start');
                caseCurrentTimestamp = caseCurrentTimestamp.hour(newStartedDay.hour()).minute(newStartedDay.minute());
            } else {
                if (remainingTime >= 1) {
                    let availableTime = endOfDay.diff(caseCurrentTimestamp, unit);
                    if (availableTime >= remainingTime) {
                        caseCurrentTimestamp = caseCurrentTimestamp = caseCurrentTimestamp.add(remainingTime, unit);
                        remainingTime = 0;
                    } else {
                        remainingTime -= availableTime;
                        caseCurrentTimestamp = caseCurrentTimestamp.add(1, 'day');
                        newStartedDay = this.#getWorkDayBoundaries(caseCurrentTimestamp, 'start');
                        caseCurrentTimestamp = caseCurrentTimestamp
                            .hour(newStartedDay.hour())
                            .minute(newStartedDay.minute());
                    }
                }
            }
        }

        return caseCurrentTimestamp;
    }

    /**
     * Calculates the expiration date in minutes.
     */
    #calculateExpirationInMinutes() {
        let caseCurrentTimestamp = this.#referenceDatetime.clone();
        let remainingTime = this.#ans.vencido.value;

        let iterations = 0;
        while (remainingTime > 0) {
            this.#assertIterationBudget(++iterations);
            let startOfDay = this.#getWorkDayBoundaries(caseCurrentTimestamp, 'start');
            let endOfDay = this.#getWorkDayBoundaries(caseCurrentTimestamp, 'end');
            let newStartedDay;

            if (!this.#isWorkingDay(caseCurrentTimestamp)) {
                caseCurrentTimestamp = caseCurrentTimestamp.add(1, 'day');
                newStartedDay = this.#getWorkDayBoundaries(caseCurrentTimestamp, 'start');
                if (remainingTime === this.#ans.vencido.value) {
                    caseCurrentTimestamp = caseCurrentTimestamp
                        .hour(newStartedDay.hour())
                        .minute(newStartedDay.minute());
                }
            } else if (caseCurrentTimestamp.isBefore(startOfDay)) {
                caseCurrentTimestamp = caseCurrentTimestamp.hour(startOfDay.hour()).minute(startOfDay.minute());
            } else if (caseCurrentTimestamp.isAfter(endOfDay)) {
                caseCurrentTimestamp = caseCurrentTimestamp.add(1, 'day');
                newStartedDay = this.#getWorkDayBoundaries(caseCurrentTimestamp, 'start');
                caseCurrentTimestamp = caseCurrentTimestamp.hour(newStartedDay.hour()).minute(newStartedDay.minute());
            } else {
                // `>= 1` (not `> 1`): when exactly 1 minute remains inside working hours the old
                // `> 1` skipped this branch, leaving remainingTime stuck at 1 and looping forever.
                if (remainingTime >= 1) {
                    let availableTime = endOfDay.diff(caseCurrentTimestamp, 'minute');
                    if (availableTime >= remainingTime) {
                        caseCurrentTimestamp = caseCurrentTimestamp.add(remainingTime, 'minute');
                        remainingTime = 0;
                    } else {
                        remainingTime -= availableTime;
                        caseCurrentTimestamp = caseCurrentTimestamp.add(1, 'day');
                        newStartedDay = this.#getWorkDayBoundaries(caseCurrentTimestamp, 'start');
                        caseCurrentTimestamp = caseCurrentTimestamp
                            .hour(newStartedDay.hour())
                            .minute(newStartedDay.minute());
                    }
                }
            }
        }

        return caseCurrentTimestamp;
    }
}
