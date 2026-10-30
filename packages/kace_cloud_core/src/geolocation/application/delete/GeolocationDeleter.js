import { GeolocationFinder as DomainGeolocationFinder } from '../../domain/GeolocationFinder.js';
import { ValidationFailError } from '../../../shared/index.js';

export class GeolocationDeleter {
    /**
     * @type {KnexGeolocationRepository} is initialized in the constructor
     */
    #repository;

    /**
     * @type {DomainGeolocationFinder} is initialized in the constructor
     */
    #geolocationFinder;

    constructor(repository) {
        this.#repository = repository;
        this.#geolocationFinder = new DomainGeolocationFinder(repository);
    }

    async execute(id, dto) {
        const geolocation = await this.#geolocationFinder.execute(id);

        if (!geolocation) {
            throw new ValidationFailError('Geolocation not found', 'id');
        }

        if (geolocation.deleted_at?.value) {
            throw new ValidationFailError('Geolocation already deleted', 'id');
        }

        geolocation.delete(dto);

        await this.#repository.update(geolocation);

        geolocation.flushChanges();
    }
}
