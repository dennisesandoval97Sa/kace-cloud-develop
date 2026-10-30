export class AuxiliaryResponse {
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
                id: this.#auxiliary.id.value,
                data: this.#auxiliary.data.value,
                created_at: this.#auxiliary.created_at.value,
                created_by: this.#auxiliary.created_by.value,
                updated_at: this.#auxiliary.updated_at.value,
                updated_by: this.#auxiliary.updated_by.value,
                deleted_at: this.#auxiliary.deleted_at.value,
                deleted_by: this.#auxiliary.deleted_by.value,
            },
        };
    }
}
