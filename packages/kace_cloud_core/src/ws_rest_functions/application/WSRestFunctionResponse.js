export class WSRestFunctionResponse {
    /**
     * @type { WSRestFunction } is initialized in the constructor
     */
    #restFunction;

    /**
     *
     * @param {WSRestFunction} restFunction
     */
    constructor(restFunction) {
        this.#restFunction = restFunction;
    }

    /**
     * Converts the RestFunction object to a JSON format.
     *
     * @returns {Object} The RestFunction object in JSON format or an empty object if the RestFunction object is not set.
     */
    toJson() {
        return this.#restFunction ? this.#convertToJson() : {};
    }

    /**
     * Converts the RestFunction object to a JSON format.
     *
     * @returns {Object} The RestFunction object in JSON format.
     */
    #convertToJson() {
        return {
            data: {
                id: this.#restFunction.id.value,
                description: this.#restFunction.description.value,
                type: this.#restFunction.type.value,
                filter_input: this.#restFunction.filter_input.value,
                context_position: this.#restFunction.context_position.value,
                value_static: this.#restFunction.type.value === 'increment'
                    ? parseInt(this.#restFunction.value_static.value)
                    : this.#restFunction.value_static.value,
                value_dynamic: this.#restFunction.value_dynamic.value,
                is_active: this.#restFunction.is_active.value,
                created_at: this.#restFunction.created_at.value,
                updated_at: this.#restFunction.updated_at.value,
                created_by: this.#restFunction.created_by.value,
                updated_by: this.#restFunction.updated_by.value,
            },
        };
    }
}
