import dayjs from 'dayjs';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { NO_PREFILTER } from './EntityCandidateFinder.js';
import { AuxCaseKeyCollector } from './AuxCaseKeyCollector.js';
import { DEFAULT_ID_CHUNK_SIZE, chunkedFanOut } from '../../../shared/infrastructure/utils/ChunkedFanOut.js';

export class CasesProcessor {
    /**
     * @param {CaseFindAllActiveService} caseFindAllActiveService - Service to retrieve active (non-closed) cases.
     * @param {CaseActionValidator} caseActionValidator - Service to validate if an action can be applied to a case (context-aware).
     * @param {CaseCandidateFinder} caseCandidateFinder - Service to find candidate case IDs via SQL pre-filter.
     * @param {CaseContextBatchLoader} caseContextBatchLoader - Service to load context for a batch of cases.
     * @param {number} [concurrencyLimit=50] - Maximum number of concurrent validations.
     */
    constructor(
        caseFindAllActiveService,
        caseActionValidator,
        caseCandidateFinder,
        caseContextBatchLoader,
        concurrencyLimit = 50
    ) {
        this.caseFindAllActiveService = caseFindAllActiveService;
        this.caseActionValidator = caseActionValidator;
        this.caseCandidateFinder = caseCandidateFinder;
        this.caseContextBatchLoader = caseContextBatchLoader;
        this.concurrencyLimit = concurrencyLimit;
        this.activeCases = [];
        this.successOperations = [];
        this.failedOperations = [];
        this.errorOperations = [];
        this.metrics = {};
    }

    /**
     * Loads all active (non-closed) cases using the provided service.
     *
     * @returns {Promise<void>}
     */
    async loadActiveCases() {
        this.activeCases = await this.caseFindAllActiveService.execute({ 'cases.fecha_resolucion': null });
        Helper.logDebug(`CasesProcessor::loadActiveCases loaded ${this.activeCases.length} active cases`);
    }

    /**
     * Validates and processes all combinations of candidate cases and actions using SQL pre-filter.
     * Actions that cannot be translated to SQL fall back to loading the full active case universe.
     *
     * @param {Array<Object>} actions - List of actions to be validated with candidate cases.
     * @returns {Promise<void>}
     */
    async processCasesWithActions(actions) {
        const evaluationNow = dayjs();

        this.metrics = {
            actions_total: actions.length,
            actions_with_sql_prefilter: 0,
            actions_without_prefilter: 0,
            candidates_from_sql: 0,
            candidates_distinct: 0,
            active_cases_loaded_fallback: false,
            runtime_validations: 0,
            runtime_validation_passes: 0,
            runtime_validation_failures: 0,
            candidate_load_queries: 0,
            duration_ms: { prefilter: 0, bulk_context: 0, runtime_validation: 0, candidate_load: 0 },
        };
        const t0 = Date.now();

        // Phase 1: per-action SQL pre-filter
        const candidatesByAction = new Map();
        const actionsWithoutPrefilter = [];
        const allCandidateIds = new Set();

        for (const action of actions) {
            const result = await this.caseCandidateFinder.find(action, { evaluationNow });
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

        // Phase 1b: fallback universe for actions without pre-filter. The Case entities loaded
        // here are reused as-is in Phase 2 (preloadedCases) instead of being hydrated again by id.
        let allActiveLoaded = false;
        let preloadedCases = [];
        if (actionsWithoutPrefilter.length > 0) {
            preloadedCases = await this.caseFindAllActiveService.execute({ 'cases.fecha_resolucion': null });
            const allActiveIds = new Set(preloadedCases.map((c) => c.id.value));
            for (const action of actionsWithoutPrefilter) {
                candidatesByAction.set(action.id.value, allActiveIds);
            }
            for (const id of allActiveIds) allCandidateIds.add(id);
            allActiveLoaded = true;
        }

        this.metrics.active_cases_loaded_fallback = allActiveLoaded;

        Helper.logDebug(
            `CasesProcessor::candidates distinct=${allCandidateIds.size} actionsWithoutPrefilter=${actionsWithoutPrefilter.length}`
        );

        if (allCandidateIds.size === 0) return;

        // Phase 2: load Case instances for candidates. Ids already hydrated by the Phase 1b
        // fallback (preloadedCases) are reused directly; only the remainder hits the DB again.
        const preloadedById = new Map(preloadedCases.map((c) => [c.id.value, c]));
        const missingIds = [...allCandidateIds].filter((id) => !preloadedById.has(id));
        const t1b = Date.now();
        const loadedCases = await this.#loadCandidateCases(missingIds);
        this.metrics.candidate_load_queries = Math.ceil(missingIds.length / DEFAULT_ID_CHUNK_SIZE);
        this.metrics.duration_ms.candidate_load = Date.now() - t1b;
        const candidateCases = [...preloadedCases, ...loadedCases];
        const caseById = new Map(candidateCases.map((c) => [c.id.value, c]));
        this.activeCases = candidateCases;

        // Phase 3: bulk context
        const t1 = Date.now();
        const auxCaseKeys = AuxCaseKeyCollector.collect(actions);
        const contextMap = await this.caseContextBatchLoader.load(candidateCases, { auxCaseKeys });
        this.metrics.duration_ms.bulk_context = Date.now() - t1;
        this.metrics.candidates_distinct = allCandidateIds.size;

        // Phase 4: validate
        const inputs = [];
        for (const action of actions) {
            const ids = candidatesByAction.get(action.id.value) ?? new Set();
            for (const id of ids) {
                const kase = caseById.get(id);
                if (kase) inputs.push({ activeCase: kase, action });
            }
        }

        const t2 = Date.now();
        this.metrics.runtime_validations = inputs.length;

        for (let i = 0; i < inputs.length; i += this.concurrencyLimit) {
            const batch = inputs.slice(i, i + this.concurrencyLimit);
            const results = await Promise.all(
                batch.map(({ activeCase, action }) =>
                    this.caseActionValidator
                        .validateWithContext(activeCase, action, contextMap.get(activeCase.id.value), { evaluationNow })
                        .then((result) => ({ result, activeCase, action }))
                        .catch((error) => {
                            Helper.logError(
                                `Error validating action ${action.id.value} for case ${activeCase.id.value}`
                            );
                            Helper.logError('Critical error in processCasesWithActions:', error);
                            return { result: false, activeCase, action, error };
                        })
                )
            );

            for (const { result, activeCase, action, error } of results) {
                const op = { case: activeCase, action };
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
            `CasesProcessor::done allActiveLoaded=${allActiveLoaded} success=${this.successOperations.length} failed=${this.failedOperations.length} errored=${this.errorOperations.length}`
        );
    }

    /**
     * Loads Case instances for candidate ids in bounded chunks instead of a single
     * `WHERE id IN (...)`, so a large SQL pre-filter result can't blow past Postgres'
     * bind-parameter limit or force a full-table scan plan.
     *
     * @param {Array<string>} ids
     * @returns {Promise<Array<Object>>}
     */
    async #loadCandidateCases(ids) {
        return chunkedFanOut(ids, (chunk) =>
            this.caseFindAllActiveService.execute({ 'cases.fecha_resolucion': null }, { restrictToIds: chunk })
        );
    }

    /**
     * Gets the current array of loaded active cases.
     *
     * @returns {Array<Object>}
     */
    getActiveCases() {
        return this.activeCases;
    }

    /**
     * Concatenates external operations results into the current processor pool.
     */
    addSuccessOperations(operations) {
        this.successOperations.push(...operations);
    }

    addFailedOperations(operations) {
        this.failedOperations.push(...operations);
    }

    addErrorOperations(operations) {
        this.errorOperations.push(...operations);
    }

    /**
     * Gets the list of successfully validated operations.
     *
     * @returns {Array<Object>} Successful case-action pairs.
     */
    getSuccessOperations() {
        return this.successOperations;
    }

    /**
     * Gets the list of failed operations (i.e., validations that did not pass).
     *
     * @returns {Array<Object>} Failed case-action pairs with retry metadata.
     */
    getFailedOperations() {
        return this.failedOperations;
    }

    /**
     * Gets the list of operations that encountered errors during validation.
     *
     * @returns {Array<Object>} Error case-action pairs with error details and retry metadata.
     */
    getErrorOperations() {
        return this.errorOperations;
    }

    /**
     * Gets processing metrics.
     *
     * @returns {Object}
     */
    getMetrics() {
        return this.metrics;
    }

    /**
     * Clears stored successful and failed operations.
     */
    reset() {
        this.successOperations = [];
        this.failedOperations = [];
        this.errorOperations = [];
    }
}
