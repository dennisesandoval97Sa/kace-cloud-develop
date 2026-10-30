import { AppointmentTimeSlotsFinder as DomainAppointmentTimeSlotsFinder } from '../../domain/AppointmentTimeSlotsFinder';
import { ValidationFailError } from '../../../shared';
import { APPOINTMENT_TIME_SLOT_ALREADY_DELETED, APPOINTMENT_TIME_SLOT_NOT_FOUND } from '@kace/error-codes';

export class AppointmentTimeSlotsDeleter {
    /**
     * @type {KnexAppointmentTimeSlotsRepository} is initialized in the constructor
     */
    #repository;

    /**
     * @type {DomainAppointmentTimeSlotsFinder} is initialized in the constructor
     */
    #appointmentTimeSlotsFinder;

    constructor(repository) {
        this.#repository = repository;
        this.#appointmentTimeSlotsFinder = new DomainAppointmentTimeSlotsFinder(repository);
    }

    /**
     * Execute the use case of deleting an appointment time slot.
     *
     * @param {string} id - The id of the appointment time slot to delete.
     * @param {object} dto - The data transfer object.
     *
     * @throws {ValidationFailError} - When the appointment time slot is not found.
     *
     * @returns {Promise<void>}
     */
    async execute(id, dto) {
        const existingAppointmentTimeSlot = await this.#appointmentTimeSlotsFinder.execute(id);

        if (!existingAppointmentTimeSlot) {
            throw new ValidationFailError('AppointmentTimeSlots not found', 'id', [], APPOINTMENT_TIME_SLOT_NOT_FOUND);
        }

        if (existingAppointmentTimeSlot?.deleted_at?.value) {
            throw new ValidationFailError(
                'AppointmentTimeSlots already deleted',
                'id',
                [],
                APPOINTMENT_TIME_SLOT_ALREADY_DELETED
            );
        }

        existingAppointmentTimeSlot.delete(dto);
        await this.#repository.update(existingAppointmentTimeSlot);
        existingAppointmentTimeSlot.flushChanges();
    }
}
