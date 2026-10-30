export class AppointmentTimeSlotsResponse {
    /**
     * @type {AppointmentTimeSlots}
     */
    #appointmentTimeSlots;

    constructor(appointmentTimeSlots) {
        this.#appointmentTimeSlots = appointmentTimeSlots;
    }

    /**
     * Convert the object to JSON format.
     */
    toJson() {
        return this.#appointmentTimeSlots ? this.#convertToJson() : {};
    }

    /**
     * Convert the object to JSON format (private method).
     *
     * @returns {object} - The object in JSON format.
     * @private
     */
    #convertToJson() {
        return {
            data: {
                id: this.#appointmentTimeSlots.id.value,
                description: this.#appointmentTimeSlots.description.value,
                start_time: this.#appointmentTimeSlots.start_time.value,
                end_time: this.#appointmentTimeSlots.end_time.value,
                agenda_id: this.#appointmentTimeSlots.agenda_id.value,
                is_active: this.#appointmentTimeSlots.is_active.value,
                max_appointments: this.#appointmentTimeSlots.max_appointments.value,
                created_by: this.#appointmentTimeSlots.created_by.value,
                updated_by: this.#appointmentTimeSlots.updated_by.value,
                deleted_by: this.#appointmentTimeSlots.deleted_by.value,
                created_at: this.#appointmentTimeSlots.created_at.value,
                updated_at: this.#appointmentTimeSlots.updated_at.value,
                deleted_at: this.#appointmentTimeSlots.deleted_at.value,
            },
        };
    }
}
