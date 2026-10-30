import { ClassificationGroupRelationship } from '../../domain/ClassificationGroupRelationship';
import { Helper } from '../../../shared/index.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { KnexRepository } from '../../../shared/infrastructure/persistence/KnexRepository.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexClassificationGroupRelationshipRepository extends KnexRepository {
    static TABLE_NAME = 'classification_group_relationships';

    constructor(config, readerConfig = null) {
        super(config, KnexClassificationGroupRelationshipRepository.TABLE_NAME, readerConfig);
    }

    /**
     * Saves a new classification-group relationship in the database.
     * @param {ClassificationGroupRelationship} relationship
     * @param {import('knex').Knex.Transaction} [trx] - Optional transaction object.
     * @returns {Promise<void>}
     */
    async save(relationship, trx = null) {
        try {
            DbRequestContext.markWrite();
            await (trx ? this.trxTable(trx) : this.table()).insert({
                classification_id: relationship.classification_id.value,
                group_id: relationship.group_id.value,
                form: relationship.form.value,
            });
        } catch (error) {
            Helper.logError('Error saving classification-group relationship:', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Find a classification-group relationship by classification and group IDs.
     * @param {ValueObjectUuid} classificationId
     * @param {ValueObjectUuid} groupId
     * @param {import('knex').Knex.Transaction} [trx] - Optional transaction object.
     * @returns {Promise<ClassificationGroupRelationship | null>}
     */
    async find(classificationId, groupId, trx = null) {
        try {
            const result = await (trx ? this.trxTable(trx) : this.read.table())
                .select(
                    'classification_group_relationships.form',
                    'classification_group_relationships.group_id',
                    'classification_group_relationships.classification_id',
                    'grupos.nombre',
                    'one-script.name'
                )
                .leftJoin(this.qualifiedName('grupos'), 'classification_group_relationships.group_id', 'grupos.id')
                .leftJoin(this.qualifiedName('one-script'), 'classification_group_relationships.form', 'one-script.id')
                .where({ classification_id: classificationId.value, group_id: groupId.value })
                .first();

            return result ? new ClassificationGroupRelationship(result) : null;
        } catch (error) {
            Helper.logError('Error finding classification-group relationship:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Searches for classification-group relationships based on given criteria.
     * @param {Object} criteria - The criteria for the search.
     * @returns {Promise<ClassificationGroupRelationship[]>} A list of matching relationships.
     */
    async search(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table().select('*'));
            query
                .select(
                    'classification_group_relationships.form',
                    'classification_group_relationships.group_id',
                    'classification_group_relationships.classification_id',
                    'grupos.nombre',
                    'one-script.name'
                )
                .leftJoin(this.qualifiedName('grupos'), 'classification_group_relationships.group_id', 'grupos.id')
                .leftJoin(this.qualifiedName('one-script'), 'classification_group_relationships.form', 'one-script.id');
            const rows = await query;
            return rows.map((row) => new ClassificationGroupRelationship(row));
        } catch (error) {
            Helper.logError('Error searching classification-group relationships:', error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Counts the number of classification-group relationships based on given criteria.
     * @param {Object} criteria - The criteria for the count.
     * @returns {Promise<number>} The count of matching relationships.
     */
    async count(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table().count());
            const [rows] = await query;
            return rows;
        } catch (error) {
            Helper.logError('Error counting classification-group relationships:', error);
            throw new QueryDBError('count');
        }
    }

    /**
     * Deletes a classification-group relationship from the database.
     * @param {ClassificationGroupRelationship} relationship
     * @param {import('knex').Knex.Transaction} [trx] - Optional transaction object.
     * @returns {Promise<void>}
     */
    async delete(relationship, trx = null) {
        try {
            DbRequestContext.markWrite();
            await (trx ? this.trxTable(trx) : this.table())
                .where({
                    classification_id: relationship.classification_id.value,
                    group_id: relationship.group_id.value,
                })
                .del();
        } catch (error) {
            Helper.logError('Error deleting classification-group relationship:', error);
            throw new QueryDBError('delete');
        }
    }
}
