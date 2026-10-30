/**
 * Class representing a response for an Appointment object.
 */
export class AppointmentResponse {
    /** @type {Appointment} is initialized in the constructor */
    #appointment;

    /**
     * @param {Appointment} appointment
     */
    constructor(appointment) {
        this.#appointment = appointment;
    }

    /**
     * Converts the Appointment object to a JSON representation.
     * @returns {Object} The JSON representation of the Appointment.
     */
    toJson() {
        if (!this.#appointment) return {};
        return {
            data: {
                id: this.#appointment.id.value,
                case_id: this.#appointment.case_id.value,
                agenda_id: this.#appointment.agenda_id.value,
                date: this.#appointment.date.value,
                start_time: this.#appointment.start_time.value,
                end_time: this.#appointment.end_time.value,
                last_appointment_id: this.#appointment.last_appointment_id.value,
                is_completed: this.#appointment.is_completed.value,
                is_canceled: this.#appointment.is_canceled.value,
                custom_fields: this.#appointment.custom_fields.value,
                assigned_to: this.#appointment.assigned_to.value,
                created_at: this.#appointment.created_at.value,
                updated_at: this.#appointment.updated_at.value,
                deleted_at: this.#appointment.deleted_at.value,
                created_by: this.#appointment.created_by.value,
                updated_by: this.#appointment.updated_by.value,
                deleted_by: this.#appointment.deleted_by.value,
            },
        };
    }
}
