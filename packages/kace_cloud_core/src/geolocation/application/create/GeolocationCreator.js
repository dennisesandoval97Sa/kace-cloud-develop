import { Geolocation } from '../../domain/Geolocation.js';
import { GeolocationFinder } from '../../application/find/GeolocationFinder.js';
import { ValidationFailError } from '../../../shared/index.js';

/**
 * Class responsible for creating a new Geolocation.
 */
export class GeolocationCreator {
    /**
     * @type {KnexGeolocationRepository} is initialized in the constructor
     * */
    #repository;

    /**
     * @type {GeolocationFinder} is initialized in the constructor
     */
    #geolocationFinder;

    /**
     * @param {KnexGeolocationRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#geolocationFinder = new GeolocationFinder(repository);
    }

    /**
     * Executes the creation of a Geolocation object and saves it to the repository.
     *
     * @param {object} dto
     */
    async execute(dto) {
        const geolocation = await this.#geolocationFinder.execute(dto.id);

        if (geolocation) {
            throw new ValidationFailError('Id already exists', 'id');
        }

        const newGeolocation = Geolocation.create(dto);
        await this.#repository.save(newGeolocation);
    }
}
