export class RoleResponse {
    /** @type {Role} is initialized in the constructor */
    #role;
    constructor(role) {
        this.#role = role;
    }

    toJson() {
        if (this.#role === null) return {};

        const data = {
            id: this.#role.id.value,
            descripcion: this.#role.descripcion.value,
            status: this.#role.status.value,
            created_at: this.#role.created_at.value,
            updated_at: this.#role.updated_at.value,
            created_by: this.#role.created_by.value,
            updated_by: this.#role.updated_by.value,
            deleted_by: this.#role.deleted_by.value,
            deleted_at: this.#role.deleted_at.value,
        };

        if (this.#role.permisos.value) {
            data.permisos = this.#role.permisos.value;
        }

        return { data };
    }
}
