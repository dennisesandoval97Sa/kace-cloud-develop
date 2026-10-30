/**
 * Representa la respuesta individual de un recurso del board (una fila).
 */
export class BoardResourcesResponse {
    #row;

    /**
     * @param {Object} row - Una fila (objeto plano) proveniente de BoardResources.rows
     */
    constructor(row) {
        this.#row = row;
    }

    /**
     * Convierte la fila a una representación JSON plana.
     * @returns {Object}
     */
    toJson() {
        if (!this.#row) return {};
        return {
            data: {
                ...this.#row,
            },
        };
    }
}
