import { AppointmentFinder as DomainAppointmentFinder } from '../../domain/AppointmentFinder.js';
import { AppointmentValidator } from '../../domain/AppointmentValidator.js';
import { ValidationFailError, ValueObjectUuid } from '../../../shared/index.js';
import { Appointment } from '../../domain/Appointment.js';

/**
 * Class responsible for rescheduling an Appointment.
 */
export class AppointmentReScheduler {
    /**
     * @type {KnexAppointmentRepository} is initialized in the constructor
     */
    #repository;

    /**
     * @type {DomainAppointmentFinder} is initialized in the constructor
     */
    #appointmentFinder;

    /**
     * @type {AppointmentValidator} is initialized in the constructor
     */
    #validator;

    /**
     * @param {KnexAppointmentRepository} repository
     * @param {KnexAppointmentValidationRepository} validationRepository
     */
    constructor(repository, validationRepository) {
        this.#repository = repository;
        this.#appointmentFinder = new DomainAppointmentFinder(repository);
        this.#validator = new AppointmentValidator(validationRepository);
    }

    /**
     * Reschedules an Appointment by creating a new Appointment and linking it to the previous one.
     *
     * @param {string} id - The ID of the appointment to reschedule.
     * @param {object} newAppointmentDto - The data for the new appointment.
     * @returns {Promise<void>}
     * @throws {ValidationFailError}
     */
    async execute(id, newAppointmentDto) {
        const oldAppointment = await this.#appointmentFinder.execute(id);

        if (!oldAppointment) {
            throw new ValidationFailError('Appointment not found', 'id');
        }

        const newAppointment = Appointment.create({
            ...newAppointmentDto,
            is_canceled: false,
            last_appointment_id: oldAppointment.id.value,
        });

        const groupId = new ValueObjectUuid('group_id', newAppointmentDto.group_id);
        await this.#validator.validateAppointmentRules(newAppointment, groupId);

        oldAppointment.update({
            updated_at: newAppointmentDto.updated_at,
            updated_by: newAppointmentDto.updated_by,
            is_canceled: true,
        });

        await this.#repository.save(newAppointment);
        await this.#repository.update(oldAppointment);

        oldAppointment.flushChanges();
    }
}
