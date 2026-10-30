export class ShiftManagementResponse {
    /** @type {ShiftManagement} is initialized in the constructor */
    #shiftManagement;

    /**
     * Creates an instance of ShiftManagementResponse.
     *
     * @param {ShiftManagement} shiftManagement - The ShiftManagement instance.
     */
    constructor(shiftManagement) {
        this.#shiftManagement = shiftManagement;
    }

    /**
     * Converts the ShiftManagement object to a JSON representation.
     *
     * @returns {Object} A flat object containing the ShiftManagement data.
     */
    toJson() {
        if (!this.#shiftManagement) return {};

        return {
            data: {
                id: this.#shiftManagement.id.value,
                description: this.#shiftManagement.description.value,
                holiday_dates: this.#shiftManagement.holiday_dates.value,
                work_days: this.#shiftManagement.work_days.value,
                created_at: this.#shiftManagement.created_at.value,
                created_by: this.#shiftManagement.created_by.value,
                updated_at: this.#shiftManagement.updated_at.value,
                updated_by: this.#shiftManagement.updated_by.value,
            },
        };
    }
}
