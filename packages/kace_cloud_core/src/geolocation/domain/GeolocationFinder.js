import { ValueObjectUuid } from '../../shared/index.js';

export class GeolocationFinder {
    /**
     * @type {KnexGeolocationRepository} is initialized in the constructor
     * */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Finds a Geolocation object by its ID.
     *
     * @param {string} id
     * @returns {Promise<Geolocation>}
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
