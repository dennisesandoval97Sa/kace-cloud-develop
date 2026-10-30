export class FlowResponse {
    /**
     * @type {Flow}
     * is initialized in the constructor
     */
    #flow;

    constructor(flow) {
        this.#flow = flow;
    }

    /**
     *
     * @returns {Flow} json object representation for Flow instance
     */
    toJson() {
        if (this.#flow === null) return {};
        return {
            data: {
                id: this.#flow.id.value,
                nombre: this.#flow.nombre.value,
                json_flujo: this.#flow.json_flujo.value,
                status: this.#flow.status.value,
                created_at: this.#flow.created_at.value,
                updated_at: this.#flow.updated_at.value,
                created_by: this.#flow.created_by.value,
                updated_by: this.#flow.updated_by.value,
                deleted_at: this.#flow.deleted_at.value,
                deleted_by: this.#flow.deleted_by.value,
            },
        };
    }
}
