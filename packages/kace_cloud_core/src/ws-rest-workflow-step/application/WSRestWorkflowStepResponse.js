/**
 * Class responsible for creating a WSRestWorkflowStep response.
 */
export class WSRestWorkflowStepResponse {
    /**
     * @type {WSRestWorkflowStep} is initialized in the constructor
     */
    #restWorkflowStep;

    /**
     * @param {WSRestWorkflowStep} restWorkflowStep
     */
    constructor(restWorkflowStep) {
        this.#restWorkflowStep = restWorkflowStep;
    }

    /**
     * Convert the WSRestWorkflowStep to JSON format.
     * @returns {Object} The JSON representation of the WSRestWorkflowStep.
     */
    toJson() {
        if (!this.#restWorkflowStep) return {};

        return {
            data: {
                id: this.#restWorkflowStep.id.value,
                flow_id: this.#restWorkflowStep.flow_id.value,
                order: this.#restWorkflowStep.order.value,
                endpoint_id: this.#restWorkflowStep.endpoint_id.value,
                function_id: this.#restWorkflowStep.function_id.value,
                created_at: this.#restWorkflowStep.created_at.value,
                updated_at: this.#restWorkflowStep.updated_at.value,
                deleted_at: this.#restWorkflowStep.deleted_at.value,
                created_by: this.#restWorkflowStep.created_by.value,
                updated_by: this.#restWorkflowStep.updated_by.value,
                deleted_by: this.#restWorkflowStep.deleted_by.value,
            },
        };
    }
}
