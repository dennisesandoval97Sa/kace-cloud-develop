import { Criteria } from '../../../shared';
import { Counter } from '../../../shared/domain/Counter';
import { GeolocationCollectionResponse } from '../GeolocationCollectionResponse';

export class GeolocationSearcher {
    /**
     * @type {KnexGeolocationRepository} is initialized in the constructor
     */
    #repository;

    /**
     * @type {Counter} is initialized in the constructor
     */
    #counter;

    constructor(repository) {
        this.#repository = repository;
        this.#counter = new Counter(repository);
    }

    async execute({ filter, relationship, limit, offset, order }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, limit, offset, order, tablename);

        const geolocations = await this.#repository.search(criteria);
        const geolocationsCount = await this.#counter.execute({
            filter,
            relationship,
            limit,
            offset,
            order,
        });

        return new GeolocationCollectionResponse(geolocations, geolocationsCount);
    }
}
