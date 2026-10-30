import { ShiftManagement } from '..';
import { KnexRepository } from '../../shared/index';
import { Helper } from '../../shared/index.js';
import { QueryDBError } from '../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../shared/infrastructure/context/DbRequestContext.js';
import { ScheduleLockConflict } from '../domain/ScheduleLockConflict.js';

const LOCK_NOT_AVAILABLE = '55P03';
const DEFAULT_LOCK_TIMEOUT_MS = 5000;

export class KnexShiftManagementRepository extends KnexRepository {
    /** @type {number} */
    #lockTimeoutMs;

    /**
     * @param {import('knex').Knex.Config | import('knex').Knex} config
     * @param {import('knex').Knex.Config | null} [readerConfig]
     * @param {{ lockTimeoutMs?: number }} [options] bounds how long `findLocked` waits for the row lock
     */
    constructor(config, readerConfig = null, { lockTimeoutMs = DEFAULT_LOCK_TIMEOUT_MS } = {}) {
        // Interpolated into `SET LOCAL lock_timeout` (no bind parameters there), so it must be a plain integer.
        if (!Number.isInteger(lockTimeoutMs) || lockTimeoutMs < 0) {
            throw new TypeError('lockTimeoutMs must be a non-negative integer');
        }
        super(config, 'shift_management', readerConfig);
        this.#lockTimeoutMs = lockTimeoutMs;
    }

    /**
     * Saves a new shift management record in the database.
     * @param {ShiftManagement} shiftManagement
     * @returns {Promise<void>}
     */
    async save(shiftManagement) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: shiftManagement.id.value,
                description: shiftManagement.description.value,
                holiday_dates: JSON.stringify(shiftManagement.holiday_dates.value || []),
                work_days: JSON.stringify(shiftManagement.work_days.value),
                created_at: shiftManagement.created_at.value,
                created_by: shiftManagement.created_by.value,
                updated_at: shiftManagement.updated_at.value,
                updated_by: shiftManagement.updated_by.value,
                deleted_at: shiftManagement.deleted_at.value,
                deleted_by: shiftManagement.deleted_by.value,
            });
        } catch (error) {
            Helper.logError('Error saving shift management:', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Finds a shift management record by ID.
     * @param {ValueObjectUuid} id
     * @returns {Promise<ShiftManagement | null>}
     */
    async find(id) {
        try {
            const result = await this.read.table('shift_management').where({ id: id.value }).first();

            return result ? new ShiftManagement(result) : null;
        } catch (error) {
            Helper.logError('Error finding shift management:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Searches for `ShiftManagement` instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<ShiftManagement[]>} A promise that resolves to an array of `ShiftManagement` instances matching the criteria.
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read.table('shift_management').select('*');

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');

            const rows = await queryBuilder;
            return rows.map((row) => new ShiftManagement(row));
        } catch (error) {
            Helper.logError('Error searching shift management records:', error);
            throw new QueryDBError('search');
        }
    }

    /**
     *
     * @param {string} groupId
     * @returns {Promise<ShiftManagement|null>}
     */
    async findByGroup(groupId) {
        try {
            const query = await this.read
                .table('grupos')
                .select(`${this.tableName}.*`)
                .leftJoin(this.qualifiedName(), `${this.tableName}.id`, 'grupos.horario_id')
                .where({ 'grupos.id': groupId })
                .first();

            if (!query) {
                return null;
            }

            return new ShiftManagement(query);
        } catch (error) {
            Helper.logError('Error finding shift management:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Reads a schedule on the primary inside `trx`, locking its row until commit. A delete takes
     * `forUpdate`; a group save takes the default shared lock, so groups saved concurrently with
     * the same schedule do not serialize but both wait for (and see) a pending delete.
     * @throws {ScheduleLockConflict} 409 when the lock is not granted within the lock timeout
     * @param {ValueObjectUuid} id
     * @param {import('knex').Knex.Transaction} trx
     * @param {{ forUpdate?: boolean }} [options]
     * @returns {Promise<ShiftManagement | null>}
     */
    async findLocked(id, trx, { forUpdate = false } = {}) {
        try {
            // The timeout applies only to this lock wait; it is reset before the caller's writes.
            await trx.raw(`SET LOCAL lock_timeout = ${this.#lockTimeoutMs}`);
            const query = this.trxTable(trx).where({ id: id.value }).first();
            const result = await (forUpdate ? query.forUpdate() : query.forShare());
            await trx.raw('SET LOCAL lock_timeout TO DEFAULT');

            return result ? new ShiftManagement(result) : null;
        } catch (error) {
            if (error?.code === LOCK_NOT_AVAILABLE) {
                throw new ScheduleLockConflict();
            }
            Helper.logError('Error finding shift management:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Counts shift management records matching the criteria. Read-only list counter routed to the replica.
     * @param {Object} criteria
     * @returns {Promise<{count: number}>}
     */
    async count(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table('shift_management').count());
            query.whereNull('shift_management.deleted_at');

            const [count] = await query;
            return count;
        } catch (error) {
            Helper.logError('Error counting shift management records:', error);
            throw new QueryDBError('count');
        }
    }
}
