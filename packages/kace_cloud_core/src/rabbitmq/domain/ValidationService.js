import { CustomError } from '../../shared/index.js';

export class ValidationService {
    /** @type {Object} repository */
    #repository;

    /**
     * @param {Object} repository - repository used to perform validations (should implement findByName)
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Validate adapter name uniqueness
     * @param {string} name
     */
    async validateAdapterNameUnique(name) {
        if (!name) return;
        if (!this.#repository.findByName) return;
        const existing = await this.#repository.findByName(name);
        if (existing) throw new CustomError(`Adapter with name ${name} already exists`, 400);
    }

    /**
     * Validate mapper name uniqueness
     * @param {string} name
     */
    async validateMapperNameUnique(name) {
        if (!name) return;
        if (!this.#repository.findByName) return;
        const existing = await this.#repository.findByName(name);
        if (existing) throw new CustomError(`Mapper with name ${name} already exists`, 400);
    }
}
