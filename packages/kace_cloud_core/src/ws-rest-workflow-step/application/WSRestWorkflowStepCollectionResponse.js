import { WSRestWorkflowStepResponse } from './WSRestWorkflowStepResponse.js';

/**
 * Class responsible for creating a WSRestWorkflowStepCollectionResponse.
 */
export class WSRestWorkflowStepCollectionResponse {
    /**
     * @type {Array<WSRestWorkflowStep>} is initialized in the constructor
     */
    #restWorkflowSteps;

    /**
     * @type {number} is initialized in the constructor
     */
    #count;

    /**
     * @param {Array<WSRestWorkflowStep>} restWorkflowSteps
     * @param {number} count
     */
    constructor(restWorkflowSteps, count) {
        this.#restWorkflowSteps = restWorkflowSteps;
        this.#count = count;
    }

    /**
     * Convert the WSRestWorkflowStepCollectionResponse to JSON format.
     * @returns {Object} The JSON representation of the WSRestWorkflowStepCollectionResponse.
     */
    toJson() {
        return {
            data: {
                items: this.#restWorkflowSteps.map((step) => new WSRestWorkflowStepResponse(step).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
