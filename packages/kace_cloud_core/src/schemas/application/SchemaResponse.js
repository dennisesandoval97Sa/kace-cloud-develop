export class SchemaResponse {
    #schema;

    /**
     * @param {Schema} schema
     */
    constructor(schema) {
        this.#schema = schema;
    }

    /**
     * Convierte el objeto Schema a una representación JSON plana.
     * @returns {Object}
     */
    toJson() {
        if (!this.#schema) return {};
        return {
            data: {
                id: this.#schema.id.value,
                name: this.#schema.name.value,
                is_active: this.#schema.is_active.value,
                data_structure: this.#schema.data_structure.value,
                created_at: this.#schema.created_at.value,
                created_by: this.#schema.created_by.value,
                updated_at: this.#schema.updated_at.value,
                updated_by: this.#schema.updated_by.value,
                deleted_at: this.#schema.deleted_at.value,
                deleted_by: this.#schema.deleted_by.value,
            },
        };
    }
}
