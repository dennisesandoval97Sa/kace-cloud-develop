export class WSRestConditionalResponse {
    /** @type {WSRestConditional} is initialized in the constructor */
    #wsRestConditional;

    /**
     * Creates an instance of `WSRestConditionalResponse`.
     *
     * @param {WSRestConditional} conditional - The `WSRestConditional` instance.
     */
    constructor(conditional) {
        this.#wsRestConditional = conditional;
    }

    /**
     * Converts the `WSRestConditional` object to a JSON representation.
     *
     * @returns {Object} A flat object containing the WS REST conditional data.
     */
    toJson() {
        if (!this.#wsRestConditional) return {};

        return {
            data: {
                id: this.#wsRestConditional.id.value,
                satisfied: this.#wsRestConditional.satisfied.value,
                unsatisfied: this.#wsRestConditional.unsatisfied.value,
                input_path_a: this.#wsRestConditional.input_path_a.value,
                input_path_b: this.#wsRestConditional.input_path_b.value,
                operator: this.#wsRestConditional.operator.value,
                created_at: this.#wsRestConditional.created_at.value,
                created_by: this.#wsRestConditional.created_by.value,
            },
        };
    }
}
