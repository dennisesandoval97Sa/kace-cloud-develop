export class UserListResponse {
    /** @type {Object} is initialized in the constructor */
    #userList;

    constructor(userList) {
        this.#userList = userList;
    }

    /**
     * Converts the userList object to a JSON representation.
     *
     * @returns {Object} A plain object containing the userList data.
     */
    toJson() {
        if (!this.#userList) return {};
        return {
            data: {
                id: this.#userList.id.value,
                descripcion: this.#userList.descripcion.value,
                lista_usuarios: this.#userList.lista_usuarios.value,
                group_id: this.#userList.group_id.value,
                is_active: this.#userList.is_active.value,
                created_at: this.#userList.created_at.value,
                updated_at: this.#userList.updated_at.value,
                created_by: this.#userList.created_by.value,
                updated_by: this.#userList.updated_by.value,
            },
        };
    }
}
