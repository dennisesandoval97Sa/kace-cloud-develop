export class WSRestFlowResponse {
    /** @type {WSRestFlow} is initialized in the constructor */
    #wsRestFlow;

    /**
     * Creates an instance of `WSRestFlowResponse`.
     *
     * @param {WSRestFlow} flow - The `WSRestFlow` instance.
     */
    constructor(flow) {
        this.#wsRestFlow = flow;
    }

    /**
     * Converts the `WSRestFlow` object to a JSON representation.
     *
     * @returns {Object} A flat object containing the WS REST flow data.
     */
    toJson() {
        if (!this.#wsRestFlow) return {};

        return {
            data: {
                id: this.#wsRestFlow.id.value,
                description: this.#wsRestFlow.description.value,
                external_code: this.#wsRestFlow.external_code.value,
                json_diagram_properties: this.#wsRestFlow.json_diagram_properties.value,
                is_active: this.#wsRestFlow.is_active.value,
                is_primary: this.#wsRestFlow.is_primary.value,
                created_at: this.#wsRestFlow.created_at.value,
                created_by: this.#wsRestFlow.created_by.value,
                updated_at: this.#wsRestFlow.updated_at.value,
                updated_by: this.#wsRestFlow.updated_by.value,
            },
        };
    }
}
