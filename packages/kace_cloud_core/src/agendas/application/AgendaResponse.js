export class AgendaResponse {
    /**
     * @type {Agenda} is initialized in the constructor
     */
    #agenda;

    constructor(agenda) {
        this.#agenda = agenda;
    }

    /**
     * Converts the Agenda object to a JSON format.
     *
     * @returns {Object} The Agenda object in JSON format or an empty object if the Agenda object is not set.
     */
    toJson() {
        return this.#agenda ? this.#convertToJson() : {};
    }

    /**
     * Converts the Agenda object to a JSON format.
     *
     * @returns {Object} The Agenda object in JSON format.
     */
    #convertToJson() {
        return {
            data: {
                id: this.#agenda.id.value,
                description: this.#agenda.description.value,
                is_active: this.#agenda.is_active.value,
                one_script_id: this.#agenda.one_script_id.value,
                daily_limit: this.#agenda.daily_limit.value,
                is_for_weekend: this.#agenda.is_for_weekend.value,
                created_at: this.#agenda.created_at.value,
                updated_at: this.#agenda.updated_at.value,
                created_by: this.#agenda.created_by.value,
                updated_by: this.#agenda.updated_by.value,
                deleted_at: this.#agenda.deleted_at.value,
                deleted_by: this.#agenda.deleted_by.value,
            },
        };
    }
}
