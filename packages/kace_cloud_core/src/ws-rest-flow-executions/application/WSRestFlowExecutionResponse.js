export class WSRestFlowExecutionResponse {
    /** @type {WSRestFlowExecution} */
    #execution;

    /**
     * @param {WSRestFlowExecution} execution
     */
    constructor(execution) {
        this.#execution = execution;
    }

    toJson() {
        if (!this.#execution) return {};

        return {
            data: {
                id: this.#execution.id.value,
                flow_id: this.#execution.flow_id.value,
                external_code: this.#execution.external_code.value,
                initial_context: this.#execution.initial_context.value,
                status: this.#execution.status.value,
                result: this.#execution.result.value,
                error: this.#execution.error.value,
                created_by: this.#execution.created_by?.value,
                created_at: this.#execution.created_at?.value,
                started_at: this.#execution.started_at.value,
                completed_at: this.#execution.completed_at.value,
            },
        };
    }
}
