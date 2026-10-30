import { GeolocationFinder as DomainGeolocationFinder } from '../../domain/GeolocationFinder.js';
import { ValidationFailError } from '../../../shared/index.js';

/**
 * Class responsible for updating a Geolocation.
 */
export class GeolocationUpdater {
    /**
     * @type {DomainGeolocationFinder} is initialized in the constructor
     */
    #geolocationFinder;

    /**
     * @type {KnexGeolocationRepository} is initialized in the constructor
     */
    #repository;

    /**
     * @param {KnexGeolocationRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#geolocationFinder = new DomainGeolocationFinder(repository);
    }

    /**
     * Executes the update of a Geolocation object in the repository.
     *
     * @param {string} id
     * @param {object} dto
     */
    async execute(id, dto) {
        const geolocation = await this.#geolocationFinder.execute(id);

        if (!geolocation) {
            throw new ValidationFailError('Geolocation not found', 'id');
        }

        geolocation.update(dto);

        await this.#repository.update(geolocation);

        geolocation.flushChanges();
    }
}
