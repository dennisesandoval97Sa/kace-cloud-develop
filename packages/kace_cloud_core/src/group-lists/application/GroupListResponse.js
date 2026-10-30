export class GroupListResponse {
    /** @type {Object} is initialized in the constructor */
    #groupList;

    constructor(groupList) {
        this.#groupList = groupList;
    }

    /**
     * Converts the GroupList object to a JSON representation.
     *
     * @returns {Object} A plain object containing the GroupList data.
     */
    toJson() {
        if (!this.#groupList) return {};
        return {
            data: {
                id: this.#groupList.id.value,
                descripcion: this.#groupList.descripcion.value,
                lista_grupos: this.#groupList.lista_grupos.value,
                is_active: this.#groupList.is_active.value,
                created_at: this.#groupList.created_at.value,
                updated_at: this.#groupList.updated_at.value,
                created_by: this.#groupList.created_by.value,
                updated_by: this.#groupList.updated_by.value,
            },
        };
    }
}
