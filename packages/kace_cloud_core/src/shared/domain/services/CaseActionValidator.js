import { CompositeRule } from '../../../actions/domain/QueryTranslator/CompositeRule.js';
import { RuleValidator } from '../../../actions/domain/QueryTranslator/RuleValidator.js';
import { Helper } from '../../infrastructure/utils/Helper.js';

export class CaseActionValidator {
    /** @type {KnexActionRepository} is initialized in the constructor */
    #actionRepository;

    /**
     * @param {KnexActionRepository} actionRepository
     */
    constructor(actionRepository) {
        this.#actionRepository = actionRepository;
    }

    /**
     * Validate if a case meets the conditions of an action.
     *
     * @param {Aggregate} entity Aggregate to be validated
     * @param {Action} action Action whose conditions need to be validated
     * @returns {Promise<boolean>} True if the case meets the action's conditions, false otherwise
     */
    async validate(entity, action) {
        const queryRules = CompositeRule.fromValue(action.conditions.value);
        let context;
        if (action.entity.value && action.entity.value !== 'case') {
            context = entity.toJson();
        } else {
            context = await this.#actionRepository.getCasoInfo(entity);
            Helper.logDebug2('CaseActionValidator::validate::caseContext', context);
        }
        return RuleValidator.validate(queryRules, context, entity);
    }

    /**
     * Variant that uses a preloaded context instead of calling getCasoInfo per validation.
     * @param {object} entity
     * @param {object} action
     * @param {object} preloadedContext
     * @param {{ evaluationNow?: import('dayjs').Dayjs }} [opts]
     */
    async validateWithContext(entity, action, preloadedContext, opts = {}) {
        const queryRules = CompositeRule.fromValue(action.conditions.value);
        const context = action.entity?.value && action.entity.value !== 'case' ? entity.toJson() : preloadedContext;
        return RuleValidator.validate(queryRules, context, entity, opts);
    }
}
