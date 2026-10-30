import { Criteria } from '../../../shared';
import { Counter } from '../../../shared/domain/Counter';
import { AppointmentCollectionResponse } from '../AppointmentCollectionResponse.js';

export class AppointmentSearcher {
    /**
     * @type {KnexAppointmentRepository} is initialized in the constructor
     */
    #repository;

    /**
     * @type {Counter} is initialized in the constructor
     */
    #counter;

    /**
     * @param {KnexAppointmentRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#counter = new Counter(repository);
    }

    /**
     * Executes a search for Appointment objects based on given criteria.
     *
     * @param {Object} params
     * @param {Object} params.filter
     * @param {Object} params.relationship
     * @param {number} params.limit
     * @param {number} params.offset
     * @param {Object} params.order
     * @returns {Promise<AppointmentCollectionResponse>}
     */
    async execute({ filter, relationship, limit, offset, order }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, limit, offset, order, tablename);

        const appointments = await this.#repository.search(criteria);
        const appointmentsCount = await this.#counter.execute({
            filter,
            relationship,
            limit,
            offset,
            order,
        });

        return new AppointmentCollectionResponse(appointments, appointmentsCount);
    }
}
