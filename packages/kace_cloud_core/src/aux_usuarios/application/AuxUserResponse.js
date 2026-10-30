export class AuxUserResponse {
    /** @type {AuxUsers} is initialized in the constructor */
    #auxUsers;

    /**
     *
     * @param {AuxUsers} auxUsers Aggregate for return data
     */
    constructor(auxUsers) {
        this.#auxUsers = auxUsers;
    }

    /**
     *
     * @returns {Promise<Object} Object aux users data to response
     */
    toJson() {
        if (this.#auxUsers === null) return {};
        return {
            data: {
                id: this.#auxUsers.id.value,
                usuario_id: this.#auxUsers.usuario_id.value,
                data: this.#auxUsers.data.value,
                created_at: this.#auxUsers.created_at.value,
                created_by: this.#auxUsers.created_by.value,
                updated_at: this.#auxUsers.updated_at.value,
                updated_by: this.#auxUsers.updated_by.value,
            },
        };
    }
}
