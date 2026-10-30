import dayjs from 'dayjs';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { NO_PREFILTER } from './EntityCandidateFinder.js';

export class UsersProcessor {
    /**
     * @param {Object} deps
     * @param {import('../../../users/infrastructure/KnexUsersRepository.js').KnexUsersRepository} deps.usersRepository
     * @param {import('../../../shared/domain/services/EntityActionValidator.js').EntityActionValidator} deps.entityActionValidator
     * @param {import('./EntityCandidateFinder.js').EntityCandidateFinder} deps.candidateFinder
     * @param {import('./UserContextBatchLoader.js').UserContextBatchLoader} deps.userContextBatchLoader
     * @param {number} [deps.concurrencyLimit=50]
     */
    constructor({
        usersRepository,
        entityActionValidator,
        candidateFinder,
        userContextBatchLoader,
        concurrencyLimit = 50,
    }) {
        this.usersRepository = usersRepository;
        this.entityActionValidator = entityActionValidator;
        this.candidateFinder = candidateFinder;
        this.userContextBatchLoader = userContextBatchLoader;
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
            bulk_context_queries: 2,
            runtime_validations: 0,
            runtime_validation_passes: 0,
            runtime_validation_failures: 0,
            duration_ms: { prefilter: 0, bulk_context: 0, runtime_validation: 0 },
        };
        const t0 = Date.now();

        // Phase 1: SQL prefilter per action
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

        // Phase 1b: fallback — load full universe and reuse for Phase 2
        let entityById = new Map();
        if (actionsWithoutPrefilter.length > 0) {
            const allActive = await this.usersRepository.findAllActive();
            const allActiveIds = new Set(allActive.map((u) => u.id.value));
            for (const action of actionsWithoutPrefilter) {
                candidatesByAction.set(action.id.value, allActiveIds);
            }
            for (const id of allActiveIds) allCandidateIds.add(id);
            entityById = new Map(allActive.map((u) => [u.id.value, u]));
            this.metrics.universe_loaded = true;
        }

        Helper.logDebug(
            `UsersProcessor::candidates distinct=${allCandidateIds.size} actionsWithoutPrefilter=${actionsWithoutPrefilter.length}`
        );

        if (allCandidateIds.size === 0) return;

        // Phase 2: load entities by IDs only when fallback was NOT triggered
        if (!this.metrics.universe_loaded) {
            const users = await this.usersRepository.findActiveByIds([...allCandidateIds]);
            entityById = new Map(users.map((u) => [u.id.value, u]));
        }

        const candidateUsers = [...entityById.values()];
        this.metrics.candidates_distinct = entityById.size;

        // Phase 3: bulk context load
        const t1 = Date.now();
        const contextMap = await this.userContextBatchLoader.load(candidateUsers);
        this.metrics.duration_ms.bulk_context = Date.now() - t1;

        // Phase 4: build validation inputs and validate in batches
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
                        .validateWithContext(entity, action, contextMap.get(entity.id.value))
                        .then((result) => ({ result, entity, action }))
                        .catch((error) => {
                            Helper.logError(`Error validating action ${action.id.value} for user ${entity.id.value}`);
                            Helper.logError('Critical error in UsersProcessor:', error);
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
            `UsersProcessor::done universe_loaded=${this.metrics.universe_loaded} success=${this.successOperations.length} failed=${this.failedOperations.length} errored=${this.errorOperations.length}`
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
