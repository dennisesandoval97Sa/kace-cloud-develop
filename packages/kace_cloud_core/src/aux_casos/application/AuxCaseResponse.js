export class AuxCaseResponse {
    /** @type {AuxCases} is initialized in the constructor */
    #auxCase;

    /**
     *
     * @param {AuxCases} auxCase Aggregate for return data
     */
    constructor(auxCase) {
        this.#auxCase = auxCase;
    }

    toJson() {
        if (this.#auxCase === null) return {};
        return {
            data: {
                id: this.#auxCase.id.value,
                caso_id: this.#auxCase.caso_id.value,
                data: this.#auxCase.data.value,
                created_at: this.#auxCase.created_at.value,
                created_by: this.#auxCase.created_by.value,
                updated_at: this.#auxCase.updated_at.value,
                updated_by: this.#auxCase.updated_by.value,
            },
        };
    }
}
