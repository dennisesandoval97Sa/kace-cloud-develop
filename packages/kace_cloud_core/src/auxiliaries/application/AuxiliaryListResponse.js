export class AuxiliaryListResponse {
    #auxiliary;

    /**
     * @param {Auxiliary} auxiliary
     */
    constructor(auxiliary) {
        this.#auxiliary = auxiliary;
    }

    /**
     * Convierte el objeto Auxiliary a una representación JSON plana.
     * @returns {Object}
     */
    toJson() {
        if (!this.#auxiliary) return {};
        return {
            data: {
                value: this.#auxiliary.id.value,
                label: this.#auxiliary.data.value,
            },
        };
    }
}
