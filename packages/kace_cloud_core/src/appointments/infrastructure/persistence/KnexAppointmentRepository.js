import { CustomError, Helper, InvalidArgumentError, KnexRepository } from '../../../shared/index.js';
import { Appointment } from '../../domain/Appointment.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

/**
 * Class representing the repository for Appointment using Knex.
 */
export class KnexAppointmentRepository extends KnexRepository {
    /**
     * Creates an instance of KnexAppointmentRepository.
     * @param {Object} config
     * @param {Object|null} readerConfig optional replica config for read routing
     */
    constructor(config, readerConfig = null) {
        super(config, 'appointments', readerConfig);
    }

    /**
     * Saves an Appointment object to the database.
     * @param {Appointment} appointment
     * @returns {Promise<void>}
     * @throws {CustomError}
     */
    async save(appointment) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: appointment.id.value,
                case_id: appointment.case_id.value,
                agenda_id: appointment.agenda_id.value,
                date: appointment.date.value,
                start_time: appointment.start_time.value,
                end_time: appointment.end_time.value,
                last_appointment_id: appointment.last_appointment_id.value,
                is_completed: appointment.is_completed.value,
                is_canceled: appointment.is_canceled.value,
                custom_fields: appointment.custom_fields.value,
                assigned_to: appointment.assigned_to.value,
                created_at: appointment.created_at.value,
                created_by: appointment.created_by.value,
            });
        } catch (error) {
            Helper.logError('Error saving the appointment', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Updates an Appointment object in the database.
     * @param {Appointment} appointment
     * @returns {Promise<void>}
     * @throws {InvalidArgumentError}
     */
    async update(appointment) {
        try {
            DbRequestContext.markWrite();
            if (!appointment || !appointment.id) {
                throw new InvalidArgumentError('Appointment must have an ID');
            }

            const result = await this.table().where({ id: appointment.id.value }).update(appointment.changedAttributes);

            if (result === 0) {
                throw new InvalidArgumentError('Appointment not found');
            }
        } catch (error) {
            Helper.logError('Error updating the appointment', error);
            throw new QueryDBError('update');
        }
    }

    /**
     * Finds an Appointment object by its ID.
     * @param {ValueObjectUuid} id
     * @returns {Promise<Appointment|null>}
     * @throws {InvalidArgumentError}
     */
    async find(id) {
        try {
            const idValue = id?.value;

            if (!idValue) {
                throw new InvalidArgumentError('ID is required');
            }

            const appointment = await this.table().where({ id: idValue }).first();

            return appointment ? new Appointment(appointment) : null;
        } catch (error) {
            Helper.logError('Error finding the appointment', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Finds all Appointment objects.
     * @returns {Promise<Appointment[]>}
     */
    async findAll() {
        try {
            return this.read
                .table('appointments')
                .select()
                .whereNull('deleted_at')
                .then((appointments) => appointments.map((appointment) => new Appointment(appointment)));
        } catch (error) {
            Helper.logError('Error getting a list of appointment time slots', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Search based on the provided criteria.
     *
     * @param {Criteria} criteria
     * @returns {Promise<Appointment[]>}
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read.table('appointments').select(`${this.tableName}.*`, 'cases.responsable_id');
            criteria.convertToKnex(queryBuilder);
            queryBuilder.whereNull(`${this.tableName}.deleted_by`);

            const hasAnyRelationship = criteria.relationship;

            if (!hasAnyRelationship) {
                queryBuilder.leftJoin(this.qualifiedName('cases'), 'cases.id', `${this.tableName}.case_id`);
            }

            const appointments = await queryBuilder;
            return appointments.map((appointment) => {
                const aggregate = new Appointment(appointment);
                aggregate.assigned_to = appointment.responsable_id;
                return aggregate;
            });
        } catch (error) {
            Helper.logError('Error searching for appointment time slot', error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Count the number of appointments for a case.
     * @param {Criteria} criteria
     * @returns {Promise<Number>}
     */
    async countByCase(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table('appointments').count());
            const result = await query;

            return result[0].count;
        } catch (error) {
            Helper.logError('Error counting appointment time slots', error);
            throw new QueryDBError('count');
        }
    }

    /**
     * Counts appointments matching the criteria. Read-only list counter routed to the replica.
     * @param {Criteria} criteria
     * @returns {Promise<{count: number}>}
     */
    async count(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table('appointments').count());
            query.whereNull('appointments.deleted_at');

            const [count] = await query;
            return count;
        } catch (error) {
            Helper.logError('Error counting appointments', error);
            throw new QueryDBError('count');
        }
    }
}
