export class UserGroupResponse {
    /** @type {UserGroupRelationship} is initialized in the constructor */
    #userGroup;

    /**
     * Creates an instance of UserGroupResponse.
     * @param {UserGroupRelationship} userGroup - The UserGroupRelationship instance.
     */
    constructor(userGroup) {
        this.#userGroup = userGroup;
    }

    /**
     * Converts the `UserGroupRelationship` object to a JSON representation.
     *
     * @returns {Object} A flat object containing the user group relation data.
     */
    toJson() {
        if (!this.#userGroup) return {};
        return {
            data: {
                usuario_id: this.#userGroup.usuario_id.value,
                grupo_id: this.#userGroup.grupo_id.value,
                grupo: {
                    ...(this.#userGroup.nombre.value ? { nombre: this.#userGroup.nombre.value } : {}),
                },
                usuario: {
                    ...(this.#userGroup.nombre_usuario.value ? { nombre: this.#userGroup.nombre_usuario.value } : {}),
                },
            },
        };
    }
}
