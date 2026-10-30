import { AppointmentTimeSlotsFinder as DomainAppointmentTimeSlotsFinder } from '../../domain/AppointmentTimeSlotsFinder';
import { ValidationFailError } from '../../../shared';
import { AppointmentTimeSlots } from '../../domain/AppointmentTimeSlots';
import { AppointmentTimeSlotsValidator } from '../../domain/AppointmentTimeSlotsValidator';
import { APPOINTMENT_TIME_SLOT_ALREADY_EXISTS, APPOINTMENT_TIME_SLOT_OVERLAPS_EXISTING_SLOT } from '@kace/error-codes';

export class AppointmentTimeSlotsCreator {
    /**
     * @type {KnexAppointmentTimeSlotsRepository} is initialized in the constructor
     */
    #repository;

    /**
     * @type {DomainAppointmentTimeSlotsFinder} is initialized in the constructor
     */
    #finder;

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
     * Execute the use case of creating an appointment time slot for an agenda.
     * This use case validates that the time slot does not overlap with existing time slots
     * and that the daily limit of appointments is not exceeded.
     *
     * @param {Object} dto
     *
     * @throws {ValidationFailError} - If the time slot overlaps with existing time slots
     *
     * @returns {Promise<void>} - Returns a promise that resolves when the appointment time slot is created
     */
    async execute(dto) {
        const { id, agenda_id, max_appointments, start_time, end_time } = dto;

        const existingAppointmentTimeSlot = await this.#finder.execute(id);

        if (existingAppointmentTimeSlot) {
            throw new ValidationFailError(
                'The appointment time slot already exists',
                'id',
                [],
                APPOINTMENT_TIME_SLOT_ALREADY_EXISTS
            );
        }

        this.#validator.validateTimeRange(start_time, end_time);

        const overlappingSlots = await this.#validator.validateOverlaps(agenda_id, start_time, end_time);
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

        await this.#validator.validateDailyLimit(agenda_id, max_appointments);

        const appointmentTimeSlots = AppointmentTimeSlots.create(dto);

        await this.#repository.save(appointmentTimeSlots);
    }
}
