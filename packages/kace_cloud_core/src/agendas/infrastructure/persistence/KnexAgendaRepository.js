import {
    CustomError,
    Helper,
    InvalidArgumentError,
    KnexRepository,
    ValidationFailError,
} from '../../../shared/index.js';
import { Agenda } from '../../domain/Agenda';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexAgendaRepository extends KnexRepository {
    #FOREIGN_KEY_VIOLATION_CODE = '23503';

    constructor(config, readerConfig = null) {
        super(config, 'agendas', readerConfig);
    }

    /**
     * Save an agenda in the database
     *
     * @param { Agenda } agenda The agenda to be saved
     *
     * @return { Promise<void> } Empty promise
     * @throws { CustomError|ValidationFailError } If an unexpected error occurs
     */
    async save(agenda) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: agenda.id.value,
                description: agenda.description.value,
                is_active: agenda.is_active.value,
                one_script_id: agenda.one_script_id.value,
                daily_limit: agenda.daily_limit.value,
                is_for_weekend: agenda.is_for_weekend.value,
                created_at: agenda.created_at.value,
                created_by: agenda.created_by.value,
            });
        } catch (error) {
            Helper.logError('Error saving the agenda', error);

            if (error.code === this.#FOREIGN_KEY_VIOLATION_CODE) {
                throw new ValidationFailError('One script not found', 'one_script_id');
            }

            throw new QueryDBError('save');
        }
    }

    /**
     * Update an agenda in the database
     *
     * @param { Agenda } agenda The agenda to be updated
     *
     * @return { Promise<void> } Empty promise
     * @throws { InvalidArgumentError } If the agenda does not have an ID
     */
    async update(agenda) {
        try {
            DbRequestContext.markWrite();
            if (!agenda || !agenda.id) {
                throw new InvalidArgumentError('Agenda must have an ID');
            }

            const result = await this.table().where({ id: agenda.id.value }).update(agenda.changedAttributes);

            if (result === 0) {
                throw new InvalidArgumentError('Agenda not found');
            }
        } catch (error) {
            Helper.logError('Error updating the agenda', error);
            throw new QueryDBError('update');
        }
    }

    /**
     * Find an agenda by its ID
     *
     * @param { ValueObjectUuid } id The ID of the agenda to be found
     *
     * @return { Promise<?Agenda> } The found agenda or null if not found
     */
    async find(id) {
        try {
            const idValue = id?.value;

            if (!idValue) {
                throw new InvalidArgumentError('ID is required');
            }

            const agenda = await this.table().where({ id: idValue }).first();

            return agenda ? new Agenda(agenda) : null;
        } catch (error) {
            Helper.logError('Error finding the agenda', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Find all agendas which are not deleted
     *
     * @return { Promise<Agenda[]> } The list of found agendas
     */
    async findAll() {
        try {
            return this.read
                .table('agendas')
                .select()
                .where({ deleted_at: null })
                .then((agendas) => agendas.map((agenda) => new Agenda(agenda)));
        } catch (error) {
            Helper.logError('Error getting list of agenda', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Search for agendas based on the given criteria
     *
     * @param {Criteria} criteria The criteria to be used in the search
     * @return {Promise<Agenda[]>} The list of found agendas
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read.table('agendas').select('*');
            criteria.convertToKnex(queryBuilder);
            queryBuilder.whereNull('deleted_by');

            const agendas = await queryBuilder;
            return agendas.map((agenda) => new Agenda(agenda));
        } catch (error) {
            Helper.logError('Error searching for agenda', error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Counts the number of time slots that exist for an agenda
     * @param {string} agendaId - The ID of the agenda to filter appointment time slot.
     * @returns {Promise<number>} The count appointments time slot.
     * @throws {InvalidArgumentError} If the agenda ID is invalid.
     * If no appointments time slots are found, returns 0.
     */
    async countAppointmentTimeSlot(agendaId) {
        try {
            if (!agendaId) {
                throw new InvalidArgumentError('Agenda ID is required');
            }

            return await this.table('appointment_time_slots')
                .where({ agenda_id: agendaId })
                .count('id as count')
                .then((result) => parseInt(result[0].count, 10) || 0);
        } catch (error) {
            Helper.logError('Error counting appointment time slot', error);
            throw new QueryDBError('count');
        }
    }

    /**
     * Counts agendas matching the criteria. Read-only list counter routed to the replica.
     * @param {Criteria} criteria
     * @returns {Promise<{count: number}>}
     */
    async count(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table('agendas').count());
            query.whereNull('agendas.deleted_at');

            const [count] = await query;
            return count;
        } catch (error) {
            Helper.logError('Error counting agendas', error);
            throw new QueryDBError('count');
        }
    }
}
