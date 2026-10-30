import { Classification } from '../../index';
import { EntityCache, KnexRepository } from '../../../shared/index';
import { Helper } from '../../../shared/index.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

const CLASSIFICATIONS_NAMESPACE = 'classifications';
const CLASSIFICATIONS_TTL_MS = 60_000;

export class KnexClassificationRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'clasificaciones', readerConfig);
    }

    /**
     * Saves a new classification in the database.
     * @param {Classification} classification
     * @param {import('knex').Knex.Transaction} [trx]
     * @returns {Promise<void>}
     */
    async save(classification, trx = null) {
        try {
            DbRequestContext.markWrite();
            await (trx ? this.trxTable(trx) : this.table()).insert({
                id: classification.id.value,
                nivel1: classification.nivel1.value,
                nivel2: classification.nivel2.value,
                nivel3: classification.nivel3.value,
                nivel4: classification.nivel4.value,
                nivel5: classification.nivel5.value,
                nivel6: classification.nivel6.value,
                nivel7: classification.nivel7.value,
                nivel8: classification.nivel8.value,
                nivel9: classification.nivel9.value,
                nivel10: classification.nivel10.value,
                flujo_id: classification.flujo_id.value,
                ans_id: classification.ans_id.value,
                is_active: classification.is_active.value,
                can_start_sub_cases_flow: classification.can_start_sub_cases_flow.value,
                created_at: classification.created_at.value,
                updated_at: classification.updated_at.value,
                created_by: classification.created_by.value,
                updated_by: classification.updated_by.value,
                default_group_id: classification.default_group_id.value,
                folio_config_id: classification.folio_config_id.value,
                external_id: classification.external_id.value,
                json_flujo: classification.json_flujo.value,
                description: classification.description,
            });
            EntityCache.invalidateNamespace(CLASSIFICATIONS_NAMESPACE);
        } catch (error) {
            Helper.logError('Error saving classification:', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Find a classification by ID.
     * @param {ValueObjectUuid} id
     * @param {Object} options - Optional parameters
     * @param {boolean} options.skipCache - Whether to bypass the cache
     * @returns {Promise<Classification | null>}
     */
    async find(id, { skipCache = false } = {}) {
        try {
            const fetcher = async () => {
                const result = await this.read.table().where({ id: id.value }).first();
                if (!result) return null;
                const classification = new Classification(result);
                const relatedIds = classification.getClassificationsIds();
                if (relatedIds?.length) {
                    const relatedClassifications = await this.read.table().whereIn('id', relatedIds);
                    classification.relations = relatedClassifications.map((rc) => new Classification(rc).toJson());
                } else {
                    classification.relations = [];
                }
                return classification;
            };
            if (skipCache) {
                return await fetcher();
            }
            return await EntityCache.get(CLASSIFICATIONS_NAMESPACE, id.value, fetcher, CLASSIFICATIONS_TTL_MS);
        } catch (error) {
            Helper.logError('Error finding classification:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Updates an existing classification.
     * @param {Classification} classification
     * @returns {Promise<void>}
     */
    async update(classification) {
        if (Object.keys(classification.changedAttributes).length === 0) {
            return;
        }

        try {
            DbRequestContext.markWrite();
            await this.table().update(classification.changedAttributes).where({ id: classification.id.value });
            EntityCache.invalidateNamespace(CLASSIFICATIONS_NAMESPACE);
        } catch (error) {
            Helper.logError('Error updating classification:', error);
            throw new QueryDBError('update');
        }
    }

    /**
     * Searches for `Classification` instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<Classification[]>} A promise that resolves to an array of `Classification` instances matching the criteria.
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read.table().select('*');

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');

            const rows = await queryBuilder;
            return rows.map((row) => new Classification(row));
        } catch (error) {
            Helper.logError('Error searching classifications:', error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Counts the number of classifications based on the given criteria.
     * @param {Object} criteria - The criteria for the count operation.
     * @returns {Promise<number>} A promise that resolves to the count of `Classification` instances matching the criteria.
     */
    async count(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table().count());
            const [rows] = await query;

            return rows;
        } catch (error) {
            Helper.logError('Error counting classifications:', error);
            throw new QueryDBError('count');
        }
    }

    /**
     * Validate that all given classification IDs exist in the table.
     * @param {ValueObjectUuid[]} ids
     * @returns {Boolean} true if all exist, false otherwise
     */
    async validateMultipleClassifications(ids) {
        try {
            const idValues = ids.map((id) => id.value);

            const results = await this.read.table().select('id').whereIn('id', idValues);

            return results.length === idValues.length;
        } catch (error) {
            Helper.logError('Error validate Classifications:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Save classification and subclassification relations.
     * @param {Array}
     * @throws {QueryDBError}
     */

    async saveRelations(dtos, trx = null) {
        try {
            DbRequestContext.markWrite();
            await (
                trx
                    ? this.trxTable(trx, 'classifications_subclassifications_relationships')
                    : this.table('classifications_subclassifications_relationships')
            ).insert(dtos);
            EntityCache.invalidateNamespace(CLASSIFICATIONS_NAMESPACE);
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Delete multiple classification-subclassification relationships.
     * @param {{classification_id: ValueObjectUuid, sub_classification_id: ValueObjectUuid}[]} relationships
     * @throws {QueryDBError}
     */
    async deleteRelations(relationships) {
        try {
            DbRequestContext.markWrite();
            await this.table('classifications_subclassifications_relationships')
                .where((qb) => {
                    relationships.forEach((rel) => {
                        qb.orWhere({
                            classification_id: rel.classification_id,
                            sub_classification_id: rel.sub_classification_id,
                        });
                    });
                })
                .del();
            EntityCache.invalidateNamespace(CLASSIFICATIONS_NAMESPACE);
        } catch (error) {
            Helper.logError('Error deleting classification-subclassification relationships:', error);
            throw new QueryDBError('delete');
        }
    }
}
