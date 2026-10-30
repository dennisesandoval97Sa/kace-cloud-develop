export class AuxDefinitionResponse {
    #auxDefinition;

    /**
     * @param {AuxDefinition} auxDefinition
     */
    constructor(auxDefinition) {
        this.#auxDefinition = auxDefinition;
    }

    /**
     * Convierte el objeto AuxDefinition a una representación JSON plana.
     * @returns {Object}
     */
    toJson() {
        if (!this.#auxDefinition) return {};
        return {
            data: {
                id: this.#auxDefinition.id.value,
                name: this.#auxDefinition.name.value,
                tablename: this.#auxDefinition.tablename.value,
                logs_tablename: this.#auxDefinition.logs_tablename.value,
                schema_id: this.#auxDefinition.schema_id.value,
                restflow_id: this.#auxDefinition.restflow_id.value,
                is_active: this.#auxDefinition.is_active.value,
                created_at: this.#auxDefinition.created_at.value,
                created_by: this.#auxDefinition.created_by.value,
                updated_at: this.#auxDefinition.updated_at.value,
                updated_by: this.#auxDefinition.updated_by.value,
                deleted_at: this.#auxDefinition.deleted_at.value,
                deleted_by: this.#auxDefinition.deleted_by.value,
            },
        };
    }
}
