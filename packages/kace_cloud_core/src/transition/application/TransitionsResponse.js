export class TransitionsResponse {
    /**
     * @type {Transitions}
     * is initialized in the constructor
     */
    #transitions;

    /**
     *
     * @param {Transitions} transitions
     */
    constructor(transitions) {
        this.#transitions = transitions;
    }

    toJson() {
        if (this.#transitions === null) return {};
        return {
            data: {
                id: this.#transitions.id.value,
                estado_actual_id: this.#transitions.estado_actual_id.value,
                siguiente_estado_id: this.#transitions.siguiente_estado_id.value,
                flujo_id: this.#transitions.flujo_id.value,
                is_visible: this.#transitions.is_visible.value,
                status: this.#transitions.status.value,
                created_at: this.#transitions.created_at.value,
                updated_at: this.#transitions.updated_at.value,
                created_by: this.#transitions.created_by.value,
                updated_by: this.#transitions.updated_by.value,
                creator: this.#transitions.creator === null ? null : this.#transitions.creator.toJson(),
            },
        };
    }
}
