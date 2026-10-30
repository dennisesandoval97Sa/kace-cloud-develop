import { Helper, ValidationFailError, ValueObjectUuid } from '../../shared/index.js';
import { fromUTCToLocal } from '../../shared/calculator/functions/dateFunctions.js';

/**
 * Interpreta un instante UTC (ISO con `Z`, timestamp) como hora de pared del tenant.
 * La configuración de la agenda (`work_days`, `appointment_time_slots`) se guarda en
 * hora local del tenant, así que la cita debe compararse en esa misma zona.
 *
 * Reutiliza la función canónica del flujo de casos (`fromUTCToLocal`,
 * resolución `TenantContext.timezone -> America/Bogota`) — una sola definición
 * de «instante UTC -> hora de pared del tenant» en `@kace/core`.
 *
 * @param {string|number|Date} value
 * @returns {import('dayjs').Dayjs}
 */
const toTenantWallTime = (value) => fromUTCToLocal(value);

/**
 * Service responsible for validating appointments.
 */
export class AppointmentValidator {
    /**
     * @type {KnexAppointmentValidationRepository} is initialized in the constructor
     */
    #validationRepository;

    /**
     * Constructor for the AppointmentValidator.
     *
     * @param {KnexAppointmentValidationRepository} validationRepository
     */
    constructor(validationRepository) {
        this.#validationRepository = validationRepository;
    }

    /**
     * Validates all the rules for creating an appointment.
     * @param {ValueObjectUuid} groupId - The ID of the group.
     * @param {object} dto - The appointment data transfer object.
     * @throws {ValidationFailError} If validation fails.
     */
    async validateAppointmentRules(dto, groupId) {
        if (!dto.agenda_id?.value || !dto.date?.value || !dto.start_time?.value || !dto.end_time?.value) {
            throw new ValidationFailError('Invalid appointment data provided', 'data');
        }

        const agendaId = dto.agenda_id.value;
        const date = dto.date.value;
        const startTime = dto.start_time.value;
        const endTime = dto.end_time.value;

        // `date` (ValueObjectDate) es la fecha local de la cita provista por el cliente y
        // es la misma que se persiste en la columna `appointments.date` (tipo `date`, sin
        // zona). El conteo del cupo diario se compara contra esa misma columna, así que
        // ambos lados usan el calendario del cliente y quedan alineados entre sí.
        // Deliberadamente NO se deriva de `start_time`: hacerlo desalinearía la validación
        // de la fila persistida. La consistencia entre `date` y `start_time` es contrato
        // del cliente — ver ticket MSKT-1447 (seguimiento).
        await this.#validateDailyLimitAgenda(agendaId, date);
        await this.#validateShiftRules(startTime, endTime, groupId);
        await this.#validateTimeSlot(agendaId, startTime, endTime);
    }

    /**
     * Validates the daily limit for appointments.
     *
     * @param {string} agendaId - The agenda ID.
     * @param {string} date - The appointment date.
     * @throws {ValidationFailError} If the daily limit is reached.
     */
    async #validateDailyLimitAgenda(agendaId, date) {
        const dailyLimit = await this.#validationRepository.getDailyLimitByAgendaId(agendaId);
        const currentAppointmentsCount = await this.#validationRepository.countAppointmentsByAgendaAndDate(
            agendaId,
            date
        );

        if (currentAppointmentsCount >= dailyLimit) {
            throw new ValidationFailError('Daily appointment limit has been reached', 'data');
        }
    }

    /**
     * Validates the shift rules: holidays and workdays.
     *
     * @param {ValueObjectUuid} agendaId - The agenda ID.
     * @param {string} startDateTime - The start datetime of the appointment.
     * @param {string} endDateTime - The end datetime of the appointment.
     */
    async #validateShiftRules(startDateTime, endDateTime, groupId) {
        const { holidayDates, workDays } = await this.#validationRepository.getShiftByGroupId(groupId);

        this.#validateHoliday(startDateTime, holidayDates);
        this.#validateWorkday(startDateTime, workDays);

        this.#validateHoliday(endDateTime, holidayDates);
        this.#validateWorkday(endDateTime, workDays);
    }

    /**
     * Validates the time slot for the appointment and the max appointments per day.
     *
     * @param {string} agendaId - The agenda ID.
     * @param {string} startDateTime - The start datetime of the appointment.
     * @param {string} endDateTime - The end datetime of the appointment.
     */
    async #validateTimeSlot(agendaId, startDateTime, endDateTime) {
        const timeSlot = await this.#getValidTimeSlot(agendaId, startDateTime, endDateTime);
        await this.#validateMaxAppointmentsInTimeSlot(agendaId, startDateTime, endDateTime, timeSlot);
    }

    /**
     * Retrieves and validates the time slot for the appointment.
     *
     * @param {string} agendaId - The agenda ID.
     * @param {string} startDateTime - The start datetime of the appointment.
     * @param {string} endDateTime - The end datetime of the appointment.
     * @returns {Promise<object>} The time slot.
     * @throws {ValidationFailError} If the time slot does not exist.
     */
    async #getValidTimeSlot(agendaId, startDateTime, endDateTime) {
        const startTime = toTenantWallTime(startDateTime).format('HH:mm');
        const endTime = toTenantWallTime(endDateTime).format('HH:mm');

        const timeSlot = await this.#validationRepository.getTimeSlotByAgendaIdAndTimes(agendaId, startTime, endTime);

        if (!timeSlot) {
            throw new ValidationFailError('The selected date and time do not match any available time slot', 'data');
        }

        return timeSlot;
    }

    /**
     * Validates that the maximum number of appointments in the time slot is not exceeded.
     *
     * @param {string} agendaId - The agenda ID.
     * @param {string} startDateTime - The start datetime of the appointment.
     * @param {string} endDateTime - The end datetime of the appointment.
     * @param {object} timeSlot - The validated time slot.
     * @throws {ValidationFailError} If the maximum appointments are exceeded.
     */
    async #validateMaxAppointmentsInTimeSlot(agendaId, startDateTime, endDateTime, timeSlot) {
        const currentAppointmentsCount = await this.#validationRepository.countAppointmentsInTimeSlot(
            agendaId,
            startDateTime,
            endDateTime
        );

        if (currentAppointmentsCount >= timeSlot.max_appointments) {
            throw new ValidationFailError(
                'The maximum number of appointments for this time slot has been reached',
                'data'
            );
        }
    }

    /**
     * Validates that the date and time do not fall on a holiday.
     *
     * @param {string} dateTime - The date and time to validate.
     * @param {string[]} holidayDates - The list of holidays.
     * @throws {ValidationFailError} If the date is a holiday.
     */
    #validateHoliday(dateTime, holidayDates) {
        const date = toTenantWallTime(dateTime).format('dddd').toLowerCase();
        if (holidayDates.includes(date)) {
            throw new ValidationFailError('The selected date is a holiday', 'data');
        }
    }

    /**
     * Validates that the date and time fall within the workday schedule.
     *
     * @param {string} dateTime - The date and time to validate.
     * @param {object} workDays - The workday schedules.
     * @throws {ValidationFailError} If the date is not a workday or time is outside working hours.
     */
    #validateWorkday(dateTime, workDays) {
        const dayOfWeek = toTenantWallTime(dateTime).format('dddd').toLowerCase();

        if (!workDays[dayOfWeek]) {
            Helper.logError('The selected date is not a workday', dayOfWeek);
            throw new ValidationFailError('The selected date is not a workday', 'data');
        }

        const workDaySchedule = workDays[dayOfWeek];
        const time = toTenantWallTime(dateTime).format('HH:mm');

        if (time < workDaySchedule.start || time > workDaySchedule.end) {
            Helper.logError('The time is outside working hours', time);
            throw new ValidationFailError('The time is outside working hours', 'data');
        }
    }
}
