import { KnexRepository } from '../../shared/index.js';
import { Helper } from '../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../shared/infrastructure/context/DbRequestContext.js';
import { CustomError } from '../../shared/errors/CustomError.js';

/** How long to wait for another transaction to release the counter row before giving up. */
const LOCK_TIMEOUT = '3s';

/** Most consecutives one skipTaken call moves past. Each call commits, so the next one resumes. */
const MAX_SKIPS = 1000;

export class KnexFolioSequenceRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'folio_sequences', readerConfig);
    }

    /**
     * Reserves and returns the next consecutive number for a (configuration, scope) pair.
     *
     * Two concurrent case creations cannot come out with the same number because the
     * increment is a single self-referencing statement. Under READ COMMITTED — the
     * Postgres default, and nothing in this repo changes it — that UPDATE holds a row
     * lock until COMMIT, and a second transaction that blocks on it re-reads the
     * committed row afterwards and increments from the new value. It does not matter that
     * the two requests are separate Lambdas on separate connections: the serialisation
     * point is the row itself.
     *
     * Reading and then writing in two steps (SELECT, then UPDATE to read+1) would NOT be
     * safe — both transactions would read the same value and one update would be lost.
     * That is exactly the bug the legacy `countCreatedToday` folio has.
     *
     * Passing the case's own `trx` means a rollback also rolls back the reservation, so no
     * numbers are burned; the cost is that concurrent creations for the same configuration
     * serialise for the length of that transaction.
     *
     * @param {Object} params
     * @param {string} params.configId
     * @param {string} params.scopeKey - '' when the counter never resets
     * @param {number} params.startValue - first number the counter must hand out
     * @param {import('knex').Knex.Transaction} [params.trx]
     * @returns {Promise<number>}
     */
    async reserveNext({ configId, scopeKey, startValue, trx }) {
        DbRequestContext.markWrite();

        const db = trx ?? this.connection;
        const table = this.qualifiedName();
        const now = new Date().toISOString();

        try {
            // Before the seed, which can also wait on a concurrent insert of the same row: a
            // clear 409 beats hanging until API Gateway times out. Restored after the
            // increment so the rest of the case transaction keeps its own timeout.
            const previousLockTimeout = trx ? await this.#setLockTimeout(trx, LOCK_TIMEOUT) : null;

            // Seeded at startValue - 1 so the first increment returns exactly startValue.
            // Idempotent: if another transaction already created the row this is a no-op.
            await db(table)
                .insert({
                    config_id: configId,
                    scope_key: scopeKey,
                    current_value: startValue - 1,
                    start_value: startValue,
                    created_at: now,
                    updated_at: now,
                })
                .onConflict(['config_id', 'scope_key'])
                .ignore();

            const reserved = await this.#increment(db, table, configId, scopeKey, now);

            if (trx) {
                await this.#setLockTimeout(trx, previousLockTimeout);
            }

            return reserved;
        } catch (error) {
            // 55P03 lock_not_available: someone else holds the counter row.
            if (error?.code === '55P03') {
                throw new CustomError('El folio está en contención, reintente la operación', 409);
            }
            if (error instanceof CustomError) throw error;
            Helper.logError('Error reserving the next folio sequence value:', error);
            throw new QueryDBError('update');
        }
    }

    /**
     * Transaction-local, like SET LOCAL, but with the value as a binding.
     *
     * @param {import('knex').Knex.Transaction} trx
     * @param {string} value
     * @returns {Promise<string>} the value in effect before the change
     */
    async #setLockTimeout(trx, value) {
        const { rows } = await trx.raw(
            "SELECT current_setting('lock_timeout') AS previous, set_config('lock_timeout', ?, true)",
            [value]
        );
        return rows[0].previous;
    }

    /**
     * Whether a case already carries this folio. Read inside the case transaction, before
     * the INSERT: a unique violation there would abort the whole transaction.
     *
     * @param {string} folio
     * @param {import('knex').Knex.Transaction} [trx]
     * @returns {Promise<boolean>}
     */
    async isFolioTaken(folio, trx) {
        try {
            const db = trx ?? this.connection;
            const row = await db(this.qualifiedName('cases')).where({ folio }).first('id');
            return Boolean(row);
        } catch (error) {
            Helper.logError('Error checking whether a folio is already taken:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Moves the counter past every consecutive whose folio already exists, and COMMITS that
     * move in a transaction of its own.
     *
     * Skipping inside the case transaction is not enough: a rollback of the case returns
     * the skipped numbers too, and the next creation runs into the same taken folios again.
     * Committed here, a run of taken folios is walked once. Only numbers whose folio is
     * already on a case are consumed, so the numbering shows no gap.
     *
     * Call it before the case transaction reserves on the same row: that transaction would
     * hold the row lock this one waits for.
     *
     * @param {Object} params
     * @param {string} params.configId
     * @param {string} params.scopeKey
     * @param {number} params.startValue
     * @param {(value: number) => string|null} params.render - the folio a consecutive renders,
     *   or null when it no longer fits the mask
     * @param {number} [params.maxSkips]
     * @returns {Promise<number>} how many consecutives were skipped
     */
    async skipTaken({ configId, scopeKey, startValue, render, maxSkips = MAX_SKIPS }) {
        DbRequestContext.markWrite();
        const table = this.qualifiedName();
        const now = new Date().toISOString();

        try {
            return await this.connection.transaction(async (trx) => {
                // Transaction-local, so it ends with this transaction.
                await this.#setLockTimeout(trx, LOCK_TIMEOUT);

                await trx(table)
                    .insert({
                        config_id: configId,
                        scope_key: scopeKey,
                        current_value: startValue - 1,
                        start_value: startValue,
                        created_at: now,
                        updated_at: now,
                    })
                    .onConflict(['config_id', 'scope_key'])
                    .ignore();

                const row = await trx(table)
                    .where({ config_id: configId, scope_key: scopeKey })
                    .forUpdate()
                    .first('current_value');
                const current = Number(row.current_value);

                let last = current;
                while (last - current < maxSkips) {
                    const folio = render(last + 1);
                    if (folio === null || !(await this.isFolioTaken(folio, trx))) break;
                    last += 1;
                }

                if (last > current) {
                    await trx(table)
                        .where({ config_id: configId, scope_key: scopeKey })
                        .update({ current_value: last, updated_at: now });
                }

                return last - current;
            });
        } catch (error) {
            if (error?.code === '55P03') {
                throw new CustomError('El folio está en contención, reintente la operación', 409);
            }
            Helper.logError('Error skipping folios already in use:', error);
            throw new QueryDBError('update');
        }
    }

    /**
     * Committed value of a counter, read from the writer without locking it: the cheap check
     * that decides whether skipTaken is needed at all.
     *
     * @param {string} configId
     * @param {string} scopeKey
     * @returns {Promise<number|null>} current value, or null when the counter has no row yet
     */
    async currentValue(configId, scopeKey) {
        try {
            const row = await this.table().where({ config_id: configId, scope_key: scopeKey }).first('current_value');

            return row ? Number(row.current_value) : null;
        } catch (error) {
            Helper.logError('Error reading the folio sequence:', error);
            throw new QueryDBError('find');
        }
    }

    async #increment(db, table, configId, scopeKey, now) {
        const rows = await db(table)
            .where({ config_id: configId, scope_key: scopeKey })
            .update({ current_value: db.raw('current_value + 1'), updated_at: now })
            .returning('current_value');
        return Number(rows[0].current_value);
    }

    /**
     * Reads the counter without touching it, for the configuration preview. Reserving here
     * would burn a consecutive number every time an administrator opens the screen.
     *
     * @param {string} configId
     * @param {string} scopeKey
     * @returns {Promise<number|null>} current value, or null when the counter has no row yet
     */
    async peek(configId, scopeKey) {
        try {
            const row = await this.read
                .table(this.tableName)
                .where({ config_id: configId, scope_key: scopeKey })
                .first('current_value');

            return row ? Number(row.current_value) : null;
        } catch (error) {
            Helper.logError('Error reading the folio sequence:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * The highest number a configuration has handed out across all its counters. Backs the
     * edits that must be refused because they would silently do nothing (changing
     * start_value) or would break the next case (shrinking the consecutive below the digits
     * already in use).
     *
     * Aggregated in SQL rather than read row by row: with reset_policy 'daily' this table
     * grows a row per day and configuration, and with 'prefix' one per distinct prefix.
     *
     * @param {string} configId
     * @returns {Promise<number|null>} the highest current_value, or null when the
     *   configuration has never issued a folio
     */
    async maxCurrentValue(configId) {
        try {
            const row = await this.read
                .table(this.tableName)
                .where({ config_id: configId })
                .max({ highest: 'current_value' })
                .first();

            return row?.highest === null || row?.highest === undefined ? null : Number(row.highest);
        } catch (error) {
            Helper.logError('Error reading the folio sequences of a configuration:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Removes the counters of a configuration. Used when a configuration is deleted so no
     * orphan rows are left behind.
     *
     * @param {string} configId
     * @param {import('knex').Knex.Transaction} [trx]
     * @returns {Promise<void>}
     */
    async deleteByConfigId(configId, trx) {
        DbRequestContext.markWrite();
        try {
            await (trx ? this.trxTable(trx) : this.table()).where({ config_id: configId }).delete();
        } catch (error) {
            Helper.logError('Error deleting folio sequences:', error);
            throw new QueryDBError('delete');
        }
    }
}
