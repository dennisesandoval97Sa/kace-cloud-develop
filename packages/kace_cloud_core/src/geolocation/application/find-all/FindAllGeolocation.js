import { GeolocationCollectionResponse } from '../GeolocationCollectionResponse.js';

/**
 * Class responsible for listing all Geolocation objects.
 */
export class FindAllGeolocation {
    /**
     * @type {KnexGeolocationRepository} is initialized in the constructor
     */
    #repository;

    /**
     * @param {KnexGeolocationRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Executes the listing of all Geolocation objects.
     *
     * @returns {Promise<GeolocationCollectionResponse>}
     */
    async execute() {
        const geolocations = await this.#repository.findAll();
        return new GeolocationCollectionResponse(geolocations, geolocations.length);
    }
}
