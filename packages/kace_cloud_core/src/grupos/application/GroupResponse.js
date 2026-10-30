export class GroupResponse {
    /** @type {Groups} is initialized in the constructor */
    #group;
    /**
     *
     * @param {Groups} group
     */
    constructor(group) {
        this.#group = group;
    }

    toJson() {
        if (this.#group === null) return {};

        const response = {
            id: this.#group.id.value,
            nombre: this.#group.nombre.value,
            horario_id: this.#group.horario_id.value,
            status: this.#group.status.value,
            descripcion: this.#group.descripcion.value,
            codigo_externo: this.#group.codigo_externo.value,
            codigos_externos: this.#group.codigos_externos.value,
            permisos: this.#group.permisos.value,
            layouts: this.#group.layouts.value,
            comportamientos: this.#group.comportamientos.value,
            filter_order: this.#group.filter_order.value,
            rol_id: this.#group.rol_id.value,
            configuration_id: this.#group.configuration_id.value,
            data: this.#group.data.value,
            ips_allowed: this.#group.ips_allowed.value,
            created_by: this.#group.created_by.value,
            created_at: this.#group.created_at.value,
            updated_by: this.#group.updated_by?.value,
            updated_at: this.#group.updated_at?.value,
        };

        if (this.#group.expiredCasesCount !== null && this.#group.expiredCasesCount !== undefined) {
            response.expiredCases = this.#group.expiredCasesCount?.value;
            response.intermediateCases = this.#group.intermediateCasesCount?.value;
            response.notExpiredCases = this.#group.notExpiredCasesCount?.value;
        }

        return {
            data: response,
        };
    }
}
