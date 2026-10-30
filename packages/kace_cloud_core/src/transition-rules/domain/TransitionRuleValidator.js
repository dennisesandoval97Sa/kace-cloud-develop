import { RuleValidator } from '../../actions/domain/QueryTranslator/RuleValidator.js';
import { CompositeRule } from '../../actions/domain/QueryTranslator/CompositeRule.js';
import { Helper, ValidationFailError, ValueObjectUuid } from '../../shared/index.js';
import { CustomError } from '../../shared/errors/CustomError.js';
import { TransitionConditionsNotMetError } from './TransitionConditionsNotMetError.js';
import { TransitionConditionLabeler } from './TransitionConditionLabeler.js';

/**
 * Validator for TransitionRule conditions.
 * Independent from CaseActionValidator to avoid coupling with the Actions module.
 * Uses RuleValidator and CompositeRule directly from the actions domain (low-level, stable contracts).
 */
export class TransitionRuleValidator {
    /**
     * Validates a transition rule against an existing case (case already exists in DB).
     * Used by CaseTransitionsUpdater and CaseUpdater.
     *
     * @param {import('../../cases/domain/Case.js').Case} kase - The case entity
     * @param {import('./TransitionRule.js').TransitionRule} rule - The rule to evaluate
     * @param {import('../../cases/infrastructure/persistence/KnexCaseRepository.js').KnexCaseRepository} repository - Case repository with getCasoInfo
     * @returns {Promise<boolean>}
     */
    static async validateFromCase(kase, rule, repository) {
        const context = await repository.getCasoInfo(kase);
        const conditions = CompositeRule.fromValue(rule.conditions.value);
        return RuleValidator.validate(conditions, context, kase);
    }

    /**
     * Validates a transition rule against a case DTO (case does not yet exist in DB).
     * Used by CaseCreator before saving the case.
     *
     * @param {Object} dto - The case DTO (contains cliente_id, clasificacion_id, etc.)
     * @param {import('./TransitionRule.js').TransitionRule} rule - The rule to evaluate
     * @param {import('../../cases/infrastructure/persistence/KnexCaseRepository.js').KnexCaseRepository} repository - Case repository with buildCaseContextFromDto
     * @returns {Promise<boolean>}
     */
    static async validateFromDto(dto, rule, repository) {
        const context = await repository.buildCaseContextFromDto(dto);
        const conditions = CompositeRule.fromValue(rule.conditions.value);
        return RuleValidator.validate(conditions, context);
    }

    /**
     * Validates transition rule using a merged context composed from:
     * - Existing persisted context (optional, when caseId is provided)
     * - Incoming case DTO changes
     * - Explicit module overrides (aux_cases, aux_clients, clients, clasificaciones, estados)
     *
     * @param {string} transitionId
     * @param {import('../../cases/infrastructure/persistence/KnexTransitionsCaseRepository.js').KnexTransitionsCaseRepository} transitionsCaseRepo
     * @param {import('../infrastructure/KnexTransitionRuleRepository.js').KnexTransitionRuleRepository} transitionRuleRepo
     * @param {import('../../cases/infrastructure/persistence/KnexCaseRepository.js').KnexCaseRepository} caseRepo
     * @param {{
     *   caseId?: string,
     *   contextOverrides?: {
     *     aux_cases?: Object,
     *     aux_clients?: Object,
     *     clients?: Object,
     *     clasificaciones?: Object,
     *     estados?: Object,
     *     case?: Object
     *   }
     * }} [options]
     * @returns {Promise<void>}
     */
    static async enforceRuleForTransitionWithMergedContext(
        transitionId,
        transitionsCaseRepo,
        transitionRuleRepo,
        caseRepo,
        options = {}
    ) {
        const transition = await transitionsCaseRepo.findById(transitionId);
        if (!transition) {
            throw new ValidationFailError(`Transition with id ${transitionId} does not exist.`, 'case.transition_id');
        }
        if (!transition?.rule_id) return;

        const rule = await transitionRuleRepo.find(new ValueObjectUuid('rule_id', transition.rule_id));
        if (!rule) return;

        const { caseId = null, contextOverrides = {} } = options;
        const caseDto = contextOverrides.case ? contextOverrides.case : contextOverrides.cases;
        const persistedContext = caseId
            ? await caseRepo.getCaseContextById(new ValueObjectUuid('case_id', caseId))
            : null;

        const mergedContextDto = {
            cases: {
                ...(persistedContext?.cases ?? {}),
                ...(caseDto ?? {}),
            },
            aux_cases: {
                ...(persistedContext?.aux_cases ?? {}),
                ...(contextOverrides?.aux_cases?.data ?? {}),
            },
            aux_clients: {
                ...(persistedContext?.aux_clients ?? {}),
                ...(contextOverrides?.aux_clients?.data ?? {}),
            },
            clients: {
                ...(persistedContext?.clients ?? {}),
                ...(contextOverrides?.clients ?? {}),
            },
            clasificaciones: {
                ...(persistedContext?.clasificaciones ?? {}),
                ...(contextOverrides?.clasificaciones ?? {}),
            },
            estados: {
                ...(persistedContext?.estados ?? {}),
                ...(contextOverrides?.estados ?? {}),
            },
        };

        const conditions = CompositeRule.fromValue(rule.conditions.value);
        const conditionsMet = RuleValidator.validate(conditions, mergedContextDto);
        if (!conditionsMet) {
            throw new TransitionConditionsNotMetError(
                await this.labelDiagnostic(this.diagnose(conditions, mergedContextDto), caseRepo)
            );
        }
    }

    /**
     * Qué condiciones incumple el contexto, para que el bloqueo llegue al cliente con motivo.
     *
     * El diagnóstico es información añadida sobre un rechazo YA decidido por `validate`, así que
     * un fallo suyo no puede convertir un 400 de negocio en un 500: se registra y el error viaja
     * sin detalle.
     *
     * @param {CompositeRule} conditions
     * @param {Object} context
     * @param {import('../../cases/domain/Case.js').Case} [kase]
     * @returns {{ combinator: string|null, failed: Array<object> }|null}
     */
    static diagnose(conditions, context, kase = undefined) {
        try {
            const { combinator, failed } = RuleValidator.explain(conditions, context, kase);
            return { combinator, failed };
        } catch (error) {
            Helper.logError('Error explaining transition rule conditions:', error);
            return null;
        }
    }

    /**
     * Finds the transition by ID, resolves its rule (if any), validates conditions and throws if not met.
     * Encapsulates the full rule-enforcement flow shared by CaseCreator, CaseUpdater and CaseTransitionsUpdater.
     *
     * @param {string} transitionId
     * @param {import('../../cases/infrastructure/persistence/KnexTransitionsCaseRepository.js').KnexTransitionsCaseRepository} transitionsCaseRepo
     * @param {import('../infrastructure/KnexTransitionRuleRepository.js').KnexTransitionRuleRepository} transitionRuleRepo
     * @param {import('../../cases/domain/Case.js').Case|Object} caseOrDto - Case entity (mode='case') or plain DTO (mode='dto')
     * @param {import('../../cases/infrastructure/persistence/KnexCaseRepository.js').KnexCaseRepository} caseRepo
     * @param {'case'|'dto'} [mode='case']
     * @returns {Promise<void>}
     */
    static async enforceRuleForTransition(
        transitionId,
        transitionsCaseRepo,
        transitionRuleRepo,
        caseOrDto,
        caseRepo,
        mode = 'case'
    ) {
        const transition = await transitionsCaseRepo.findById(transitionId);
        if (!transition?.rule_id) return;
        const rule = await transitionRuleRepo.find(new ValueObjectUuid('rule_id', transition.rule_id));
        if (!rule) return;
        const conditionsMet =
            mode === 'dto'
                ? await this.validateFromDto(caseOrDto, rule, caseRepo)
                : await this.validateFromCase(caseOrDto, rule, caseRepo);
        if (!conditionsMet) {
            throw new TransitionConditionsNotMetError(
                await this.labelDiagnostic(await this.diagnoseFromRepository(rule, caseOrDto, caseRepo, mode), caseRepo)
            );
        }
    }

    /**
     * Pone nombre a los usuarios, grupos, estados y clasificaciones que cita el diagnóstico. Como
     * `diagnose`, un fallo aquí no cambia el rechazo: el diagnóstico sale con los ids.
     *
     * @param {{ combinator: string|null, failed: Array<object> }|null} diagnostic
     * @param {import('../../cases/infrastructure/persistence/KnexCaseRepository.js').KnexCaseRepository} caseRepo
     * @returns {Promise<{ combinator: string|null, failed: Array<object> }|null>}
     */
    static async labelDiagnostic(diagnostic, caseRepo) {
        try {
            return await TransitionConditionLabeler.label(diagnostic, caseRepo);
        } catch (error) {
            Helper.logError('Error naming the entities of transition rule conditions:', error);
            return diagnostic;
        }
    }

    /**
     * Igual que `diagnose`, para los llamadores que no tienen el contexto en la mano: lo vuelve a
     * construir, y solo en el camino de rechazo, para no añadir una lectura al camino feliz.
     *
     * @param {import('./TransitionRule.js').TransitionRule} rule
     * @param {import('../../cases/domain/Case.js').Case|Object} caseOrDto
     * @param {import('../../cases/infrastructure/persistence/KnexCaseRepository.js').KnexCaseRepository} caseRepo
     * @param {'case'|'dto'} mode
     * @returns {Promise<{ combinator: string|null, failed: Array<object> }|null>}
     */
    static async diagnoseFromRepository(rule, caseOrDto, caseRepo, mode) {
        try {
            const context =
                mode === 'dto'
                    ? await caseRepo.buildCaseContextFromDto(caseOrDto)
                    : await caseRepo.getCasoInfo(caseOrDto);
            const conditions = CompositeRule.fromValue(rule.conditions.value);

            return this.diagnose(conditions, context, mode === 'dto' ? undefined : caseOrDto);
        } catch (error) {
            Helper.logError('Error rebuilding the context to explain transition rule conditions:', error);
            return null;
        }
    }
}
