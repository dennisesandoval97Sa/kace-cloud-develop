export class ActionQueueExecutorResponse {
    /**
     * @type {Object}
     */
    #results;

    /**
     *
     * @param {Object} results
     */
    constructor(results) {
        this.#results = results;
    }

    /**
     * Convert the action queue processor response to JSON format
     * @returns {Object} JSON representation of the response
     */
    toJson() {
        const response = {
            data: {
                processed: this.#results.processed,
                successful: this.#results.successful,
                failed: this.#results.failed,
            },
            metadata: {
                timestamp: new Date().toISOString(),
                status: 'completed',
            },
        };

        if (this.#results.skipped) {
            response.data.skipped = true;
            response.metadata.reason = this.#results.reason || 'unknown';
            response.metadata.status = 'skipped';
        }

        return response;
    }
}
