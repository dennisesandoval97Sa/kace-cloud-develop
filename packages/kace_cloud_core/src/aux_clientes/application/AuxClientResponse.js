export class AuxClientResponse {
    /** @type {AuxClients} is initialized in the constructor */
    #auxClients;

    /**
     *
     * @param {AuxClients} auxClients Aggregate for return data
     */
    constructor(auxClients) {
        this.#auxClients = auxClients;
    }

    /**
     *
     * @returns {Promise<Object} Object aux clients data to response
     */
    toJson() {
        if (this.#auxClients === null) return {};
        return {
            data: {
                id: this.#auxClients.id.value,
                cliente_id: this.#auxClients.cliente_id.value,
                data: this.#auxClients.data.value,
                relations: this.#auxClients.relations.value,
                created_at: this.#auxClients.created_at.value,
                created_by: this.#auxClients.created_by.value,
                updated_at: this.#auxClients.updated_at.value,
                updated_by: this.#auxClients.updated_by.value,
            },
        };
    }
}
