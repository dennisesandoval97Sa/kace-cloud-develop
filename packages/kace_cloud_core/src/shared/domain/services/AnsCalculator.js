import createDayjsInstance from '../../factories/DayjsFactory';
import duration from 'dayjs/plugin/duration';

const dayjs = createDayjsInstance({
    plugins: [duration],
});

export class AnsCalculator {
    static VIGENTE = 1;
    static INTERMEDIO = 2;
    static VENCIDO = 3;
    static DAY_HOURS = 24;

    /** is initialized in the constructor*/
    #createdAt;
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
    #elapsedTime = { days: 0, hours: 0, minutes: 0 };
    /** is initialized in the constructor*/
    #position;

    /**
     * Constructor for ExpirationCalculator.
     * @param {Object} calculateItems - Object with ans and shift properties.
     * @param {dayjs.Dayjs} currentDate - Current date and time (optional).
     * @throws {Error} If calculateItems not have ans or shift properties.
     * @param {string} referenceDate - The reference date for calculations (created_at or state_change_at).
     */
    constructor(calculateItems, currentDateTime = dayjs(), referenceDate) {
        if (!calculateItems.ans || !calculateItems.shift) {
            throw new Error('AnsCalculator: ans and shift values must be defined');
        }
        this.#createdAt = dayjs(referenceDate);
        this.#ans = calculateItems.ans;
        this.#currentDateTime = dayjs(currentDateTime);
        this.#shifts = calculateItems.shift.work_days.value;
        this.#holidays = calculateItems.shift.holiday_dates.value;
        this.#workDays = this.#getWorkDays(calculateItems.shift.work_days);

        this.#calculateElapsedTime();
        this.#position = this.#calculatePosition();
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
     * Calculate the position based on elapsed time and ANS thresholds.
     * @returns {number} The calculated position (VIGENTE, INTERMEDIO, or VENCIDO).
     */
    #calculatePosition() {
        const { medicion_ans_id, intermedio, vencido } = this.#ans;
        const value = this.#elapsedValueByMedition(medicion_ans_id.value);
        if (value < intermedio.value) return AnsCalculator.VIGENTE;
        if (value < vencido.value) return AnsCalculator.INTERMEDIO;
        return AnsCalculator.VENCIDO;
    }

    /**
     * Calculate the elapsed value based on the specified measurement type.
     * @param {string} medicion_ans - The measurement type ('Days', 'Hours', or 'Minutes').
     * @returns {number} The elapsed value in the specified unit.
     */
    #elapsedValueByMedition(medicion_ans) {
        const duration = dayjs.duration(this.#elapsedTime);
        const timeUnits = {
            Days: duration.asDays(),
            Hours: duration.asHours(),
            Minutes: duration.asMinutes(),
        };
        return timeUnits[medicion_ans] || 0;
    }

    /**
     * Calculate the total elapsed time.
     */
    #calculateElapsedTime() {
        if (this.#createdAt.isSame(this.#currentDateTime, 'day')) {
            this.#processSameDay();
        } else {
            this.#processFirstDay();
            this.#processIntermediateDays();
            this.#processLastDay();
        }
        this.#normalizeElapsedTime();
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
     * Get the number of working hours for a given day.
     * @param {dayjs.Dayjs} date - The date to check.
     * @returns {number} The number of working hours.
     */
    #getWorkHoursForDay(date) {
        if (this.#isWorkingDay(date)) {
            const { start, end } = this.#shifts[date.format('dddd').toLowerCase()];

            const startDate = dayjs(`${date.format('YYYY-MM-DD')} ${start}`);
            const endDate = dayjs(`${date.format('YYYY-MM-DD')} ${end}`);

            return endDate.diff(startDate, 'hour');
        }
        return AnsCalculator.DAY_HOURS;
    }

    /**
     * Process elapsed time for the same day.
     */
    #processSameDay() {
        if (!this.#isWorkingDay(this.#createdAt)) return;

        const startOfDay = this.#getWorkingPeriod(this.#createdAt, 'start');
        const endOfDay = this.#getWorkingPeriod(this.#createdAt, 'end');

        if (this.#createdAt.isAfter(endOfDay)) return;

        if (this.#createdAt.isBefore(startOfDay) && this.#currentDateTime.isAfter(endOfDay)) {
            this.#elapsedTime.days++;
            return;
        }

        if (this.#createdAt.isBefore(startOfDay)) {
            this.#createdAt = startOfDay;
        }

        const diff = this.#currentDateTime.isBefore(endOfDay)
            ? this.#currentDateTime.diff(this.#createdAt)
            : endOfDay.diff(this.#createdAt);
        const interval = dayjs.duration(diff);
        this.#addElapsedTime(interval);
    }

    /**
     * Process elapsed time for the first day.
     */
    #processFirstDay() {
        if (this.#isWorkingDay(this.#createdAt)) {
            const startOfDay = this.#getWorkingPeriod(this.#createdAt, 'start');
            let endOfDay = this.#getWorkingPeriod(this.#createdAt, 'end');

            if (endOfDay.hour() === 23 && endOfDay.minute() === 59) {
                endOfDay = endOfDay.add(1, 'day').hour(0).minute(0).second(0).millisecond(0);
            }

            if (this.#createdAt.isBefore(startOfDay)) {
                this.#elapsedTime.days++;
                return;
            }

            if (this.#createdAt.isBefore(endOfDay)) {
                const interval = dayjs.duration(endOfDay.diff(this.#createdAt));
                this.#addElapsedTime(interval);
            }
        }
    }

    /**
     * Process elapsed time for intermediate days.
     */
    #processIntermediateDays() {
        let day = this.#createdAt.add(1, 'day');
        while (day.isBefore(this.#currentDateTime, 'day')) {
            if (this.#isWorkingDay(day)) this.#elapsedTime.days++;
            day = day.add(1, 'day');
        }
    }

    /**
     * Process elapsed time for the last day.
     */
    #processLastDay() {
        if (this.#isWorkingDay(this.#currentDateTime)) {
            const startOfDay = this.#getWorkingPeriod(this.#currentDateTime, 'start');
            const endOfDay = this.#getWorkingPeriod(this.#currentDateTime, 'end');

            if (this.#currentDateTime.isAfter(endOfDay)) {
                this.#elapsedTime.days++;
                return;
            }

            if (this.#currentDateTime.isAfter(startOfDay)) {
                const interval = dayjs.duration(this.#currentDateTime.diff(startOfDay));
                this.#addElapsedTime(interval);
            }
        }
    }

    /**
     * Get the start or end time of a working day based on the provided date.
     * @param {dayjs.Dayjs} date - The `dayjs` date object for which to get the working period time.
     * @param {('start' | 'end')} type - The type of working period to retrieve.
     * @returns {dayjs.Dayjs} The `dayjs` date object with the time set to the corresponding working period.
     */
    #getWorkingPeriod(date, type = 'start') {
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
     * Add elapsed time to the current total.
     * @param {dayjs.Duration} interval - The duration to add.
     */
    #addElapsedTime(interval) {
        this.#elapsedTime.days += Math.max(interval.days(), 0);
        this.#elapsedTime.hours += Math.max(interval.hours(), 0);
        this.#elapsedTime.minutes += Math.max(interval.minutes(), 0);
    }

    /**
     * Normalize the elapsed time, converting excess minutes to hours and excess hours to days.
     */
    #normalizeElapsedTime() {
        let { days, hours, minutes } = this.#elapsedTime;
        const workHours = this.#getWorkHoursForDay(this.#currentDateTime);

        if (minutes >= 60) {
            hours += Math.floor(minutes / 60);
            minutes %= 60;
        }

        if (hours >= workHours) {
            days += Math.floor(hours / workHours);
            hours %= workHours;
        }

        this.#elapsedTime = { days, hours, minutes };
    }

    /**
     * Get a description of the elapsed working time.
     * @returns {string} A formatted string describing the elapsed time.
     */
    get description() {
        const { days, hours, minutes } = this.#elapsedTime;
        return `Tiempo laboral transcurrido: ${days} días -> ${hours} horas -> ${minutes} minutos`;
    }

    /**
     * Get the current position status.
     * @returns {number} The position status (VIGENTE, INTERMEDIO, or VENCIDO).
     */
    get position() {
        return this.#position;
    }

    /**
     * Get the number of elapsed days.
     * @returns {number} The number of elapsed days.
     */
    get days() {
        return this.#elapsedTime.days;
    }

    /**
     * Get the number of elapsed hours.
     * @returns {number} The number of elapsed hours.
     */
    get hours() {
        return this.#elapsedTime.hours;
    }

    /**
     * Get the number of elapsed minutes.
     * @returns {number} The number of elapsed minutes.
     */
    get minutes() {
        return this.#elapsedTime.minutes;
    }
}
