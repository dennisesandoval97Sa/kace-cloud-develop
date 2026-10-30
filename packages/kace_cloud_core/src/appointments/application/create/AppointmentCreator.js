import { Appointment } from '../../domain/Appointment.js';
import { AppointmentFinder } from '../../application/find/AppointmentFinder.js';
import { AppointmentValidator } from '../../domain/AppointmentValidator.js';
import { ValidationFailError, ValueObjectUuid } from '../../../shared/index.js';

/**
 * Class responsible for creating a new Appointment.
 */
export class AppointmentCreator {
    /**
     * @type {KnexAppointmentRepository}  is initialized in the constructor
     */
    #repository;

    /**
     * @type {AppointmentFinder} is initialized in the constructor
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
        this.#appointmentFinder = new AppointmentFinder(repository);
        this.#validator = new AppointmentValidator(validationRepository);
    }

    async execute(dto) {
        const appointment = await this.#appointmentFinder.execute(dto.id);
        if (appointment) {
            throw new ValidationFailError('Id already exists', 'id');
        }

        const newAppointment = Appointment.create(dto);

        const groupId = new ValueObjectUuid('group_id', dto.group_id);
        await this.#validator.validateAppointmentRules(newAppointment, groupId);

        await this.#repository.save(newAppointment);
    }
}
