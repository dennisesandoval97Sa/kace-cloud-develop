import { Counter, Criteria } from '../../../shared';
import { AppointmentTimeSlotsCollectionResponse } from '../AppointmentTimeSlotsCollectionResponse';

export class AppointmentTimeSlotsSearcher {
    /**
     * @type {KnexAppointmentTimeSlotsRepository} is initialized in the constructor
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

    /**
     * Execute the use case of searching appointment time slots.
     *
     * @param {Object} dto - The data transfer object.
     * @param {Array<object>} dto.filter - The filter criteria.
     * @param {Array<object>} dto.relationship - The relationship criteria.
     * @param {number} dto.limit - The maximum number of records to return.
     * @param {number} dto.offset - The number of records to skip.
     * @param {string} dto.order - The order criteria.
     *
     * @returns {Promise<AppointmentTimeSlotsCollectionResponse>} - Promise that resolves with the appointment time slots found
     */
    async execute({ filter, relationship, limit, offset, order }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, limit, offset, order, tablename);

        const appointmentTimeSlots = await this.#repository.search(criteria);
        const appointmentTimeSlotsCount = await this.#counter.execute({
            filter,
            relationship,
            limit,
            offset,
            order,
        });

        return new AppointmentTimeSlotsCollectionResponse(appointmentTimeSlots, appointmentTimeSlotsCount);
    }
}
