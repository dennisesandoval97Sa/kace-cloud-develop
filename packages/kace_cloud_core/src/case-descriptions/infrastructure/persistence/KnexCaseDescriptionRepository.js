import { CaseDescription } from '../../index';
import { KnexRepository } from '../../../shared/index';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexCaseDescriptionRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'descripciones_casos', readerConfig);
    }

    /**
     * Saves a new case description in the database.
     * @param {CaseDescription} caseDescription
     * @param {import('knex').Knex.Transaction} [trx] - optional transaction for atomic inserts.
     * @returns {Promise<void>}
     */
    async save(caseDescription, trx) {
        try {
            DbRequestContext.markWrite();
            await (trx ? this.trxTable(trx) : this.table()).insert({
                id: caseDescription.id.value,
                descripcion: caseDescription.descripcion.value,
                created_at: caseDescription.created_at.value,
                created_by: caseDescription.created_by.value,
                updated_at: caseDescription.updated_at.value,
                updated_by: caseDescription.updated_by.value,
            });
        } catch (error) {
            Helper.logInfo('Error saving case descriptions', error);
            throw new QueryDBError('save');
        }
    }

    /**
     *
     * @param {Object} aggregate aggregate class
     * @returns {Promise<void>}
     */
    async update(aggregate) {
        try {
            // This override does not call super.update(), so mark the write manually.
            DbRequestContext.markWrite();
            await this.table().update(aggregate.changedAttributes).where({ id: aggregate.id.value });
        } catch (error) {
            Helper.logInfo('Error updating case descriptions', error);
            throw new QueryDBError('update');
        }
    }

    /**
     * Finds a case description by ID.
     * @param {ValueObjectUuid} id
     * @returns {Promise<CaseDescription | null>}
     */
    async find(id) {
        try {
            const result = await this.table().where({ id: id.value }).first();

            return result ? new CaseDescription(result) : null;
        } catch (error) {
            Helper.logInfo('Error finding case descriptions', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Searches for `CaseDescription` instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<CaseDescription[]>} A promise that resolves to an array of `CaseDescription` instances matching the criteria.
     */
    async search(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table('descripciones_casos').select('*'));
            const rows = await query;
            return rows.map((row) => new CaseDescription(row));
        } catch (error) {
            Helper.logInfo('Error searching for a case descriptions', error);
            throw new QueryDBError('search');
        }
    }
}
