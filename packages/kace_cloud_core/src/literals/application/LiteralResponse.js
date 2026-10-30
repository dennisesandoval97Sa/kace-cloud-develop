export class LiteralResponse {
    /** @type {Literal} is initialized in the constructor*/
    #literal;

    /**
     * Creates an instance of `LiteralResponse`.
     * @param {Literal} literal - The `Literal` instance to wrap.
     */
    constructor(literal) {
        this.#literal = literal;
    }

    /**
     * Converts the `Literal` object to a JSON representation.
     *
     * @returns {Object} A flat object containing the literal data.
     */
    toJson() {
        if (!this.#literal) return {};

        return {
            data: {
                id: this.#literal.id.value,
                tipo_literal: this.#literal.tipo_literal.value,
                nombre: this.#literal.nombre.value,
                is_active: this.#literal.is_active.value,
                created_at: this.#literal.created_at.value,
                updated_at: this.#literal.updated_at.value,
                created_by: this.#literal.created_by.value,
                updated_by: this.#literal.updated_by.value,
            },
        };
    }
}
