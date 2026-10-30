export class ActionJobProcessingResponse {
    /** @type {ActionJobProcessing} is initialized in the constructor */
    #actionExecution;

    /**
     * Creates an instance of ActionJobProcessingResponse.
     *
     * @param {ActionJobProcessing} actionExecution - The ActionJobProcessing instance.
     */
    constructor(actionExecution) {
        this.#actionExecution = actionExecution;
    }

    /**
     * Converts the ActionJobProcessing object to a JSON representation.
     *
     * @returns {Object} A flat object containing the ActionJobProcessing data.
     */
    toJson() {
        if (!this.#actionExecution) return {};

        return {
            data: {
                id: this.#actionExecution.id.value,
                job_id: this.#actionExecution.job_id.value,
                action_id: this.#actionExecution.action_id.value,
                case_id: this.#actionExecution.case_id.value,
                client_id: this.#actionExecution.client_id.value,
                is_in_progress: this.#actionExecution.is_in_progress.value,
                is_completed: this.#actionExecution.is_completed.value,
                is_failed: this.#actionExecution.is_failed.value,
                start_at: this.#actionExecution.start_at.value,
                end_at: this.#actionExecution.end_at.value,
                details: this.#actionExecution.details.value,
                evaluate_conditions: this.#actionExecution.evaluate_conditions.value,
                restflow_id: this.#actionExecution.restflow_id.value,
                created_by: this.#actionExecution.created_by.value,
                created_at: this.#actionExecution.created_at.value,
                updated_by: this.#actionExecution.updated_by.value,
                updated_at: this.#actionExecution.updated_at.value,
            },
        };
    }
}
