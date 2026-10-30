import dayjs from 'dayjs';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { NO_PREFILTER } from './EntityCandidateFinder.js';

export class GroupsProcessor {
    /**
     * @param {Object} deps
     * @param {import('../../../grupos/infrastructure/persistence/KnexGroupsRepository.js').KnexGroupsRepository} deps.groupsRepository
     * @param {import('../../../shared/domain/services/EntityActionValidator.js').EntityActionValidator} deps.entityActionValidator
     * @param {import('./EntityCandidateFinder.js').EntityCandidateFinder} deps.candidateFinder
     * @param {number} [deps.concurrencyLimit=50]
     */
    constructor({ groupsRepository, entityActionValidator, candidateFinder, concurrencyLimit = 50 }) {
        this.groupsRepository = groupsRepository;
        this.entityActionValidator = entityActionValidator;
        this.candidateFinder = candidateFinder;
        this.concurrencyLimit = concurrencyLimit;
        this.successOperations = [];
        this.failedOperations = [];
        this.errorOperations = [];
        this.metrics = {};
    }

    async processEntitiesWithActions(actions) {
        const evaluationNow = dayjs();
        this.metrics = {
            actions_total: actions.length,
            actions_with_sql_prefilter: 0,
            actions_without_prefilter: 0,
            candidates_from_sql: 0,
            candidates_distinct: 0,
            universe_loaded: false,
            bulk_context_queries: 0,
            runtime_validations: 0,
            runtime_validation_passes: 0,
            runtime_validation_failures: 0,
            duration_ms: { prefilter: 0, bulk_context: 0, runtime_validation: 0 },
        };
        const t0 = Date.now();

        const candidatesByAction = new Map();
        const actionsWithoutPrefilter = [];
        const allCandidateIds = new Set();
        for (const action of actions) {
            const result = await this.candidateFinder.find(action, { evaluationNow });
            if (result === NO_PREFILTER) {
                actionsWithoutPrefilter.push(action);
            } else {
                candidatesByAction.set(action.id.value, result);
                for (const id of result) {
                    allCandidateIds.add(id);
                    this.metrics.candidates_from_sql++;
                }
            }
        }
        this.metrics.duration_ms.prefilter = Date.now() - t0;
        this.metrics.actions_with_sql_prefilter = candidatesByAction.size;
        this.metrics.actions_without_prefilter = actionsWithoutPrefilter.length;

        let entityById = new Map();
        if (actionsWithoutPrefilter.length > 0) {
            const allActive = await this.groupsRepository.findAllActive();
            const allActiveIds = new Set(allActive.map((g) => g.id.value));
            for (const action of actionsWithoutPrefilter) {
                candidatesByAction.set(action.id.value, allActiveIds);
            }
            for (const id of allActiveIds) allCandidateIds.add(id);
            entityById = new Map(allActive.map((g) => [g.id.value, g]));
            this.metrics.universe_loaded = true;
        }

        Helper.logDebug(
            `GroupsProcessor::candidates distinct=${allCandidateIds.size} actionsWithoutPrefilter=${actionsWithoutPrefilter.length}`
        );

        if (allCandidateIds.size === 0) return;

        if (!this.metrics.universe_loaded) {
            const groups = await this.groupsRepository.findActiveByIds([...allCandidateIds]);
            entityById = new Map(groups.map((g) => [g.id.value, g]));
        }
        this.metrics.candidates_distinct = entityById.size;

        const inputs = [];
        for (const action of actions) {
            const ids = candidatesByAction.get(action.id.value) ?? new Set();
            for (const id of ids) {
                const entity = entityById.get(id);
                if (entity) inputs.push({ entity, action });
            }
        }
        const t2 = Date.now();
        this.metrics.runtime_validations = inputs.length;
        for (let i = 0; i < inputs.length; i += this.concurrencyLimit) {
            const batch = inputs.slice(i, i + this.concurrencyLimit);
            const results = await Promise.all(
                batch.map(({ entity, action }) =>
                    this.entityActionValidator
                        .validateWithContext(entity, action, null)
                        .then((result) => ({ result, entity, action }))
                        .catch((error) => {
                            Helper.logError(`Error validating action ${action.id.value} for group ${entity.id.value}`);
                            Helper.logError('Critical error in GroupsProcessor:', error);
                            return { result: false, entity, action, error };
                        })
                )
            );
            for (const { result, entity, action, error } of results) {
                const op = { entity, action };
                if (result) {
                    this.metrics.runtime_validation_passes++;
                    this.successOperations.push(op);
                } else if (error) {
                    this.metrics.runtime_validation_failures++;
                    this.errorOperations.push({ ...op, error, attempts: 0 });
                } else {
                    this.metrics.runtime_validation_failures++;
                    this.failedOperations.push({ ...op, attempts: 0 });
                }
            }
        }
        this.metrics.duration_ms.runtime_validation = Date.now() - t2;
        Helper.logDebug(
            `GroupsProcessor::done universe_loaded=${this.metrics.universe_loaded} success=${this.successOperations.length} failed=${this.failedOperations.length} errored=${this.errorOperations.length}`
        );
    }

    getSuccessOperations() {
        return this.successOperations;
    }
    getFailedOperations() {
        return this.failedOperations;
    }
    getErrorOperations() {
        return this.errorOperations;
    }
    getMetrics() {
        return this.metrics;
    }
}
