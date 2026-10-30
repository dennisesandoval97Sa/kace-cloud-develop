export class StateResponse {
    /** @type {State|null} is initialized in the constructor */
    #state;

    constructor(state) {
        this.#state = state;
    }

    /**
     * Converts the State object to a JSON representation.
     *
     * @returns {Object} A plain object containing the State data.
     */
    toJson() {
        if (this.#state === null) return {};

        return {
            data: {
                id: this.#state.id.value,
                nombre: this.#state.nombre.value,
                descripcion: this.#state.descripcion?.value,
                icon_class: this.#state.icon_class?.value,
                status: this.#state.status?.value,
                color: this.#state.color?.value,
                require_observation: this.#state.require_observation?.value,
                created_by: this.#state.created_by.value,
                updated_by: this.#state.updated_by.value,
                created_at: this.#state.created_at.value,
                updated_at: this.#state.updated_at?.value,
                deleted_at: this.#state.deleted_at.value,
                deleted_by: this.#state.deleted_by.value,
            },
        };
    }
}
