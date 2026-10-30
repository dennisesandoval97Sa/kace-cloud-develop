/**
 * Response object for workflow execution results
 */
export class WorkflowExecutorResponse {
    /**
     * @type {GlobalContext}
     */
    #globalContext;

    /**
     * @param {GlobalContext} globalContext - Global context after execution
     */
    constructor(globalContext) {
        this.#globalContext = globalContext;
    }

    /**
     * Convert the workflow execution result to JSON format
     * @returns {Object} JSON representation of execution result
     */
    toJson() {
        return {
            data: {
                context: this.#globalContext.get()?.context,
            },
            metadata: {
                timestamp: new Date().toISOString(),
            },
        };
    }
}
