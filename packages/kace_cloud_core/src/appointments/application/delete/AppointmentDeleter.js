import { AppointmentFinder as DomainAppointmentFinder } from '../../domain/AppointmentFinder.js';
import { ValidationFailError } from '../../../shared/index.js';

/**
 * Class responsible for deleting an Appointment.
 */
export class AppointmentDeleter {
    /**
     * @type {KnexAppointmentRepository} is initialized in the constructor
     */
    #repository;

    /**
     * @type {DomainAppointmentFinder} is initialized in the constructor
     */
    #appointmentFinder;

    /**
     * @param {KnexAppointmentRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#appointmentFinder = new DomainAppointmentFinder(repository);
    }

    /**
     * Deletes an Appointment by its ID.
     *
     * @param {string} id
     * @param {object} dto
     * @returns {Promise<void>}
     */
    async execute(id, dto) {
        const appointment = await this.#appointmentFinder.execute(id);

        if (!appointment) {
            throw new ValidationFailError('Appointment not found', 'id');
        }

        if (appointment.deleted_at?.value) {
            throw new ValidationFailError('Appointment already deleted', 'id');
        }

        appointment.delete(dto);

        await this.#repository.update(appointment);

        appointment.flushChanges();
    }
}
