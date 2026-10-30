import { ClassificationTemplateRelations } from '../../index';
import { Helper } from '../../../shared/index.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { KnexRepository } from '../../../shared/infrastructure/persistence/KnexRepository.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexClassificationTemplateRelationsRepository extends KnexRepository {
    static TABLE_NAME = 'classification_template_relations';

    constructor(config, readerConfig = null) {
        super(config, KnexClassificationTemplateRelationsRepository.TABLE_NAME, readerConfig);
    }

    /**
     * Saves a new classification-template relationship in the database.
     * @param {ClassificationTemplateRelations} classificationTemplate
     * @param {import('knex').Knex.Transaction} [trx] - Optional transaction object.
     * @returns {Promise<void>}
     */
    async save(classificationTemplate, trx = null) {
        try {
            DbRequestContext.markWrite();
            await (trx ? this.trxTable(trx) : this.table()).insert({
                classification_id: classificationTemplate.classification_id.value,
                template_id: classificationTemplate.template_id.value,
            });
        } catch (error) {
            Helper.logError('Error saving classification-template relationship:', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Find a classification-template relationship by IDs.
     * @param {ValueObjectUuid} classificationId
     * @param {ValueObjectUuid} templateId
     * @param {import('knex').Knex.Transaction} [trx] - Optional transaction object.
     * @returns {Promise<ClassificationTemplateRelations | null>}
     */
    async find(classificationId, templateId, trx = null) {
        try {
            const result = await (trx ? this.trxTable(trx) : this.read.table())
                .where({ classification_id: classificationId.value, template_id: templateId.value })
                .first();

            return result ? new ClassificationTemplateRelations(result) : null;
        } catch (error) {
            Helper.logError('Error finding classification-template relationship:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Searches for `ClassificationTemplateRelations` instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<ClassificationTemplateRelations[]>} A promise that resolves to an array of `ClassificationTemplateRelations` instances matching the criteria.
     */
    async search(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table().select('*'));
            const rows = await query;
            return rows.map((row) => new ClassificationTemplateRelations(row));
        } catch (error) {
            Helper.logError('Error searching classification-template relationships:', error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Counts the number of classification-template relationships based on the given criteria.
     * @param {Object} criteria - The criteria for the count operation.
     * @returns {Promise<number>} A promise that resolves to the count of `ClassificationTemplateRelations` instances matching the criteria.
     */
    async count(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table().count());
            const [rows] = await query;

            return rows;
        } catch (error) {
            Helper.logError('Error counting classification-template relationships:', error);
            throw new QueryDBError('count');
        }
    }

    /**
     * Deletes a classification-template relationship from the database.
     * @param {ClassificationTemplateRelations} classificationTemplate
     * @param {import('knex').Knex.Transaction} [trx] - Optional transaction object.
     * @returns {Promise<void>}
     */
    async delete(classificationTemplate, trx = null) {
        try {
            DbRequestContext.markWrite();
            await (trx ? this.trxTable(trx) : this.table())
                .where({
                    classification_id: classificationTemplate.classification_id.value,
                    template_id: classificationTemplate.template_id.value,
                })
                .del();
        } catch (error) {
            Helper.logError('Error deleting classification-template relationship:', error);
            throw new QueryDBError('delete');
        }
    }
}
