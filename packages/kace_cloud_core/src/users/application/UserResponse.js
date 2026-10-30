export class UserResponse {
    /** @type {User} is initialized in the constructor */
    #user;

    /**
     * Creates an instance of UserResponse.
     * @param {User} user - The User instance.
     */
    constructor(user) {
        this.#user = user;
    }

    /**
     * Converts the User object to a JSON representation.
     *
     * @returns {Object} A flat object containing the user data.
     */
    toJson() {
        if (this.#user === null || this.#user === undefined) return {};
        const response = {
            id: this.#user.id.value,
            login: this.#user.login.value,
            nombres: this.#user.nombres.value,
            apellido1: this.#user.apellido1.value,
            apellido2: this.#user.apellido2.value,
            email: this.#user.email.value,
            token: this.#user.token.value,
            telefono: this.#user.telefono.value,
            movil: this.#user.movil.value,
            is_active: this.#user.is_active.value,
            account_type: this.#user.account_type.value,
            filters: this.#user.filters.value,
            external_id: this.#user.external_id.value,
            codigos_externos: this.#user.codigos_externos.value,
            rol_id: this.#user.rol_id.value,
            grupo_activo: this.#user.grupo_activo.value,
            data: this.#user.data.value,
            ips_allowed: this.#user.ips_allowed.value,
            created_at: this.#user.created_at.value,
            created_by: this.#user.created_by.value,
            updated_at: this.#user.updated_at.value,
            updated_by: this.#user.updated_by.value,
            deleted_at: this.#user.deleted_at.value,
            deleted_by: this.#user.deleted_by.value,
        };

        if (this.#user.expiredCasesCount !== null && this.#user.expiredCasesCount !== undefined) {
            response.expiredCases = this.#user.expiredCasesCount?.value;
            response.intermediateCases = this.#user.intermediateCasesCount?.value;
            response.notExpiredCases = this.#user.notExpiredCasesCount?.value;
        }

        response.groups = this.#user.groups || [];

        return { data: response };
    }
}
