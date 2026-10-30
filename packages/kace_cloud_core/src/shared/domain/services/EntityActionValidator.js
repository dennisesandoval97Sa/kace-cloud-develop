import { CompositeRule } from '../../../actions/domain/QueryTranslator/CompositeRule.js';
import { RuleValidator } from '../../../actions/domain/QueryTranslator/RuleValidator.js';

/**
 * Generic validator for entity actions (users, groups, etc.)
 * This validator is not coupled to cases and can be used for any entity type.
 */
export class EntityActionValidator {
    /** @type {EntityRulesContextResolver|null} */
    #contextResolver;

    /**
     * @param {EntityRulesContextResolver|null} contextResolver
     */
    constructor(contextResolver = null) {
        this.#contextResolver = contextResolver;
    }

    /**
     * Validate if an entity meets the conditions of an action.
     *
     * @param {Aggregate} entity - Aggregate to be validated (User, Group, etc.)
     * @param {Action} action - Action whose conditions need to be validated
     * @returns {Promise<boolean>} True if the entity meets the action's conditions, false otherwise
     */
    async validate(entity, action) {
        const queryRules = CompositeRule.fromValue(action.conditions.value);
        const context = this.#contextResolver
            ? await this.#contextResolver.resolve(entity)
            : (entity.toRulesContext?.() ?? entity.toJson());
        return RuleValidator.validate(queryRules, context);
    }

    /**
     * Validate using a pre-resolved context (from a batch loader).
     * Skips the contextResolver to avoid per-entity I/O.
     *
     * @param {Aggregate} entity
     * @param {Action} action
     * @param {{ activeSessionLimit?: number }|null} resolvedContext
     * @returns {Promise<boolean>}
     */
    async validateWithContext(entity, action, resolvedContext) {
        const queryRules = CompositeRule.fromValue(action.conditions.value);
        let context;
        if (resolvedContext && typeof entity.toRulesContext === 'function') {
            context = entity.toRulesContext(resolvedContext.activeSessionLimit);
        } else if (typeof entity.toRulesContext === 'function') {
            context = entity.toRulesContext();
        } else {
            context = entity.toJson();
        }
        return RuleValidator.validate(queryRules, context);
    }
}
