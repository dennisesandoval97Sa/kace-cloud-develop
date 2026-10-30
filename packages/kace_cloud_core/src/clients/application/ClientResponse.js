export class ClientResponse {
    /** @type {Client}  is initialized in the constructor*/
    #client;

    constructor(client) {
        this.#client = client;
    }

    /**
     * Converts the Client object to a JSON representation.
     *
     * @returns {Object} A plain object containing the Client data.
     */
    toJson() {
        const relations = this.#client.relations?.value;
        const hasRelations = relations && Object.keys(relations).length > 0;

        return {
            data: {
                id: this.#client.id.value,
                tipo_cliente: this.#client.tipo_cliente.value,
                tipo_documento: this.#client.tipo_documento.value,
                documento: this.#client.documento.value,
                nombre_empresa: this.#client.nombre_empresa.value,
                nombres: this.#client.nombres.value,
                apellido1: this.#client.apellido1.value,
                apellido2: this.#client.apellido2.value,
                sexo: this.#client.sexo.value,
                estado_civil: this.#client.estado_civil.value,
                fecha_nacimiento: this.#client.fecha_nacimiento.value,
                email: this.#client.email.value,
                email_alterno: this.#client.email_alterno.value,
                telefono: this.#client.telefono.value,
                telefono_alterno: this.#client.telefono_alterno.value,
                campos_extra1: this.#client.campos_extra1.value,
                campos_extra2: this.#client.campos_extra2.value,
                campos_extra3: this.#client.campos_extra3.value,
                status: this.#client.status.value,
                habeas_data: this.#client.habeas_data.value,
                padre_id: this.#client.padre_id.value,
                created_at: this.#client.created_at.value,
                created_by: this.#client.created_by.value,
                updated_at: this.#client.updated_at.value,
                updated_by: this.#client.updated_by.value,
                ...(hasRelations && { relations }),
            },
        };
    }
}
