import { ValueObjectUuid } from '../../../shared/index.js';
import { MapperResponse } from '../../application/MapperResponse.js';

export class MapperFinder {
    /** @type {Object} repository */
    #repository;

    /**
     * @param {Object} repository - repository implementing findById
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Find a mapper by id
     * @param {string} id
     */
    async execute(id) {
        const validId = new ValueObjectUuid('id', id).value;
        const found = await this.#repository.findById(validId);
        if (!found) {
            return null;
        }

        return new MapperResponse(found);
    }
}
