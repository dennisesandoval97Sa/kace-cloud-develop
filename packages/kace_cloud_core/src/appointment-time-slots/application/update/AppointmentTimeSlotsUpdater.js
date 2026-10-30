import { ValidationFailError } from '../../../shared';
import { AppointmentTimeSlotsFinder as DomainAppointmentTimeSlotsFinder } from '../../domain/AppointmentTimeSlotsFinder';
import { AppointmentTimeSlotsValidator } from '../../domain/AppointmentTimeSlotsValidator';
import {
    APPOINTMENT_TIME_SLOT_ALREADY_DELETED,
    APPOINTMENT_TIME_SLOT_NOT_FOUND,
    APPOINTMENT_TIME_SLOT_OVERLAPS_EXISTING_SLOT,
} from '@kace/error-codes';

export class AppointmentTimeSlotsUpdater {
    /**
     * @type {DomainAppointmentTimeSlotsFinder} is initialized in the constructor
     */
    #finder;

    /**
     * @type {KnexAppointmentTimeSlotsRepository} is initialized in the constructor
     */
    #repository;

    /**
     * @type {AppointmentTimeSlotsValidator} is initialized in the constructor
     */
    #validator;

    /**
     * @param {KnexAppointmentTimeSlotsRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainAppointmentTimeSlotsFinder(repository);
        this.#validator = new AppointmentTimeSlotsValidator(repository);
    }

    /**
     * Execute the use case of updating an appointment time slot.
     *
     * @param {string} id - The id of the appointment time slot to update.
     * @param {object} dto - The data transfer object.
     *
     * @throws {ValidationFailError} - When the appointment time slot is not found.
     *
     * @returns {Promise<void>} - Promise that resolves when the appointment time slot is updated
     */
    async execute(id, dto) {
        const existingAppointmentTimeSlot = await this.#finder.execute(id);

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

        const { start_time, end_time, max_appointments } = dto;

        this.#validator.validateTimeRange(start_time, end_time);

        if (start_time && end_time) {
            const agendaId = existingAppointmentTimeSlot.agenda_id.value;

            const overlappingSlots = await this.#validator.validateOverlaps(agendaId, start_time, end_time, id);

            if (overlappingSlots.length > 0) {
                throw new ValidationFailError(
                    `The time slot overlaps with existing slots: ${overlappingSlots
                        .map((slot) => `${slot.start_time.value} - ${slot.end_time.value}`)
                        .join(', ')}`,
                    'start_time, end_time',
                    [],
                    APPOINTMENT_TIME_SLOT_OVERLAPS_EXISTING_SLOT
                );
            }
        }

        if (max_appointments) {
            await this.#validator.validateDailyLimit(existingAppointmentTimeSlot.agenda_id.value, max_appointments);
        }

        existingAppointmentTimeSlot.update(dto);
        await this.#repository.update(existingAppointmentTimeSlot);
        existingAppointmentTimeSlot.flushChanges();
    }
}
