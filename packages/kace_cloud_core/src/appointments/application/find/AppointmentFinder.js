import { AppointmentFinder as DomainAppointmentFinder } from '../../domain/AppointmentFinder.js';
import { AppointmentResponse } from '../AppointmentResponse.js';

/**
 * Class responsible for finding an Appointment by its ID.
 */
export class AppointmentFinder {
    /**
     * @type {DomainAppointmentFinder} is initialized in the constructor
     */
    #finder;

    /**
     * @param {KnexAppointmentRepository} repository
     */
    constructor(repository) {
        this.#finder = new DomainAppointmentFinder(repository);
    }

    /**
     * Executes the search for an Appointment object by its ID.
     *
     * @param {string} id
     * @returns {Promise<AppointmentResponse|null>}
     */
    async execute(id) {
        const appointment = await this.#finder.execute(id);

        if (!appointment || appointment.isDeleted()) {
            return null;
        }

        return new AppointmentResponse(appointment);
    }
}
