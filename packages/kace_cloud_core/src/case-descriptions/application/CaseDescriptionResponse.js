export class CaseDescriptionResponse {
    /**
     * @type {CaseDescription}
     * is initialized in the constructor
     */
    #caseDescription;

    /**
     * Creates an instance of `CaseDescriptionResponse`.
     *
     * @param {CaseDescription} caseDescription - The `CaseDescription` instance.
     */
    constructor(caseDescription) {
        this.#caseDescription = caseDescription;
    }

    /**
     * Converts the `CaseDescription` object to a JSON representation.
     *
     * @returns {Object} A flat object containing the case description data.
     */
    toJson() {
        if (!this.#caseDescription) return {};

        return {
            data: {
                id: this.#caseDescription.id.value,
                descripcion: this.#caseDescription.descripcion.value,
                created_at: this.#caseDescription.created_at.value,
                updated_at: this.#caseDescription.updated_at.value,
                created_by: this.#caseDescription.created_by.value,
                updated_by: this.#caseDescription.updated_by.value,
            },
        };
    }
}
