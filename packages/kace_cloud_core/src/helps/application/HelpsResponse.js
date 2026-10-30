export class HelpsResponse {
    /** @type {Helps} is initialized in the constructor */
    #help;

    /**
     *
     * @param {Helps} help
     */
    constructor(help) {
        this.#help = help;
    }

    /**
     *
     * @returns {Object}
     */
    toJson() {
        if (this.#help === null) return {};

        return {
            data: {
                id: this.#help.id.value,
                titulo: this.#help.titulo.value,
                descripcion: this.#help.descripcion.value,
                color: this.#help.color.value,
                is_active: this.#help.is_active.value,
                created_by: this.#help.created_by.value,
                created_at: this.#help.created_at.value,
                updated_by: this.#help.updated_by.value,
                updated_at: this.#help.updated_at.value,
            },
        };
    }
}
