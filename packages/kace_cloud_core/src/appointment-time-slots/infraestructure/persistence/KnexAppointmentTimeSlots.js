import { CustomError, Helper, InvalidArgumentError, KnexRepository, ValidationFailError } from '../../../shared';
import { AppointmentTimeSlots } from '../../domain/AppointmentTimeSlots';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { APPOINTMENT_TIME_SLOT_AGENDA_NOT_FOUND } from '@kace/error-codes';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexAppointmentTimeSlotsRepository extends KnexRepository {
    #FOREIGN_KEY_VIOLATION_CODE = '23503';

    constructor(config, readerConfig = null) {
        super(config, 'appointment_time_slots', readerConfig);
    }

    /**
     * Save an appointment time slot in the database
     *
     * @param {AppointmentTimeSlots} appointmentTimeSlots
     *
     * @throws {ValidationFailError | CustomError } - If an unexpected error occurs or if the agenda is not found
     *
     * @returns {Promise<void>} - The promise that the operation was completed
     */
    async save(appointmentTimeSlots) {
        try {
            DbRequestContext.markWrite();
            const {
                id,
                description,
                start_time,
                end_time,
                agenda_id,
                is_active,
                max_appointments,
                created_at,
                created_by,
            } = appointmentTimeSlots;

            await this.table().insert({
                id: id.value,
                description: description.value,
                start_time: start_time.value,
                end_time: end_time.value,
                agenda_id: agenda_id.value,
                is_active: is_active.value,
                max_appointments: max_appointments.value,
                created_at: created_at.value,
                created_by: created_by.value,
            });
        } catch (error) {
            Helper.logError('Error saving appointment time slots', error);

            if (error.code === this.#FOREIGN_KEY_VIOLATION_CODE) {
                throw new ValidationFailError(
                    'Agenda not found',
                    'agenda_id',
                    [],
                    APPOINTMENT_TIME_SLOT_AGENDA_NOT_FOUND
                );
            }

            throw new QueryDBError('save');
        }
    }

    /**
     * Update an appointment time slot in the database
     *
     * @param {AppointmentTimeSlots} appointmentTimeSlots
     *
     * @throws {InvalidArgumentError} - If the appointment time slot does not have an ID
     *  or if the appointment time slot is not found
     *
     * @returns {Promise<void>} - The promise that the operation was completed
     */
    async update(appointmentTimeSlots) {
        try {
            DbRequestContext.markWrite();
            if (!appointmentTimeSlots?.id) {
                throw new InvalidArgumentError('AppointmentTimeSlots must have an ID');
            }

            const result = await this.table()
                .where({ id: appointmentTimeSlots.id.value })
                .update(appointmentTimeSlots.changedAttributes);

            if (result === 0) {
                throw new InvalidArgumentError('AppointmentTimeSlots not found');
            }
        } catch (error) {
            Helper.logError('Error updating appointment time slot', error);
            throw new QueryDBError('update');
        }
    }

    /**
     * Delete an appointment time slot in the database
     *
     * @param {ValueObjectUuid} id - The appointment time slot ID
     *
     * @throws {InvalidArgumentError} - If the ID is not provided
     *
     * @returns {Promise<?AppointmentTimeSlots>} - The promise that the operation was completed
     */
    async find(id) {
        try {
            const idValue = id?.value;

            if (!idValue) {
                throw new InvalidArgumentError('ID is required');
            }

            const appointmentTimeSlots = await this.table().where({ id: idValue }).first();

            return appointmentTimeSlots ? new AppointmentTimeSlots(appointmentTimeSlots) : null;
        } catch (error) {
            Helper.logError('Error updating appointment time slot', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Find all appointment time slots
     *
     * @returns {Promise<AppointmentTimeSlots[]>} - The promise that the operation was completed
     */
    async findAll() {
        try {
            const appointmentTimeSlots = await this.read
                .table('appointment_time_slots')
                .select('*')
                .where({ deleted_at: null });
            return appointmentTimeSlots.map((appointmentTimeSlots) => new AppointmentTimeSlots(appointmentTimeSlots));
        } catch (error) {
            Helper.logError('Error getting a list of appointment time slot', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Search for appointment time slots by criteria
     *
     * @param {Criteria} criteria - The search criteria
     *
     * @returns {Promise<AppointmentTimeSlots[]>} - The promise that the operation was completed
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read.table('appointment_time_slots').select('*');

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');
            const agendas = await queryBuilder;
            return agendas.map((agenda) => new AppointmentTimeSlots(agenda));
        } catch (error) {
            Helper.logError('Error searching appointment time slot', error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Get the daily limit by agenda ID from the database
     *
     * @param {string} agendaId - The agenda ID
     *
     * @throws {InvalidArgumentError} - If the agenda ID is not provided
     *
     * @returns {Promise<number>} - The daily limit of the agenda
     */
    async getDailyLimitByAgendaId(agendaId) {
        try {
            if (!agendaId) {
                throw new InvalidArgumentError('Agenda ID is required');
            }

            const agenda = await this.table('agendas').select('daily_limit').where({ id: agendaId }).first();

            if (!agenda) {
                throw new ValidationFailError(
                    'Agenda not found',
                    'agenda_id',
                    [],
                    APPOINTMENT_TIME_SLOT_AGENDA_NOT_FOUND
                );
            }

            return agenda.daily_limit ?? 0;
        } catch (error) {
            if (error instanceof ValidationFailError) {
                throw error;
            }

            Helper.logError('Error getting limit agenda by id', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Get the overlapping time slots in the same agenda
     *
     * @param {string} agendaId - The agenda ID
     * @param {string} startTime - The start time
     * @param {string} endTime - The end time
     *
     * @returns {Promise<AppointmentTimeSlots[]>} - The overlapping time slots
     */
    async getOverlaps(agendaId, startTime, endTime) {
        try {
            const overlappingTimeSlots = await this.table()
                .where({ agenda_id: agendaId, deleted_at: null })
                .andWhere((builder) => {
                    builder
                        .where((inner) =>
                            inner.where('start_time', '>', startTime).andWhere('start_time', '<', endTime)
                        )
                        .orWhere((inner) => inner.where('end_time', '>', startTime).andWhere('end_time', '<', endTime))
                        .orWhere((inner) => {
                            inner.where('start_time', '<', startTime).andWhere('end_time', '>', endTime);
                        })
                        .orWhere((inner) => {
                            inner.where('start_time', '=', startTime).andWhere('end_time', '=', endTime);
                        });
                });

            return overlappingTimeSlots.map((timeSlot) => new AppointmentTimeSlots(timeSlot));
        } catch (error) {
            Helper.logError('Error getting overlaps', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Counts appointment time slots matching the criteria. Read-only list counter routed to the replica.
     * @param {Criteria} criteria
     * @returns {Promise<{count: number}>}
     */
    async count(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table('appointment_time_slots').count());
            query.whereNull('appointment_time_slots.deleted_at');

            const [count] = await query;
            return count;
        } catch (error) {
            Helper.logError('Error counting appointment time slots', error);
            throw new QueryDBError('count');
        }
    }
}
