import { Helper, KnexRepository, ValidationFailError, ValueObjectUuid } from '../../../shared/index.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';

/**
 * Class representing the validation repository for Appointments using Knex.
 */
export class KnexAppointmentValidationRepository extends KnexRepository {
    /**
     * Creates an instance of KnexAppointmentValidationRepository.
     * @param {Object} config - The configuration object for the repository.
     */
    constructor(config) {
        super(config, 'appointments');
    }

    /**
     * Retrieves the daily limit for an agenda by its ID.
     * @param {string} agendaId - The ID of the agenda.
     * @returns {Promise<number>} The daily limit for the agenda.
     */
    async getDailyLimitByAgendaId(agendaId) {
        try {
            const result = await this.table('agendas').select('daily_limit').where({ id: agendaId }).first();

            return result?.daily_limit ?? 0;
        } catch (error) {
            Helper.logError('Error getting daily limit by agenda id', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Counts the number of appointments for a specific agenda and date.
     * @param {string} agendaId - The ID of the agenda.
     * @param {string} date - The date to count appointments for.
     * @returns {Promise<number>} The number of appointments.
     */
    async countAppointmentsByAgendaAndDate(agendaId, date) {
        try {
            const result = await this.table()
                .where({ agenda_id: agendaId, date })
                .whereNull('deleted_at')
                .andWhere('is_canceled', false)
                .count('id as count');

            return parseInt(result[0].count, 10) || 0;
        } catch (error) {
            Helper.logError('Error counting appointments by date', error);
            throw new QueryDBError('count');
        }
    }

    /**
     * Retrieves the group ID associated with a specific agenda.
     * @param {string} agendaId - The ID of the agenda.
     * @returns {Promise<string>} The group ID.
     * @throws {ValidationFailError} If no group is associated with the agenda.
     */
    async getGroupByAgendaId(agendaId) {
        try {
            const group = await this.table('agendas_groups').select('group_id').where({ agenda_id: agendaId }).first();

            if (!group) {
                throw new ValidationFailError('No group associated with this agenda', 'data');
            }

            return group.group_id;
        } catch (error) {
            Helper.logError('Error getting group by agenda id', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Retrieves the schedule ID associated with a specific group.
     * @param {string} groupId - The ID of the group.
     * @returns {Promise<string>} The schedule ID.
     * @throws {ValidationFailError} If no schedule is associated with the group.
     */
    async getScheduleByGroupId(groupId) {
        try {
            const schedule = await this.table('grupos')
                .select('horario_id')
                .where({ id: groupId })
                .whereNull('deleted_at')
                .first();

            if (!schedule || !schedule.horario_id) {
                throw new ValidationFailError('No schedule associated with this group', 'data');
            }

            return schedule.horario_id;
        } catch (error) {
            Helper.logError('Error getting schedule by group id', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Retrieves shift management details by schedule ID.
     * @param {string} scheduleId - The ID of the schedule.
     * @returns {Promise<Object>} An object containing holiday dates and work days.
     * @throws {ValidationFailError} If no shift management record is found.
     */
    async getShiftByScheduleId(scheduleId) {
        try {
            const shift = await this.table('shift_management')
                .select('holiday_dates', 'work_days')
                .where({ id: scheduleId })
                .whereNull('deleted_at')
                .first();

            if (!shift) {
                throw new ValidationFailError('Shift management record not found', 'data');
            }

            return {
                holidayDates:
                    typeof shift.holiday_dates === 'string'
                        ? JSON.parse(shift.holiday_dates || '[]')
                        : shift.holiday_dates,
                workDays: typeof shift.work_days === 'string' ? JSON.parse(shift.work_days || '{}') : shift.work_days,
            };
        } catch (error) {
            Helper.logError('Error getting shift management by schedule id', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Retrieves a time slot by agenda ID and start/end times.
     * @param {string} agendaId - The ID of the agenda.
     * @param {string} startTime - The start time of the time slot.
     * @param {string} endTime - The end time of the time slot.
     * @returns {Promise<Object|null>} The time slot object or null if not found.
     */
    async getTimeSlotByAgendaIdAndTimes(agendaId, startTime, endTime) {
        try {
            const result = await this.table('appointment_time_slots')
                .where({ agenda_id: agendaId })
                .andWhere('start_time', startTime)
                .andWhere('end_time', endTime)
                .andWhere('is_active', true)
                .whereNull('deleted_at')
                .first();

            return result || null;
        } catch (error) {
            Helper.logError('Error getting time slot by agenda id and times', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Counts the number of active appointments within a specific time slot for a given agenda.
     * @param {string} agendaId - The ID of the agenda to filter appointments by.
     * @param {string} startDateTime - The start datetime of the time slot.
     * @param {string} endDateTime - The end datetime of the time slot.
     * @returns {Promise<number>} The count of active appointments within the time slot.
     * If no appointments are found, returns 0.
     */
    async countAppointmentsInTimeSlot(agendaId, startDateTime, endDateTime) {
        try {
            return this.table()
                .where({ agenda_id: agendaId, is_canceled: false })
                .andWhere('start_time', '=', startDateTime)
                .andWhere('end_time', '=', endDateTime)
                .whereNull('deleted_at')
                .count('id as count')
                .then((result) => parseInt(result[0].count, 10) || 0);
        } catch (error) {
            Helper.logError('Error counting appointments by time', error);
            throw new QueryDBError('count');
        }
    }

    /**
     * Retrieves the schedule data associated with a specific group.
     * @param {ValueObjectUuid} groupId - The ID of the group.
     * @returns {Promise<Object>} An object containing holiday dates and work days.
     * @throws {ValidationFailError} If no Shift management is associated with the group.
     */
    async getShiftByGroupId(groupId) {
        try {
            const shift = await this.table('grupos as g')
                .join(`${this.qualifiedName('shift_management')} as sm`, 'g.horario_id', 'sm.id')
                .select('sm.holiday_dates', 'sm.work_days')
                .where('g.id', groupId.value)
                .whereNull('g.deleted_at')
                .whereNull('sm.deleted_at')
                .first();

            if (!shift) {
                throw new ValidationFailError('Shift management record not found for this group', 'data');
            }

            return {
                holidayDates:
                    typeof shift.holiday_dates === 'string'
                        ? JSON.parse(shift.holiday_dates || '[]')
                        : shift.holiday_dates,
                workDays: typeof shift.work_days === 'string' ? JSON.parse(shift.work_days || '{}') : shift.work_days,
            };
        } catch (error) {
            Helper.logError('Error getting shift management by group id', error);
            throw new QueryDBError('find');
        }
    }
}
