import { ValidationFailError } from '../../shared';
import {
    APPOINTMENT_TIME_SLOT_EXCEEDS_AGENDA_DAILY_LIMIT,
    APPOINTMENT_TIME_SLOT_INVALID_TIME_RANGE,
} from '@kace/error-codes';

export class AppointmentTimeSlotsValidator {
    /**
     * @type {KnexAppointmentTimeSlotsRepository} is initialized in the constructor
     */
    #repository;

    /**
     * @param {KnexAppointmentTimeSlotsRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Validate if the time slot overlaps with another time slot in the same agenda
     * If excludeId is provided, it will exclude the time slot with that id from the validation (useful for updates)
     *
     * @param {string} agendaId - The agenda id
     * @param {string} startTime - The start time
     * @param {string} endTime - The end time
     * @param {string} [excludeId=null] - The id to exclude from the validation
     *
     * @returns {Promise<AppointmentTimeSlots[]>} - The overlapping time slots
     */
    async validateOverlaps(agendaId, startTime, endTime, excludeId = null) {
        const overlappingTimeSlots = await this.#repository.getOverlaps(agendaId, startTime, endTime);

        if (excludeId) {
            return overlappingTimeSlots.filter((slot) => slot.id.value !== excludeId);
        }

        return overlappingTimeSlots;
    }

    /**
     * Validate if the time range is valid, end_time must be greater than start_time
     *
     * @param {string} startTime - The start time in format HH:mm or HH:mm:ss
     * @param {string} endTime - The end time in format HH:mm or HH:mm:ss
     *
     * @throws {ValidationFailError} - If the time range is invalid
     */
    validateTimeRange(startTime, endTime) {
        if ((startTime && !endTime) || (!startTime && endTime)) {
            throw new ValidationFailError(
                'Invalid time range, start_time and end_time must be provided',
                'start_time, end_time',
                [],
                APPOINTMENT_TIME_SLOT_INVALID_TIME_RANGE
            );
        }

        if (startTime >= endTime) {
            throw new ValidationFailError(
                'Invalid time range, end_time must be greater than start_time',
                'start_time, end_time',
                [],
                APPOINTMENT_TIME_SLOT_INVALID_TIME_RANGE
            );
        }
    }

    /**
     * Validate if the daily limit in an agenda is not exceeded by the max appointments
     *
     * @param {string} agendaId - The agenda id
     * @param {number} maxAppointments - The max appointments
     *
     * @throws {ValidationFailError} - If the max appointments exceeds the daily limit
     */
    async validateDailyLimit(agendaId, maxAppointments) {
        const dailyLimitByAgenda = await this.#repository.getDailyLimitByAgendaId(agendaId);

        if (maxAppointments > dailyLimitByAgenda) {
            throw new ValidationFailError(
                `Max appointments exceeds the daily limit of selected agenda`,
                'max_appointments',
                [],
                APPOINTMENT_TIME_SLOT_EXCEEDS_AGENDA_DAILY_LIMIT
            );
        }
    }
}
