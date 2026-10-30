import { CustomError, Helper, KnexRepository, ValidationFailError } from '../../../shared/index.js';
import { AgendasGroups } from '../../domain/AgendasGroups.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexAgendasGroupsRepository extends KnexRepository {
    #FOREIGN_KEY_VIOLATION_CODE = '23503';

    constructor(config, readerConfig = null) {
        super(config, 'agendas_groups', readerConfig);
    }

    /**
     * Start a new transaction.
     *
     * @returns { Promise<Transaction> }
     */
    async startTransaction() {
        // This override opens the transaction directly; mark the request as written so the
        // reader facade pins subsequent reads to the writer (base startTransaction does this).
        DbRequestContext.markWrite();
        return this.connection.transaction();
    }

    /**
     *  Save a new relationship between an agenda and a group.
     *
     * @param { AgendasGroups } agendasGroups
     * @param { Transaction | Knex } trx
     *
     * @throws { ValidationFailError } - If the agenda or group doesn't exists
     *
     * @returns { Promise<void> } - Promise that resolves when the operation is completed.
     */
    async save(agendasGroups, trx = this.connection) {
        try {
            DbRequestContext.markWrite();
            await this.trxTable(trx, this.tableName).insert({
                agenda_id: agendasGroups.agenda_id.value,
                group_id: agendasGroups.group_id.value,
            });
        } catch (error) {
            Helper.logError('Error saving agendas-groups', error);

            if (error.code === this.#FOREIGN_KEY_VIOLATION_CODE) {
                throw new ValidationFailError("The agenda or group doesn't exists", 'data');
            }

            throw new QueryDBError('save');
        }
    }

    /**
     *  Find a relationship between an agenda and a group.
     *
     * @param {ValueObjectAgendaId} agendaId
     * @param {ValueObjectGroupId} groupId
     * @param {Transaction | Knex} trx
     *
     * @returns {Promise<AgendasGroups>}
     */
    async find(agendaId, groupId, trx = this.connection) {
        try {
            const agendasGroups = await this.trxTable(trx, this.tableName)
                .where({ agenda_id: agendaId.value, group_id: groupId.value })
                .first();

            return agendasGroups ? new AgendasGroups(agendasGroups) : null;
        } catch (error) {
            Helper.logError('Error finding the agenda-group', error);
            throw new QueryDBError('find');
        }
    }

    /**
     *  Delete a relationship between an agenda and a group.
     *
     * @param {AgendasGroups} agendasGroups
     * @param {Transaction | Knex} trx
     *
     * @throws {CustomError} - If the relationship doesn't exists or an unexpected error occurs.
     *
     * @returns {Promise<void>} - Promise that resolves when the operation is completed.
     */
    async delete(agendasGroups, trx = this.connection) {
        try {
            // Hard delete on a pivot table (no soft-delete/history) → mark the write manually.
            DbRequestContext.markWrite();
            await this.trxTable(trx, this.tableName)
                .where({ agenda_id: agendasGroups.agenda_id.value, group_id: agendasGroups.group_id.value })
                .del();
        } catch (error) {
            Helper.logError('Error deleting an agenda-groups', error);
            throw new QueryDBError('delete');
        }
    }

    /**
     * Search for relationships between agendas and groups.
     *
     * @param {Criteria} criteria - The search criteria.
     *
     * @throws {CustomError} - If an unexpected error occurs.
     *
     * @returns {Promise<AgendasGroups[]>} - Promise that resolves to an array of Agendas
     */
    async search(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table(this.tableName).select('*'));
            const agendasGroups = await query;
            return agendasGroups.map((agendasGroups) => new AgendasGroups(agendasGroups));
        } catch (error) {
            Helper.logError('Error searching for agenda-groups', error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Counts agenda-group relationships matching the criteria. Read-only list counter routed to
     * the replica. This is a relationship (pivot) table with no `deleted_at`, so no soft-delete filter.
     * @param {Criteria} criteria
     * @returns {Promise<{count: number}>}
     */
    async count(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table(this.tableName).count());
            const [count] = await query;
            return count;
        } catch (error) {
            Helper.logError('Error counting agenda-groups', error);
            throw new QueryDBError('count');
        }
    }
}
