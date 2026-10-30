import { AggregateRoot, Helper, ValidationFailError } from '../../shared/index.js';
import { APPOINTMENT_TIME_SLOT_INVALID_TIME_RANGE } from '@kace/error-codes';
import {
    ValueObjectAgendaId,
    ValueObjectDescription,
    ValueObjectEndTime,
    ValueObjectIsActive,
    ValueObjectMaxAppointments,
    ValueObjectStartTime,
} from './value-objects/index.js';

export class AppointmentTimeSlots extends AggregateRoot {
    /**
     * @type {ValueObjectDescription} is initialized in the constructor
     */
    #description;

    /**
     * @type {ValueObjectStartTime} is initialized in the constructor
     */
    #start_time;

    /**
     * @type {ValueObjectEndTime} is initialized in the constructor
     */
    #end_time;

    /**
     * @type {ValueObjectAgendaId} is initialized in the constructor
     */
    #agenda_id;

    /**
     * @type {ValueObjectIsActive} is initialized in the constructor
     */
    #is_active;

    /**
     * @type {ValueObjectMaxAppointments} is initialized in the constructor
     */
    #max_appointments;

    constructor({
        id,
        description,
        start_time,
        end_time,
        agenda_id,
        is_active,
        max_appointments,
        created_by,
        updated_by,
        deleted_by,
        created_at,
        updated_at,
        deleted_at,
    }) {
        super(id);

        const initialStartTime = new ValueObjectStartTime('start_time', start_time ?? new Date());
        const initialEndTime = new ValueObjectEndTime('end_time', end_time ?? new Date(Date.now() + 86400000));

        if (!this.#isTimeRangeValid(initialStartTime, initialEndTime)) {
            throw new ValidationFailError(
                'Invalid time range: end_time must be greater than start_time',
                'start_time, end_time',
                [],
                APPOINTMENT_TIME_SLOT_INVALID_TIME_RANGE
            );
        }

        this.#start_time = initialStartTime;
        this.#end_time = initialEndTime;

        this.#description = new ValueObjectDescription('description', description ?? 'default');
        this.#agenda_id = new ValueObjectAgendaId('agenda_id', agenda_id);
        this.#is_active = new ValueObjectIsActive('is_active', is_active ?? false);
        this.#max_appointments = new ValueObjectMaxAppointments('max_appointments', max_appointments ?? 1);

        this.created_by = created_by;
        this.updated_by = updated_by;
        this.deleted_by = deleted_by;

        this.created_at = created_at;
        this.updated_at = updated_at;
        this.deleted_at = deleted_at;
    }

    /**
     *
     * @param {object} dto
     * @param {string} dto.description
     * @param {string} dto.start_time
     * @param {string} dto.end_time
     * @param {string} dto.agenda_id
     * @param {boolean} dto.is_active
     * @param {number} dto.max_appointments
     * @param {string} dto.created_by
     * @param {string|null|undefined} dto.updated_by
     * @param {string|null|undefined} dto.deleted_by
     * @param {string} dto.created_at
     * @param {string|null|undefined} dto.updated_at
     * @param {string|null|undefined} dto.deleted_at
     *
     * @returns {AppointmentTimeSlots}
     */
    static create(dto) {
        return new AppointmentTimeSlots(dto);
    }

    /**
     * Update the AppointmentTimeSlots attributes, if start_time and end_time are provided,
     * update the time range.
     *
     * @override AggregateRoot.update method
     *
     * @param {object} dto - The object with the attributes to update
     *
     * @throws { ValidationFailError } - if start_time and end_time are not provided together
     *
     * @returns {void} - No return
     */
    update(dto) {
        const { start_time, end_time, ...restDto } = dto;

        if ((start_time && !end_time) || (!start_time && end_time)) {
            throw new ValidationFailError(
                'start_time and end_time must be provided together',
                'start_time, end_time',
                [],
                APPOINTMENT_TIME_SLOT_INVALID_TIME_RANGE
            );
        }

        if (start_time && end_time) {
            this.updateTimeRange(start_time, end_time);
        }

        super.update(restDto);
    }

    /**
     * @param {string} value
     */
    set description(value) {
        if (!this.#areEqual(this.#description.value, value)) {
            this.#description = new ValueObjectDescription('description', value);
            this.changedAttributes.description = value;
        }
    }

    /**
     * The start_time is a read-only property,
     * it can only be set during the object creation
     *
     * @throws { ValidationFailError } - if the property is set
     *
     * @param {string} _value
     */
    set start_time(_value) {
        Helper.logDebug(_value);
        throw new ValidationFailError('start_time is a read-only property', 'start_time');
    }

    /**
     * The end_time is a read-only property,
     *
     * @throws { ValidationFailError } - if the property is set
     *
     * @param {string} _value
     */
    set end_time(_value) {
        Helper.logDebug(_value);
        throw new ValidationFailError('end_time is a read-only property', 'end_time');
    }

    /**
     * @param {string} value
     */
    set agenda_id(value) {
        if (!this.#areEqual(this.#agenda_id.value, value)) {
            this.#agenda_id = new ValueObjectAgendaId('agenda_id', value);
            this.changedAttributes.agenda_id = value;
        }
    }

    /**
     * @param {boolean} value
     */
    set is_active(value) {
        if (!this.#areEqual(this.#is_active.value, value)) {
            this.#is_active = new ValueObjectIsActive('is_active', value);
            this.changedAttributes.is_active = value;
        }
    }

    /**
     * @param {number} value
     */
    set max_appointments(value) {
        if (!this.#areEqual(this.#max_appointments.value, value)) {
            this.#max_appointments = new ValueObjectMaxAppointments('max_appointments', value);
            this.changedAttributes.max_appointments = value;
        }
    }

    /**
     * Update the time range, if the new range is invalid, throw an error
     *
     * @param {string} startTime - The new start time in the format 'HH:MM' or 'HH:MM:SS'
     * @param {string} endTime - The new end time in the format 'HH:MM' or 'HH:MM:SS'
     *
     * @throws { ValidationFailError } - if the new time range is invalid
     *
     * @returns {void} - No return
     */
    updateTimeRange(startTime, endTime) {
        const newStartTime = new ValueObjectStartTime('start_time', startTime);
        const newEndTime = new ValueObjectEndTime('end_time', endTime);

        if (!this.#isTimeRangeValid(newStartTime, newEndTime)) {
            throw new ValidationFailError(
                'Invalid time range: end_time must be greater than start_time',
                'start_time, end_time',
                [],
                APPOINTMENT_TIME_SLOT_INVALID_TIME_RANGE
            );
        }

        if (!this.#areEqual(this.#start_time.value, startTime)) {
            this.#start_time = newStartTime;
            this.changedAttributes.start_time = startTime;
        }

        if (!this.#areEqual(this.#end_time.value, endTime)) {
            this.#end_time = newEndTime;
            this.changedAttributes.end_time = endTime;
        }
    }

    /**
     * @returns {ValueObjectDescription}
     */
    get description() {
        return this.#description;
    }

    /**
     * @returns {ValueObjectStartTime}
     */
    get start_time() {
        return this.#start_time;
    }

    /**
     * @returns {ValueObjectEndTime}
     */
    get end_time() {
        return this.#end_time;
    }

    /**
     * @returns {ValueObjectAgendaId}
     */
    get agenda_id() {
        return this.#agenda_id;
    }

    /**
     * @returns {ValueObjectIsActive}
     */
    get is_active() {
        return this.#is_active;
    }

    /**
     * @returns {ValueObjectMaxAppointments}
     */
    get max_appointments() {
        return this.#max_appointments;
    }

    /**
     * @returns {boolean}
     */
    #areEqual(value, otherValue) {
        return value === otherValue;
    }

    /**
     * Validate if the time range is valid, end_time must be greater than start_time
     * If one of the values is null, the range is valid.
     *
     * @param {ValueObjectStartTime} startTime
     * @param {ValueObjectEndTime} endTime
     * @returns {boolean}
     */
    #isTimeRangeValid(startTime, endTime) {
        if (!startTime || !endTime) {
            return true;
        }

        const startTimeInSeconds = this.#toSeconds(startTime.value);
        const endTimeInSeconds = this.#toSeconds(endTime.value);

        return startTimeInSeconds <= endTimeInSeconds;
    }

    /**
     * Convert a time string to seconds
     *
     * @param {string} timeStr - The time string in the format 'HH:MM' or 'HH:MM:SS'
     * @returns {number} - The time in seconds
     */
    #toSeconds(timeStr) {
        const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number);
        return hours * 3600 + minutes * 60 + seconds;
    }
}
