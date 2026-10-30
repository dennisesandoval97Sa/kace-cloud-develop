export class DomainMapperFinder {
    /** @type {Object} repository */
    #repository;

    /**
     * @param {Object} repository - repository implementing findById and findByName
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Find mapper by id
     * @param {string} id
     */
    async execute(id) {
        return this.#repository.findById ? this.#repository.findById(id) : null;
    }

    /**
     * Find mapper by name
     * @param {string} name
     */
    async findByName(name) {
        return this.#repository.findByName ? this.#repository.findByName(name) : null;
    }
}
