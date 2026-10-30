export class AnsCalculateResponse {
    /** @type {any} is initialized in the constructor */
    #processedCases;
    /** @type {any} is initialized in the constructor */
    #elapsedTime;

    constructor(processedCases, elapsedTime) {
        this.#processedCases = processedCases;
        this.#elapsedTime = elapsedTime;
    }

    /**
     * Converts the Ans object to a JSON representation.
     *
     * @returns {Object} A plain object containing the Calculate Ans data.
     */
    toJson() {
        return {
            data: {
                processedCases: this.#processedCases,
                elapsedTime: this.#elapsedTime,
            },
        };
    }
}
