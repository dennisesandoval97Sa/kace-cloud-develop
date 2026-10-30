/**
 * Class representing a response for a CaseSessionDuration object.
 */
export class CaseSessionDurationResponse {
    /** @type {CaseSessionDuration} is initialized in the constructor */
    #caseSessionDuration;

    /**
     * @param {CaseSessionDuration} caseSessionDuration
     */
    constructor(caseSessionDuration) {
        this.#caseSessionDuration = caseSessionDuration;
    }

    /**
     * Converts the CaseSessionDuration object to a JSON representation.
     * @returns {Object} The JSON representation of the CaseSessionDuration.
     */
    toJson() {
        if (!this.#caseSessionDuration) return {};
        // Use the aggregate's toJson() to return primitives (ValueObject.value)
        return {
            data: this.#caseSessionDuration.toJson(),
        };
    }
}
