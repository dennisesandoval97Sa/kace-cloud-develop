import { AggregateRoot } from '../../shared/index.js';
import {
    ValueObjectAgendaId,
    ValueObjectAssignedTo,
    ValueObjectCaseId,
    ValueObjectCustomFields,
    ValueObjectDate,
    ValueObjectEndTime,
    ValueObjectIsCanceled,
    ValueObjectIsCompleted,
    ValueObjectLastAppointmentId,
    ValueObjectStartTime,
} from './value-objects/index.js';

export class Appointment extends AggregateRoot {
    /**
     * @type {ValueObjectCaseId} is initialized in the constructor
     */
    #case_id;

    /**
     * @type {ValueObjectAgendaId} is initialized in the constructor
     */
    #agenda_id;

    /**
     * @type {ValueObjectDate} is initialized in the constructor
     */
    #date;

    /**
     * @type {ValueObjectStartTime} is initialized in the constructor
     */
    #start_time;

    /**
     * @type {ValueObjectEndTime} is initialized in the constructor
     */
    #end_time;

    /**
     * @type {ValueObjectLastAppointmentId} is initialized in the constructor
     */
    #last_appointment_id;

    /**
     * @type {ValueObjectIsCompleted} is initialized in the constructor
     */
    #is_completed;

    /**
     * @type {ValueObjectIsCanceled} is initialized in the constructor
     */
    #is_canceled;

    /**
     * @type {ValueObjectCustomFields} is initialized in the constructor
     */
    #custom_fields;

    /**
     * @type {ValueObjectAssignedTo} is initialized in the constructor
     */
    #assigned_to;

    constructor(dto) {
        super(dto.id);
        this.#case_id = new ValueObjectCaseId('case_id', dto.case_id);
        this.#agenda_id = new ValueObjectAgendaId('agenda_id', dto.agenda_id);
        this.#date = new ValueObjectDate('date', dto.date ?? new Date());
        this.#start_time = new ValueObjectStartTime('start_time', dto.start_time ?? new Date());
        this.#end_time = new ValueObjectEndTime('end_time', dto.end_time ?? new Date(Date.now() + 86400000));
        this.#last_appointment_id = new ValueObjectLastAppointmentId('last_appointment_id', dto.last_appointment_id);
        this.#is_completed = new ValueObjectIsCompleted('is_completed', dto.is_completed ?? false);
        this.#is_canceled = new ValueObjectIsCanceled('is_canceled', dto.is_canceled ?? false);
        this.#custom_fields = new ValueObjectCustomFields('custom_fields', dto.custom_fields ?? {});
        this.#assigned_to = new ValueObjectAssignedTo('assigned_to', dto.assigned_to);
        this.created_at = dto.created_at;
        this.updated_at = dto.updated_at;
        this.deleted_at = dto.deleted_at;
        this.created_by = dto.created_by;
        this.updated_by = dto.updated_by;
        this.deleted_by = dto.deleted_by;
    }

    /**
     * Creates a new Appointment instance from a DTO.
     * @param {Object} dto
     * @returns {Appointment}
     */
    static create(dto) {
        return new Appointment(dto);
    }

    set case_id(value) {
        if (!this.#areEqual(this.#case_id.value, value)) {
            this.#case_id = new ValueObjectCaseId('case_id', value);
            this.changedAttributes.case_id = this.#case_id.value;
        }
    }

    set agenda_id(value) {
        if (!this.#areEqual(this.#agenda_id.value, value)) {
            this.#agenda_id = new ValueObjectAgendaId('agenda_id', value);
            this.changedAttributes.agenda_id = this.#agenda_id.value;
        }
    }

    set date(value) {
        if (!this.#areEqual(this.#date.value, value)) {
            this.#date = new ValueObjectDate('date', value);
            this.changedAttributes.date = this.#date.value;
        }
    }

    set start_time(value) {
        if (!this.#areEqual(this.#start_time.value, value)) {
            this.#start_time = new ValueObjectStartTime('start_time', value);
            this.changedAttributes.start_time = this.#start_time.value;
        }
    }

    set end_time(value) {
        if (!this.#areEqual(this.#end_time.value, value)) {
            this.#end_time = new ValueObjectEndTime('end_time', value);
            this.changedAttributes.end_time = this.#end_time.value;
        }
    }

    set last_appointment_id(value) {
        if (!this.#areEqual(this.#last_appointment_id?.value, value)) {
            this.#last_appointment_id = new ValueObjectLastAppointmentId('last_appointment_id', value);
            this.changedAttributes.last_appointment_id = this.#last_appointment_id.value;
        }
    }

    set is_completed(value) {
        if (!this.#areEqual(this.#is_completed.value, value)) {
            this.#is_completed = new ValueObjectIsCompleted('is_completed', value);
            this.changedAttributes.is_completed = this.#is_completed.value;
        }
    }

    set is_canceled(value) {
        if (!this.#areEqual(this.#is_canceled.value, value)) {
            this.#is_canceled = new ValueObjectIsCanceled('is_canceled', value);
            this.changedAttributes.is_canceled = this.#is_canceled.value;
        }
    }

    set custom_fields(value) {
        if (!this.#areEqual(this.#custom_fields.value, value)) {
            this.#custom_fields = new ValueObjectCustomFields('custom_fields', value);
            this.changedAttributes.custom_fields = this.#custom_fields.value;
        }
    }

    set assigned_to(value) {
        if (!this.#areEqual(this.#assigned_to.value, value)) {
            this.#assigned_to = new ValueObjectAssignedTo('assigned_to', value);
            this.changedAttributes.assigned_to = this.#assigned_to.value;
        }
    }

    /**
     * @returns {ValueObjectCaseId}
     */
    get case_id() {
        return this.#case_id;
    }

    /**
     * @returns {ValueObjectAgendaId}
     */
    get agenda_id() {
        return this.#agenda_id;
    }

    /**
     * @returns {ValueObjectDate}
     */
    get date() {
        return this.#date;
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
     * @returns {ValueObjectLastAppointmentId}
     */
    get last_appointment_id() {
        return this.#last_appointment_id;
    }

    /**
     * @returns {ValueObjectIsCompleted}
     */
    get is_completed() {
        return this.#is_completed;
    }

    /**
     * @returns {ValueObjectIsCanceled}
     */
    get is_canceled() {
        return this.#is_canceled;
    }

    /**
     * @returns {ValueObjectCustomFields}
     */
    get custom_fields() {
        return this.#custom_fields;
    }

    /**
     * @returns {ValueObjectAssignedTo}
     */
    get assigned_to() {
        return this.#assigned_to;
    }

    /**
     * Private method to compare values.
     * @param {any} value
     * @param {any} otherValue
     * @returns {boolean}
     */
    #areEqual(value, otherValue) {
        return value === otherValue;
    }
}
