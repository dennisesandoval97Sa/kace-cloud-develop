import { AppointmentCollectionResponse } from '../AppointmentCollectionResponse.js';

/**
 * Class responsible for listing all Appointment objects.
 */
export class FindAllAppointments {
    /**
     * @type {KnexAppointmentRepository} is initialized in the constructor
     */
    #repository;

    /**
     * @param {KnexAppointmentRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Executes the listing of all Appointment objects.
     *
     * @returns {Promise<AppointmentCollectionResponse>}
     */
    async execute() {
        const appointments = await this.#repository.findAll();
        return new AppointmentCollectionResponse(appointments, appointments.length);
    }
}
