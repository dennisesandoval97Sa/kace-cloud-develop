/**
 * Caso de uso para listar los enlaces rápidos activos.
 */
export class QuickLinksSearcher {
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Obtiene los enlaces activos ordenados por posición.
     *
     * @returns {Promise<Array>}
     */
    async execute() {
        return this.#repository.findAll();
    }
}
