import { ValueObjectUuid } from '../../shared/index.js';

export class AppointmentFinder {
    /**
     * @type {KnexAppointmentRepository} is initialized in the constructor
     */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Finds an Appointment object by its ID.
     *
     * @param {string} id
     * @returns {Promise<Appointment>}
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
