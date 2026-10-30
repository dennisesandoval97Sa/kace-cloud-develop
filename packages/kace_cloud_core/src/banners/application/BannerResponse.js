export class BannerResponse {
    /** @type {Banner} is initialized in the constructor */
    #banner;

    constructor(banner) {
        this.#banner = banner;
    }

    /**
     * Converts the Banner object to a JSON representation.
     *
     * @returns {Object} A plain object containing the Banner data.
     */
    toJson() {
        return {
            data: {
                id: this.#banner.id.value,
                descripcion: this.#banner.descripcion.value,
                propiedades: this.#banner.propiedades.value,
                fecha_inicio: this.#banner.fecha_inicio.value,
                fecha_fin: this.#banner.fecha_fin.value,
                especificaciones: this.#banner.especificaciones.value,
                status: this.#banner.status.value,
                created_at: this.#banner.created_at.value,
                updated_at: this.#banner.updated_at.value,
                created_by: this.#banner.created_by.value,
                updated_by: this.#banner.updated_by.value,
            },
        };
    }
}
