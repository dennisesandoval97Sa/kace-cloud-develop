import { CaseSessionDuration } from '@kace/core/src/case_session_durations/domain/CaseSessionDuration';
import { ElapsedTimeCalculator } from '@kace/core/src/case_session_durations/domain/ElapsedTimeCalculator';
import { Helper, KnexRepository, QueryDBError } from '@kace/core/src/shared';
import { DbRequestContext } from '@kace/core/src/shared/infrastructure/context/DbRequestContext.js';

export class KnexCaseSessionDurationRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'case_session_durations', readerConfig);
    }

    /**
     * Save an instance of case_session_durations in the database.
     * @param {CaseSessionDuration} sessionDuration
     * @returns {Promise<void>}
     */
    async save(sessionDuration) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: sessionDuration.id.value,
                case_id: sessionDuration.case_id.value,
                user_id: sessionDuration.user_id.value,
                started_at: sessionDuration.started_at.value,
                finished_at: sessionDuration.finished_at?.value ?? null,
                event_type: sessionDuration.event_type?.value ?? null,
                justification: sessionDuration.justification?.value ?? null,
                elapsed_time: sessionDuration.elapsed_time?.value ?? null,
                created_by: sessionDuration.created_by?.value ?? null,
                created_at: this.connection.fn.now(),
            });
        } catch (error) {
            Helper.logError('Error saving case_session_durations', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Searches for CaseSessionDuration instances according to the given criteria.
     * @param {Object} criteria
     * @returns {Promise<CaseSessionDuration[]>}
     */
    async search(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table('case_session_durations').select('*'));
            Helper.logDebug('query:', query.toString());

            const rows = await query;
            return rows.map((row) => this.#toEntity(row));
        } catch (error) {
            Helper.logError('Error searching case_session_durations', error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Finds a CaseSessionDuration instance by its ID.
     * @param {ValueObjectInt|ValueObjectUuid} id
     * @returns {Promise<CaseSessionDuration|null>}
     */
    async find(id) {
        try {
            const result = await this.table().select('*').where({ id: id.value }).first();
            return this.#toEntity(result);
        } catch (error) {
            Helper.logError('Error finding CaseSessionDuration', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Finds an active (unfinished) CaseSessionDuration by case ID and user ID.
     * @param {ValueObjectUuid} caseId
     * @param {ValueObjectUuid} userId
     * @returns {Promise<CaseSessionDuration|null>}
     */
    async findByCaseAndUser(caseId, userId) {
        try {
            const result = await this.table()
                .select('*')
                .where({
                    case_id: caseId.value,
                    user_id: userId.value,
                })
                .whereNull('finished_at')
                .whereNull('deleted_at')
                .orderBy('started_at', 'desc')
                .first();
            return this.#toEntity(result);
        } catch (error) {
            Helper.logError('Error finding CaseSessionDuration by case and user', error);
            throw new QueryDBError('findByCaseAndUser');
        }
    }

    /**
     * Finds duplicate session durations for a case/user/time.
     * @param {number} case_id
     * @param {number} user_id
     * @param {Date|string} started_at
     * @returns {Promise<boolean>}
     */
    async findDuplicate(case_id, user_id, started_at) {
        try {
            const result = await this.table()
                .select('id')
                .where({ case_id, user_id, started_at })
                .whereNull('deleted_at')
                .first();
            return !!result;
        } catch (error) {
            Helper.logError('Error finding duplicate CaseSessionDuration', error);
            throw new QueryDBError('findDuplicate');
        }
    }

    /**
     * Updates a CaseSessionDuration instance in the database.
     * @param {CaseSessionDuration} sessionDuration
     * @returns {Promise<void>}
     */
    async update(sessionDuration) {
        try {
            DbRequestContext.markWrite();
            await this.table()
                .update({
                    case_id: sessionDuration.case_id.value,
                    user_id: sessionDuration.user_id.value,
                    started_at: sessionDuration.started_at.value,
                    finished_at: sessionDuration.finished_at?.value ?? null,
                    event_type: sessionDuration.event_type?.value ?? null,
                    justification: sessionDuration.justification?.value ?? null,
                    elapsed_time: sessionDuration.elapsed_time?.value ?? null,
                    updated_at: this.connection.fn.now(),
                    updated_by: sessionDuration.updated_by?.value ?? null,
                })
                .where({ id: sessionDuration.id.value });
        } catch (error) {
            Helper.logError('Error updating case_session_durations', error);
            throw new QueryDBError('update');
        }
    }

    /**
     * Counts the number of CaseSessionDuration instances that match the given criteria.
     * @param {Object} criteria
     * @returns {Promise<number>}
     */
    async count(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table('case_session_durations').count());
            const [row] = await query;
            return row;
        } catch (error) {
            Helper.logError('Error counting case_session_durations', error);
            throw new QueryDBError('count');
        }
    }

    /**
     * Soft deletes a CaseSessionDuration instance by its ID.
     * @param {ValueObjectInt|ValueObjectUuid} id
     * @param {ValueObjectInt|ValueObjectUuid} deletedBy
     * @returns {Promise<void>}
     */
    async softDelete(id, deletedBy) {
        try {
            DbRequestContext.markWrite();
            await this.table()
                .update({
                    deleted_at: new Date(),
                    deleted_by: deletedBy?.value ?? null,
                })
                .where({ id: id.value });
        } catch (error) {
            Helper.logError('Error soft deleting case_session_durations', error);
            throw new QueryDBError('softDelete');
        }
    }

    /**
     * Deletes the given CaseSessionDuration instance from the database (soft delete using changed attributes).
     *
     * @param {CaseSessionDuration} caseSessionDuration - The CaseSessionDuration instance to delete.
     * @returns {Promise<void>} A promise that resolves when the CaseSessionDuration instance is deleted.
     */
    async delete(caseSessionDuration) {
        try {
            DbRequestContext.markWrite();
            await this.table()
                .update(caseSessionDuration.changedAttributes)
                .where({ id: caseSessionDuration.id.value });
        } catch (error) {
            Helper.logError('Error delete case_session_durations', error);
            throw new QueryDBError('delete');
        }
    }

    /**
     * Construye la entidad a partir de una fila cruda, normalizando la columna `interval`.
     * @param {object|null|undefined} row
     * @returns {CaseSessionDuration|null}
     */
    #toEntity(row) {
        if (!row) {
            return null;
        }

        return new CaseSessionDuration({
            ...row,
            elapsed_time: ElapsedTimeCalculator.fromPostgresInterval(row.elapsed_time),
        });
    }
}
