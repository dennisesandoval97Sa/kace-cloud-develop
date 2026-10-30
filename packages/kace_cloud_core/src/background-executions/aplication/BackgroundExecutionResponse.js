export class BackgroundExecutionResponse {
    /** @type {BackgroundExecution} is initialized in the constructor */
    #backgroundExecution;

    /**
     * Creates an instance of `WSRestEndpointResponse`.
     *
     * @param {BackgroundExecution} backgroundExecution - The `WSRestEndpoint` instance.
     */
    constructor(backgroundExecution) {
        this.#backgroundExecution = backgroundExecution;
    }

    /**
     * Converts the `BackgroundExecution` object to a JSON representation.
     *
     * @returns {Object} A flat object containing the Background Execution data.
     */
    toJson() {
        if (!this.#backgroundExecution) return {};

        return {
            data: {
                id: this.#backgroundExecution.id.value,
                proccess_description: this.#backgroundExecution.proccess_description.value,
                execution_status: this.#backgroundExecution.execution_status.value,
            },
        };
    }
}
