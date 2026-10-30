export class SecretsResponse {
    /** @type {SecretsVault} is initialized in the constructor */
    #secrets;

    /**
     *
     * @param {SecretsVault} secrets
     */
    constructor(secrets) {
        this.#secrets = secrets;
    }

    toJson() {
        if (this.#secrets == null) return {};
        return {
            data: {
                id: this.#secrets.id.value,
                descripcion: this.#secrets.descripcion.value,
                referencia: this.#secrets.referencia.value,
                secreto: '***',
                created_at: this.#secrets.created_at.value,
                created_by: this.#secrets.created_by.value,
                updated_at: this.#secrets.updated_at.value,
                updated_by: this.#secrets.updated_by.value,
            },
        };
    }
}
