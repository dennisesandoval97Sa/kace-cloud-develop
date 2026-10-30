export class ActionUpdateModelResponse {
    /** @type {ModelUpdate} is initialized in the constructor */
    #modelUpdate;

    /**
     * Creates an instance of ModelUpdateResponse.
     *
     * @param {ModelUpdate} modelUpdate - The ModelUpdate instance.
     */
    constructor(modelUpdate) {
        this.#modelUpdate = modelUpdate;
    }

    /**
     * Converts the ModelUpdate object to a JSON representation.
     *
     * @returns {Object} A flat object containing the ModelUpdate data.
     */
    toJson() {
        if (!this.#modelUpdate) return {};

        return {
            data: {
                id: this.#modelUpdate.id.value,
                description: this.#modelUpdate.description.value,
                aggregate: this.#modelUpdate.aggregate.value,
                field: this.#modelUpdate.field.value,
                type: this.#modelUpdate.type.value,
                value: this.#modelUpdate.value.value,
                formula: this.#modelUpdate.formula.value,
                created_at: this.#modelUpdate.created_at.value,
                created_by: this.#modelUpdate.created_by.value,
                updated_at: this.#modelUpdate.updated_at.value,
                updated_by: this.#modelUpdate.updated_by.value,
            },
        };
    }
}
