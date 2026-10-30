import { AppointmentFinder as DomainAppointmentFinder } from '../../domain/AppointmentFinder.js';
import { AppointmentValidator } from '../../domain/AppointmentValidator.js';
import { ValidationFailError, ValueObjectUuid } from '../../../shared/index.js';

/**
 * Class responsible for updating an Appointment.
 */
export class AppointmentUpdater {
    /**
     * @type {DomainAppointmentFinder} is initialized in the constructor
     */
    #appointmentFinder;

    /**
     * @type {KnexAppointmentRepository} is initialized in the constructor
     */
    #repository;

    /**
     * @type {AppointmentValidator} is initialized in the constructor
     */
    #validator;

    /**
     * @param {KnexAppointmentRepository} repository - The appointment repository.
     * @param {KnexAppointmentValidationRepository} validationRepository - The validation repository.
     */
    constructor(repository, validationRepository) {
        this.#repository = repository;
        this.#appointmentFinder = new DomainAppointmentFinder(repository);
        this.#validator = new AppointmentValidator(validationRepository);
    }

    /**
     * Executes the update of an Appointment object in the repository.
     *
     * @param {string} id - The ID of the appointment to update.
     * @param {object} dto - The data transfer object with updated information.
     * @returns {Promise<void>}
     * @throws {ValidationFailError}
     */
    async execute(id, dto) {
        const appointment = await this.#appointmentFinder.execute(id);

        if (!appointment) {
            throw new ValidationFailError('Appointment not found', 'id');
        }

        const groupId = new ValueObjectUuid('group_id', dto.group_id);
        appointment.update(dto);

        await this.#validator.validateAppointmentRules(appointment, groupId);

        await this.#repository.update(appointment);

        appointment.flushChanges();
    }
}
