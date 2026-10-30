import { TransitionRule } from '../domain/TransitionRule.js';
import { KnexRepository } from '../../shared/index.js';
import { Helper } from '../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../shared/infrastructure/context/DbRequestContext.js';

export class KnexTransitionRuleRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'transition_rules', readerConfig);
    }

    /**
     * Saves a new TransitionRule record.
     * @param {TransitionRule} transitionRule
     * @returns {Promise<void>}
     */
    async save(transitionRule) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: transitionRule.id.value,
                nombre: transitionRule.nombre.value,
                conditions: JSON.stringify(transitionRule.conditions.value),
                status: transitionRule.status.value,
                created_at: transitionRule.created_at?.value,
                created_by: transitionRule.created_by?.value,
            });
        } catch (error) {
            Helper.logError('Error saving a transition rule:', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Finds a TransitionRule by ID.
     * @param {ValueObjectUuid} id
     * @returns {Promise<TransitionRule | null>}
     */
    async find(id) {
        try {
            const result = await this.read
                .table('transition_rules')
                .where({ id: id.value })
                .whereNull('deleted_at')
                .first();

            return result ? new TransitionRule(result) : null;
        } catch (error) {
            Helper.logError('Error finding transition rule:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Finds a TransitionRule by nombre (case-insensitive).
     * @param {import('../../shared/index.js').ValueObjectDescription} nombre
     * @returns {Promise<TransitionRule | null>}
     */
    async findByNombre(nombre) {
        try {
            const searchValue = nombre.value.toLowerCase();

            let query = this.table().whereNull('deleted_at').first();

            query = query.whereRaw('LOWER("nombre") = ?', [searchValue]);

            const result = await query;
            return result ? new TransitionRule(result) : null;
        } catch (error) {
            Helper.logError('Error finding transition rule by nombre:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Updates a TransitionRule record, serializing JSON fields.
     * @param {TransitionRule} transitionRule
     * @returns {Promise<void>}
     */
    async update(transitionRule) {
        const changes = { ...transitionRule.changedAttributes };
        if (changes.conditions !== undefined) {
            changes.conditions = JSON.stringify(changes.conditions);
        }
        try {
            DbRequestContext.markWrite();
            await this.table().update(changes).where({ id: transitionRule.id.value }).whereNull('deleted_at');
        } catch (error) {
            Helper.logError('Error updating transition rule:', error);
            throw new QueryDBError('update');
        }
    }

    /**
     * Searches TransitionRule records by criteria.
     * @param {import('../../shared/criteria/Criteria.js').Criteria} criteria
     * @returns {Promise<TransitionRule[]>}
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read.table('transition_rules').select('*');
            criteria.convertToKnex(queryBuilder);
            queryBuilder.whereNull('deleted_at');

            const rows = await queryBuilder;
            return rows.map((row) => new TransitionRule(row));
        } catch (error) {
            Helper.logError('Error searching transition rules:', error);
            throw new QueryDBError('search');
        }
    }
}
