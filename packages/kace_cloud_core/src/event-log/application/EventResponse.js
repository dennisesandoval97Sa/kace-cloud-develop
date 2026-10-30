export class EventResponse {
    /** @type {EventLog} */
    #event;

    /**
     * Creates an instance of EventResponse.
     *
     * @param {EventLog} event - The Event domain object.
     */
    constructor(event) {
        this.#event = event;
    }

    /**
     * Converts the Event object into a plain JSON structure.
     *
     * @returns {Object} A JSON representation of the Event object.
     */
    toJson() {
        const body = { ...this.#event.body.value };
        const eventName = this.#event.event_name.value;

        if (eventName === 'case.updated') {
            delete body.transicion_id;
            delete body.responsable_id;
            delete body.fecha_resolucion;
        }
        return {
            data: {
                id: this.#event.id.value,
                event_name: this.#event.event_name.value,
                occurred_at: this.#event.occurred_at.value,
                initiated_by_user: this.#event.initiated_by_user.value,
                aggregate_id: this.#event.aggregate_id.value,
                body: body,
                old_data: this.#event.old_data.value,
                case_id: this.#event.case_id.value,
                client_id: this.#event.client_id.value,
            },
        };
    }
}
