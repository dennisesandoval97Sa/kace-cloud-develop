import { AggregateRoot, ValueObjectDescription } from '../../shared';
import { ValueObjectHolidayDates } from './ValueObjectHolidayDates';
import { ValueObjectWorkDays } from './ValueObjectWorkDays';

export class ShiftManagement extends AggregateRoot {
    /** @type {ValueObjectHolidayDates} is initialized in the constructor */
    #holiday_dates;
    /** @type {ValueObjectWorkDays} is initialized in the constructor */
    #work_days;
    /** @type {ValueObjectDescription} is initialized in the constructor */
    #description;

    constructor({
        id,
        holiday_dates,
        work_days,
        description,
        created_at,
        created_by,
        updated_at,
        updated_by,
        deleted_at,
        deleted_by,
    }) {
        super(id);
        this.#holiday_dates = new ValueObjectHolidayDates(
            'holiday_dates',
            holiday_dates ?? new Date().toISOString().split('T')[0]
        );
        this.#work_days = new ValueObjectWorkDays('work_days', work_days);
        this.#description = new ValueObjectDescription('description', description ?? 'default');
        this.created_by = created_by;
        this.created_at = created_at;
        this.updated_by = updated_by;
        this.updated_at = updated_at;
        this.deleted_by = deleted_by;
        this.deleted_at = deleted_at;
    }

    get holiday_dates() {
        return this.#holiday_dates;
    }

    set holiday_dates(value) {
        if (!Array.isArray(value)) {
            value = [];
        }
        if (JSON.stringify(this.#holiday_dates.value) !== JSON.stringify(value)) {
            this.#holiday_dates = new ValueObjectHolidayDates('holiday_dates', value);
            this.changedAttributes.holiday_dates = JSON.stringify(value);
        }
    }

    get work_days() {
        return this.#work_days;
    }

    set work_days(value) {
        if (this.#work_days.value !== value) {
            this.#work_days = new ValueObjectWorkDays('work_days', value);
            this.changedAttributes.work_days = value;
        }
    }

    get description() {
        return this.#description;
    }

    set description(value) {
        if (this.#description.value !== value) {
            this.#description = new ValueObjectDescription('description', value);
            this.changedAttributes.description = value;
        }
    }

    workDaysAsNumbers() {
        const weekdayMap = {
            monday: 1,
            tuesday: 2,
            wednesday: 3,
            thursday: 4,
            friday: 5,
            saturday: 6,
            sunday: 0,
        };
        return Object.keys(this.#work_days.value).map((day) => weekdayMap[day]);
    }

    /**
     * Creates a new ShiftManagement object from the provided data transfer object (DTO).
     *
     * @param {Object} dto - The data transfer object containing the properties for the ShiftManagement object.
     * @returns {ShiftManagement} A new instance of the ShiftManagement class.
     */
    static create(dto) {
        return new ShiftManagement(dto);
    }
}
