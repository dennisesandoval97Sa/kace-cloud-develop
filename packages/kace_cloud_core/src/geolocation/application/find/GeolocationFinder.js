import { GeolocationFinder as DomainGeolocationFinder } from '../../domain/GeolocationFinder.js';
import { GeolocationResponse } from '../GeolocationResponse.js';

/**
 * Class responsible for finding a Geolocation by its ID.
 */
export class GeolocationFinder {
    /**
     * @type {DomainGeolocationFinder} is initialized in the constructor
     * */
    #finder;

    /**
     * @param {KnexGeolocationRepository} repository
     */
    constructor(repository) {
        this.#finder = new DomainGeolocationFinder(repository);
    }

    /**
     * Executes the search for a Geolocation object by its ID.
     *
     * @param {string} id
     */
    async execute(id) {
        const geolocation = await this.#finder.execute(id);

        if (!geolocation || geolocation.isDeleted()) {
            return null;
        }

        return new GeolocationResponse(geolocation);
    }
}
