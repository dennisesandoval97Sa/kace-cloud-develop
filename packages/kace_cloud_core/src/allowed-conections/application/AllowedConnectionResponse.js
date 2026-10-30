export class AllowedConnectionResponse {
    /**
     * @type {AllowedConnection}
     * is initialized in the constructor
     */
    #allowedConnection;

    /**
     * Creates an instance of AllowedConnectionResponse.
     * @param {AllowedConnection} allowedConnection - The AllowedConnection instance.
     */
    constructor(allowedConnection) {
        this.#allowedConnection = allowedConnection;
    }

    /**
     * Converts the AllowedConnection object to a JSON representation.
     *
     * @returns {Object} A flat object containing the allowed connection data.
     */
    toJson() {
        if (!this.#allowedConnection) return {};

        return {
            data: {
                id: this.#allowedConnection.id.value,
                description: this.#allowedConnection.description.value,
                connection: this.#allowedConnection.connection.value,
                certificate: this.#allowedConnection.certificate.value,
                is_active: this.#allowedConnection.is_active.value,
                has_ssl: this.#allowedConnection.has_ssl.value,
                created_at: this.#allowedConnection.created_at.value,
                updated_at: this.#allowedConnection.updated_at.value,
                created_by: this.#allowedConnection.created_by.value,
                updated_by: this.#allowedConnection.updated_by.value,
            },
        };
    }
}
