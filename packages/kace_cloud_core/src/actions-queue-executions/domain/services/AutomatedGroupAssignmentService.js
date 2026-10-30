import dayjs from 'dayjs';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { ActionTypes } from '../../../actions/domain/ActionTypes.js';
import { ActionTriggers } from '../../../shared/index.js';
import CaseUserAssignmentService from '../../../cases/application/CaseUserAssignmentService.js';
import { ValueObjectAssignmentChangeType } from '../../../cases/domain/ValueObjectAssignmentChangeType.js';
import { CaseFindAllActiveService } from '../../../cases/domain/services/CaseFindAllActiveService.js';
import { UserSlotAssignmentStrategy } from './strategies/UserSlotAssignmentStrategy.js';
import { PrioritizedAssignmentStrategy } from './strategies/PrioritizedAssignmentStrategy.js';
import { NO_PREFILTER } from './EntityCandidateFinder.js';
import { CapacityTracker } from './strategies/CapacityTracker.js';
import { AutomatedAssignmentEventLogger } from './AutomatedAssignmentEventLogger.js';
import { ExternalCodeGroupResolver } from './ExternalCodeGroupResolver.js';
import { chunkedFanOut } from '../../../shared/infrastructure/utils/ChunkedFanOut.js';

const CANDIDATE_CAP_SLACK_FACTOR = Math.max(1, Number(process.env.AUTOMATED_ASSIGNMENT_CANDIDATE_SLACK_FACTOR) || 3);
const CANDIDATE_HARD_CAP = Math.max(1, Number(process.env.AUTOMATED_ASSIGNMENT_CANDIDATE_HARD_CAP) || 2000);
const CANDIDATE_MIN_CAP = 50;

/**
 * @typedef {Object} AssignResult
 * @property {number} assigned - Number of cases successfully assigned.
 * @property {number} skipped  - Number of cases skipped (no valid user, no handler, etc.).
 * @property {number} errors   - Number of errors encountered during assignment.
 */

export class AutomatedGroupAssignmentService {
    /**
     * @param {import('../../../shared/domain/services/CaseActionValidator.js').CaseActionValidator} caseActionValidator
     * @param {Object} dependencies
     * @param {import('../../../grupos/infrastructure/persistence/KnexGroupsRepository.js').KnexGroupsRepository} dependencies.groupsRepository
     * @param {Object} [dependencies.userListsRepository]
     * @param {import('../../../cases/infrastructure/persistence/KnexCaseRepository.js').KnexCaseRepository} dependencies.caseRepository
     * @param {import('../../../shared/assignation/AssignationService.js').AssignationService} dependencies.assignationService
     * @param {import('../../../actions/domain/types/AssignGroupByExternalDynamicCode.js').AssignGroupByExternalDynamicCode} [dependencies.dynamicGroupAssignmentHandler]
     * @param {Object} [dependencies.caseUserAssignmentService] - Injected assignment service. Falls back to creating one from caseRepository.
     * @param {Object} [dependencies.backlogSnapshotsRepository] - Last backlog per action computed off-tick; dead actions read it instead of counting.
     * @param {Object} [dependencies.caseFindAllActiveService] - Injected case finder. Falls back to creating one from caseRepository.
     */
    constructor(
        caseActionValidator,
        {
            groupsRepository,
            userListsRepository,
            caseRepository,
            assignationService,
            dynamicGroupAssignmentHandler,
            caseUserAssignmentService,
            caseFindAllActiveService,
            caseCandidateFinder,
            caseContextBatchLoader,
            backlogSnapshotsRepository,
            runObserver,
        } = {}
    ) {
        this.caseActionValidator = caseActionValidator;
        this.groupsRepository = groupsRepository;
        this.userListsRepository = userListsRepository;
        this.caseRepository = caseRepository;
        this.assignationService = assignationService;
        this.dynamicGroupAssignmentHandler = dynamicGroupAssignmentHandler || null;
        this.caseFindAllActiveService = caseFindAllActiveService || new CaseFindAllActiveService(caseRepository);
        this.caseUserAssignmentService = caseUserAssignmentService || new CaseUserAssignmentService(caseRepository);
        this.caseCandidateFinder = caseCandidateFinder || null;
        this.caseContextBatchLoader = caseContextBatchLoader || null;
        this.backlogSnapshotsRepository = backlogSnapshotsRepository || null;
        this.externalCodeGroupResolver = new ExternalCodeGroupResolver(groupsRepository);

        this.eventLogger = new AutomatedAssignmentEventLogger(caseRepository);
        this.runObserver = runObserver || null;

        this.defaultStrategy = new UserSlotAssignmentStrategy(
            caseActionValidator,
            this.caseUserAssignmentService,
            this.eventLogger,
            this.runObserver
        );
        this.prioritizedStrategy = new PrioritizedAssignmentStrategy(
            caseActionValidator,
            this.caseUserAssignmentService,
            this.eventLogger,
            caseRepository,
            this.runObserver
        );
    }

    /**
     * Loads the active-case universe (cases.fecha_resolucion = null) and assigns an
     * independent Set clone to each provided action key in `candidatesByAction`.
     *
     * Cloning per action prevents downstream mutations (e.g. .delete(id)) from
     * bleeding across actions that would otherwise share the same Set reference.
     *
     * When `caseById` is provided, also populates it in-place with `id → case` entries
     * from the same load — this is required by passive mode (no SQL collaborators) so
     * Phase 2 ramas can resolve `caseById.get(caseId)` instead of receiving undefined.
     * The NO_PREFILTER fallback path in sub-phase B leaves `caseById` undefined because
     * sub-phase C re-loads via `restrictToIds` for the bulk context join.
     *
     * @param {Object} params
     * @param {Map<string, Set<string>>} params.candidatesByAction - Map to populate in-place.
     * @param {Map<string, Object>} [params.caseById] - Optional map to populate in-place.
     * @param {Array<import('../../../actions/domain/Action.js').Action>} params.actions
     * @returns {Promise<Set<string>>} The shared base Set of active IDs (read-only for callers).
     */
    async #loadActiveUniverseInto({ candidatesByAction, caseById, actions }) {
        const allActive = await this.caseFindAllActiveService.execute({ 'cases.fecha_resolucion': null });
        const allActiveIds = new Set(allActive.map((c) => c.id.value));
        for (const action of actions) {
            // Clone per action: downstream phases may mutate (e.g. delete()) these Sets and
            // a shared reference would bleed the mutation across every action's candidate list.
            candidatesByAction.set(action.id.value, new Set(allActiveIds));
        }
        if (caseById) {
            for (const c of allActive) {
                caseById.set(c.id.value, c);
            }
        }
        return allActiveIds;
    }

    /**
     * Snapshots each action's candidate-set size into a fresh Map. Captured BEFORE capping so the
     * reported backlog reflects the REAL pre-cap volume even after #capCandidatesByCapacity trims
     * what we hydrate.
     */
    #snapshotBacklog(candidatesByAction) {
        const backlogByAction = new Map();
        for (const [actionId, set] of candidatesByAction) {
            backlogByAction.set(actionId, set.size);
        }
        return backlogByAction;
    }

    async #prefilterCandidates(actions, { evaluationNow, capacityByGroup, trackerByGroup }) {
        const metrics = {
            actions_total: actions.length,
            actions_with_sql_prefilter: 0,
            actions_without_prefilter: 0,
            candidates_from_sql: 0,
            candidates_distinct: 0,
            candidates_capped: 0,
            candidates_dropped: 0,
            candidates_backlog_prefilter: 0,
            fallback_universe_loaded: false,
            bulk_context_queries: 5,
            duration_ms: { prefilter: 0, bulk_context: 0 },
        };

        // Passive mode: SQL collaborators not wired. Preserve parity with legacy behavior by
        // populating BOTH candidatesByAction AND caseById from the same active-universe load —
        // Phase 2 ramas (#processCurrentGroupAssignment, #handleGroupAssignment work-queue branch,
        // #processNonWorkQueueAssignment) resolve cases via `caseById?.get(caseId)`; leaving it
        // empty here was the regression that yielded result.assigned=0. Skip the bulk context
        // load — downstream branches fall back to per-case context lookups.
        if (!this.caseCandidateFinder || !this.caseContextBatchLoader) {
            const candidatesByAction = new Map();
            const caseById = new Map();
            const allActiveIds = await this.#loadActiveUniverseInto({ candidatesByAction, caseById, actions });
            metrics.candidates_distinct = allActiveIds.size;
            metrics.candidates_backlog_prefilter = allActiveIds.size;
            metrics.fallback_universe_loaded = true;
            const backlogByAction = this.#snapshotBacklog(candidatesByAction);
            return { candidatesByAction, caseById, contextMap: new Map(), metrics, backlogByAction };
        }

        const t0 = Date.now();
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
                    metrics.candidates_from_sql++;
                }
            }
        }
        metrics.duration_ms.prefilter = Date.now() - t0;
        metrics.actions_with_sql_prefilter = candidatesByAction.size;
        metrics.actions_without_prefilter = actionsWithoutPrefilter.length;

        if (actionsWithoutPrefilter.length > 0) {
            // Sub-phase B: only populate candidatesByAction here. Sub-phase C below re-loads
            // the union of all candidate IDs via restrictToIds (which the bulk context loader
            // requires), so building caseById here would be redundant work.
            const allActiveIds = await this.#loadActiveUniverseInto({
                candidatesByAction,
                caseById: undefined,
                actions: actionsWithoutPrefilter,
            });
            for (const id of allActiveIds) allCandidateIds.add(id);
            metrics.fallback_universe_loaded = true;
        }

        // Capture the REAL per-action backlog and deduped distinct BEFORE capping. The cap below
        // trims only what we HYDRATE (to bound heap); it must never shrink the reported backlog.
        const backlogByAction = this.#snapshotBacklog(candidatesByAction);
        metrics.candidates_backlog_prefilter = allCandidateIds.size;

        if (capacityByGroup && trackerByGroup) {
            await this.#capCandidatesByCapacity(actions, candidatesByAction, {
                capacityByGroup,
                trackerByGroup,
                metrics,
            });
            allCandidateIds.clear();
            for (const set of candidatesByAction.values()) {
                for (const id of set) allCandidateIds.add(id);
            }
        }

        metrics.candidates_distinct = allCandidateIds.size;
        if (allCandidateIds.size === 0) {
            return { candidatesByAction, caseById: new Map(), contextMap: new Map(), metrics, backlogByAction };
        }

        // Chunked (not a single WHERE id IN (...)): unlike the capacity-cap and reorder queries
        // below, this load has no ORDER BY/LIMIT to preserve, so splitting it across queries is
        // safe and keeps a large tenant's candidate set from hitting Postgres' bind-parameter cap.
        const candidateCases = await chunkedFanOut([...allCandidateIds], (chunk) =>
            this.caseFindAllActiveService.execute({ 'cases.fecha_resolucion': null }, { restrictToIds: chunk })
        );
        const caseById = new Map(candidateCases.map((c) => [c.id.value, c]));

        const t1 = Date.now();
        const contextMap = await this.caseContextBatchLoader.load(candidateCases);
        metrics.duration_ms.bulk_context = Date.now() - t1;

        return { candidatesByAction, caseById, contextMap, metrics, backlogByAction };
    }

    // Test-only accessor — never call from production code.
    async _prefilterCandidatesForTest(actions, opts) {
        return this.#prefilterCandidates(actions, opts);
    }

    /**
     * Main entry point. For each group-assignment action:
     *
     * 1. Queries group capacity (which includes available users).
     * 2. Resolves the target group based on action type.
     * 3. If the group is `cola_de_trabajo` (present in capacity context):
     *    → Loads candidate cases, validates, and directly assigns to users.
     * 4. If the group is NOT `cola_de_trabajo` (absent from capacity context):
     *    → Loads candidate cases, validates, and directly assigns using
     *      AssignationService or the dynamic group handler.
     *
     * @param {Object} params
     * @param {Array<import('../../../actions/domain/Action.js').Action>} params.actions - CRON_JOB group-assignment actions.
     * @returns {Promise<AssignResult>}
     */
    async assign({ actions }) {
        /** @type {AssignResult} */
        const result = { assigned: 0, skipped: 0, errors: 0 };
        const evaluationNow = dayjs();
        const heapUsedMbBefore = Math.round(process.memoryUsage().heapUsed / 1_048_576);

        const capacityContext = await this.groupsRepository.findWorkQueueGroupsWithCapacity();

        const capacityByGroup = new Map();
        for (const entry of capacityContext) {
            capacityByGroup.set(String(entry.grupo_id), entry);
        }

        const usersByGroup = new Map();
        const trackerByGroup = new Map();
        for (const entry of capacityContext) {
            const key = String(entry.grupo_id);
            if (entry.users && entry.users.length > 0) {
                usersByGroup.set(key, entry.users);
                trackerByGroup.set(key, new CapacityTracker(entry.users));
            }
        }

        const deadActions = await this.#partitionByCapacity(actions, { capacityByGroup, usersByGroup });
        const liveActions = actions.filter((action) => !deadActions.has(action?.id?.value));

        const {
            candidatesByAction,
            caseById,
            contextMap,
            metrics: prefilterMetrics,
            backlogByAction,
        } = await this.#prefilterCandidates(liveActions, { evaluationNow, capacityByGroup, trackerByGroup });

        // #prefilterCandidates receives liveActions, so its actions_total reflects only the
        // prefiltered subset. Restore the full-tick count and record how many actions were
        // short-circuited as dead (no group capacity) so the persisted run record is complete.
        prefilterMetrics.actions_total = actions.length;
        prefilterMetrics.dead_actions = deadActions.size;

        // Real backlog across the tick: live actions contribute their PRE-CAP prefiltered count
        // (candidates_backlog_prefilter, captured before #capCandidatesByCapacity trims what we
        // hydrate); dead actions contribute their snapshot backlog. Null backlogs count as 0: live-side from
        // NO_PREFILTER, dead-side when there is no snapshot yet or the snapshot read failed.
        // Using the pre-cap distinct keeps the "Casos pendientes" figure honest even when the loaded
        // set was capped (candidates_distinct would under-report the real backlog).
        // NOTE: coarse ops signal — the dead-side is a per-action sum, NOT deduped across actions
        // (unlike candidates_distinct), so overlapping dead-action predicates can over-count.
        prefilterMetrics.candidates_backlog_total =
            prefilterMetrics.candidates_backlog_prefilter +
            [...deadActions.values()].reduce(
                (sum, entry) => sum + (typeof entry.backlog === 'number' ? entry.backlog : 0),
                0
            );

        this.runObserver?.recordCapacitySnapshot(capacityContext);
        this.runObserver?.recordPrefilterMetrics(prefilterMetrics);

        Helper.logInfo(
            `AutomatedGroupAssignmentService::assign starting | actions=${actions.length}, ` +
                `cola_de_trabajo_groups=${capacityByGroup.size}, groups_with_users=${usersByGroup.size}, ` +
                `prefiltered_actions=${candidatesByAction.size}, candidates_distinct=${caseById.size}`
        );

        for (const action of actions) {
            const before = { ...result };
            const actionStartedAt = Date.now();
            const dead = deadActions.get(action?.id?.value);
            try {
                if (dead) {
                    this.#skipNoCapacity(action, dead.groupId, result);
                } else {
                    Helper.logTime(
                        `AutomatedGroupAssignmentService::assign::processAction action=${action?.id?.value} ${action.description?.value}`
                    );
                    await this.#processAction({
                        action,
                        capacityByGroup,
                        usersByGroup,
                        contextMap,
                        evaluationNow,
                        candidatesByAction,
                        caseById,
                        result,
                        trackerByGroup,
                    });
                }
            } catch (error) {
                Helper.logError(
                    `AutomatedGroupAssignmentService::assign error processing action ${action?.id?.value}`,
                    error
                );
                result.errors++;
            } finally {
                if (!dead) {
                    Helper.logTimeEnd(
                        `AutomatedGroupAssignmentService::assign::processAction action=${action?.id?.value} ${action.description?.value}`
                    );
                }
                this.runObserver?.recordActionOutcome(action, {
                    // Dead (short-circuited) actions were excluded from the prefilter, so their
                    // candidates count is 0 here by design (not a bug).
                    candidates: candidatesByAction?.get(action?.id?.value)?.size ?? 0,
                    // Dead actions carry the off-tick snapshot; live actions their PRE-CAP prefilter size.
                    candidates_backlog: dead
                        ? dead.backlog
                        : (backlogByAction?.get(action?.id?.value) ??
                          candidatesByAction?.get(action?.id?.value)?.size ??
                          0),
                    backlog_computed_at: dead ? dead.backlogComputedAt : null,
                    assigned: result.assigned - before.assigned,
                    skipped: result.skipped - before.skipped,
                    errors: result.errors - before.errors,
                    duration_ms: Date.now() - actionStartedAt,
                });
            }
        }

        Helper.logInfo('automated-assignment.metrics', { result });
        Helper.logDebug('automated-assignment.metrics.prefilter', { prefilterMetrics, result });
        Helper.logInfo('automated-assignment.metrics.resources', {
            heap_used_mb_before: heapUsedMbBefore,
            heap_used_mb_after: Math.round(process.memoryUsage().heapUsed / 1_048_576),
            candidates_distinct: prefilterMetrics.candidates_distinct,
            // candidates_capped = # of actions that hit the cap (not candidate volume);
            // candidates_dropped = per-action sum of trimmed ids (not deduped) — coarse ops signal only.
            candidates_capped: prefilterMetrics.candidates_capped,
            candidates_dropped: prefilterMetrics.candidates_dropped,
            actions_total: actions.length,
            dead_actions: deadActions.size,
            candidates_backlog_total: prefilterMetrics.candidates_backlog_total,
            groups_with_users: usersByGroup.size,
            duration_ms: prefilterMetrics.duration_ms,
            result,
        });

        return result;
    }

    /**
     * Resolves the target group of each ASIGNAR_GRUPO_POR_CODIGO_EXTERNO action
     * (via the cached resolver) and marks as "dead" those whose group is a
     * work-queue group with no users with capacity — their only possible outcome
     * is a `group_has_no_users_with_capacity` skip. Dead actions are excluded
     * from the prefilter/context load and take their backlog from the off-tick
     * snapshot (never a COUNT in the tick). Other action types and unresolved/
     * non-work-queue groups are left untouched (current behavior).
     *
     * @returns {Promise<Map<string, { groupId: string, backlog: number|null, backlogComputedAt: string|null }>>}
     */
    async #partitionByCapacity(actions, { capacityByGroup, usersByGroup }) {
        const dead = new Map();
        for (const action of actions) {
            if (action?.action_type?.value !== ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value) continue;
            const externalCode = action?.external_group_code?.value;
            if (!externalCode) continue; // let #processExternalCodeAssignment emit action_missing_external_code
            const groupId = await this.externalCodeGroupResolver.resolve(externalCode);
            if (!groupId) continue; // let #processExternalCodeAssignment emit external_group_not_found
            if (capacityByGroup.has(groupId) && !usersByGroup.has(groupId)) {
                dead.set(action.id.value, { groupId, backlog: null, backlogComputedAt: null });
            }
        }
        if (dead.size === 0 || !this.backlogSnapshotsRepository) return dead;

        try {
            const snapshots = await this.backlogSnapshotsRepository.findByActionIds([...dead.keys()]);
            for (const [actionId, entry] of dead) {
                const snapshot = snapshots.get(actionId);
                if (!snapshot) continue;
                entry.backlog = snapshot.backlog;
                entry.backlogComputedAt = snapshot.computed_at;
            }
        } catch (error) {
            // Observability only: a missing snapshot must never block assignment nor fall back to COUNT.
            Helper.logError('AutomatedGroupAssignmentService::partitionByCapacity backlog snapshot read failed', error);
        }
        return dead;
    }

    /**
     * Reduces each action's prefilter candidate Set (ids only) to a top-N ordered
     * subset BEFORE entities + bulk context get hydrated, so the worker heap stays
     * bounded on large backlogs. N derives from the target group's remaining
     * capacity (× CANDIDATE_CAP_SLACK_FACTOR, clamped to [CANDIDATE_MIN_CAP,
     * CANDIDATE_HARD_CAP]); with an unresolvable/non-work-queue group or infinite
     * capacity, only the absolute CANDIDATE_HARD_CAP applies. Replaces each capped
     * action's Set in candidatesByAction and records how much was trimmed in metrics.
     */
    async #capCandidatesByCapacity(actions, candidatesByAction, { capacityByGroup, trackerByGroup, metrics }) {
        for (const action of actions) {
            const set = candidatesByAction.get(action?.id?.value);
            if (!set || set.size === 0) continue;

            let groupId = null;
            if (
                action?.action_type?.value === ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value &&
                action?.external_group_code?.value
            ) {
                groupId = await this.externalCodeGroupResolver.resolve(action.external_group_code.value);
            }

            // Non-external-code types (EN_CURSO / LISTA / DINAMICO) leave groupId null: they have no
            // single resolvable work-queue group here, so they are NOT priority-ordered — only the
            // absolute CANDIDATE_HARD_CAP applies, truncating by cases.id order. This is a deliberate
            // memory safety-net (per the phase-3 design decision), accepted as a coarse cap for these
            // types. Trade-off: on a backlog > CANDIDATE_HARD_CAP a high-priority high-id case can wait
            // behind lower-priority lower-id cases (deterministic FIFO by id, so no starvation —
            // assigned cases leave the active universe and the next tick advances).
            // Follow-up: ASIGNAR_LISTA_ASESORES resolves to a single group and could use that group's
            // work_queue_sorting_rules to restore ordering fidelity.
            let sortingRules = [];
            let cap = CANDIDATE_HARD_CAP;
            if (groupId && capacityByGroup.has(groupId)) {
                sortingRules = capacityByGroup.get(groupId)?.work_queue_sorting_rules || [];
                const tracker = trackerByGroup.get(groupId);
                const remaining = tracker?.totalRemaining?.();
                if (tracker && Number.isFinite(remaining)) {
                    // CANDIDATE_HARD_CAP is the ABSOLUTE ceiling and intentionally wins even if set below
                    // CANDIDATE_MIN_CAP (an operator choosing a very low hard cap deliberately wants
                    // aggressive capping). CANDIDATE_MIN_CAP only floors the capacity-derived value — it
                    // is NOT a floor on a deliberately-low hard cap.
                    cap = Math.min(
                        CANDIDATE_HARD_CAP,
                        Math.max(CANDIDATE_MIN_CAP, Math.ceil(remaining * CANDIDATE_CAP_SLACK_FACTOR))
                    );
                }
            }

            if (set.size <= cap) continue;

            const originalSize = set.size;
            // NOT chunked: this projects the globally top-`cap` ids ordered by work_queue_sorting_rules.
            // Splitting `set` into chunks would order+limit each chunk independently, corrupting
            // both the priority order and the cap (each chunk could contribute up to `cap` ids).
            const topIds = await this.caseFindAllActiveService.executeOrderedIds(
                { 'cases.fecha_resolucion': null },
                { restrictToIds: [...set], work_queue_sorting_rules: sortingRules, limit: cap }
            );
            candidatesByAction.set(action.id.value, new Set(topIds));
            // candidates_capped counts ACTIONS that hit the cap, not candidate volume.
            metrics.candidates_capped = (metrics.candidates_capped ?? 0) + 1;
            // candidates_dropped is a per-action sum (originalSize − topIds.length), NOT deduped:
            // two capped actions sharing candidate IDs double-count. Coarse ops signal only — it
            // feeds the resources LOG, never a user-facing figure; do NOT sum it against the deduped
            // candidates_backlog_prefilter.
            metrics.candidates_dropped = (metrics.candidates_dropped ?? 0) + (originalSize - topIds.length);
        }
    }

    // Test-only accessor — never call from production code.
    async _capCandidatesByCapacityForTest(actions, candidatesByAction, ctx) {
        return this.#capCandidatesByCapacity(actions, candidatesByAction, ctx);
    }

    /**
     * Routes one action to the appropriate handler based on its type.
     */
    async #processAction({
        action,
        capacityByGroup,
        usersByGroup,
        contextMap,
        evaluationNow,
        candidatesByAction,
        caseById,
        result,
        trackerByGroup,
    }) {
        const actionType = action?.action_type?.value;
        const ctx = {
            action,
            capacityByGroup,
            usersByGroup,
            contextMap,
            evaluationNow,
            candidatesByAction,
            caseById,
            result,
            trackerByGroup,
        };

        switch (actionType) {
            case ActionTypes.ASIGNAR_LISTA_ASESORES.value:
                return this.#processListAssignment(ctx);
            case ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value:
                return this.#processExternalCodeAssignment(ctx);
            case ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value:
                return this.#processCurrentGroupAssignment(ctx);
            case ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO_DINAMICO.value:
                return this.#processNonWorkQueueAssignment(ctx);
            default:
                Helper.logDebug(`AutomatedGroupAssignmentService::processAction unknown type ${actionType}, skipping.`);
                result.errors++;
        }
    }

    // Test-only accessor — never call from production code.
    async _processActionForTest(ctx) {
        return this.#processAction(ctx);
    }

    /**
     * ASIGNAR_LISTA_ASESORES — resolve group from advisor list, then assign.
     */
    async #processListAssignment({
        action,
        capacityByGroup,
        usersByGroup,
        contextMap,
        evaluationNow,
        candidatesByAction,
        caseById,
        result,
        trackerByGroup,
    }) {
        if (!action.advisor_list_id?.value) {
            Helper.logError(
                `AutomatedGroupAssignmentService::processListAssignment action ${action?.id?.value} has no advisor_list_id`
            );
            this.runObserver?.recordSkipReason(action?.id?.value, 'action_missing_advisor_list');
            result.errors++;
            return;
        }

        const list = await this.userListsRepository.find(action.advisor_list_id);
        if (!list) {
            Helper.logError(
                `AutomatedGroupAssignmentService::processListAssignment list ${action.advisor_list_id.value} not found`
            );
            this.runObserver?.recordSkipReason(action?.id?.value, 'advisor_list_not_found');
            result.errors++;
            return;
        }

        const groupId = list.group_id?.value;
        if (!groupId) {
            Helper.logError(
                `AutomatedGroupAssignmentService::processListAssignment list ${action.advisor_list_id.value} has no group_id`
            );
            this.runObserver?.recordSkipReason(action?.id?.value, 'advisor_list_has_no_group');
            result.errors++;
            return;
        }

        const listUserIds = new Set((list.lista_usuarios?.value || []).map((u) => String(u.id)));
        const filteredUsersByGroup = new Map();
        const groupUsers = usersByGroup.get(String(groupId));
        if (groupUsers) {
            const filtered = groupUsers.filter((u) => listUserIds.has(String(u.id)));
            if (filtered.length > 0) {
                filteredUsersByGroup.set(String(groupId), filtered);
            }
        }

        await this.#handleGroupAssignment({
            action,
            groupId: String(groupId),
            capacityByGroup,
            usersByGroup: filteredUsersByGroup,
            contextMap,
            evaluationNow,
            candidatesByAction,
            caseById,
            result,
            trackerByGroup,
        });
    }

    /**
     * ASIGNAR_GRUPO_POR_CODIGO_EXTERNO — resolve group from external code, then assign.
     */
    async #processExternalCodeAssignment({
        action,
        capacityByGroup,
        usersByGroup,
        contextMap,
        evaluationNow,
        candidatesByAction,
        caseById,
        result,
        trackerByGroup,
    }) {
        if (!action.external_group_code?.value) {
            Helper.logError(
                `AutomatedGroupAssignmentService::processExternalCodeAssignment action ${action?.id?.value} has no external_group_code`
            );
            this.runObserver?.recordSkipReason(action?.id?.value, 'action_missing_external_code');
            result.errors++;
            return;
        }

        const externalCode = action.external_group_code.value;
        const groupId = await this.externalCodeGroupResolver.resolve(externalCode);
        if (!groupId) {
            Helper.logError(
                `AutomatedGroupAssignmentService::processExternalCodeAssignment no group found for code ${externalCode}`
            );
            this.runObserver?.recordSkipReason(action?.id?.value, 'external_group_not_found');
            result.skipped++;
            return;
        }

        await this.#handleGroupAssignment({
            action,
            groupId,
            capacityByGroup,
            usersByGroup,
            contextMap,
            evaluationNow,
            candidatesByAction,
            caseById,
            result,
            trackerByGroup,
        });
    }

    /**
     * ASIGNAR_GRUPO_EN_CURSO — cases are filtered by their current group.
     * Partitions the prefilter candidates by `grupo_id` in memory and delegates to
     * #assignToGroupUsers per group (no per-group DB call).
     */
    async #processCurrentGroupAssignment({
        action,
        capacityByGroup,
        usersByGroup,
        contextMap,
        evaluationNow,
        candidatesByAction,
        caseById,
        result,
        trackerByGroup,
    }) {
        const candidateIds = candidatesByAction?.get(action.id.value) ?? new Set();
        const candidatesByGroup = new Map();
        for (const caseId of candidateIds) {
            const c = caseById?.get(caseId);
            const gid = c?.grupo_id?.value;
            if (!gid) continue;
            const key = String(gid);
            if (!candidatesByGroup.has(key)) candidatesByGroup.set(key, []);
            candidatesByGroup.get(key).push(c);
        }

        for (const [groupId, users] of usersByGroup.entries()) {
            try {
                const casesOfGroup = candidatesByGroup.get(groupId) ?? [];
                if (casesOfGroup.length === 0) continue;
                await this.#assignToGroupUsers({
                    action,
                    groupId,
                    usersInGroup: users,
                    capacityByGroup,
                    candidatesForGroup: casesOfGroup,
                    contextMap,
                    evaluationNow,
                    result,
                    capacityTracker: trackerByGroup.get(groupId),
                });
            } catch (error) {
                Helper.logError(
                    `AutomatedGroupAssignmentService::processCurrentGroupAssignment error for group ${groupId}`,
                    error
                );
                result.errors++;
            }
        }
    }

    // Test-only accessor — never call from production code.
    async _assignToGroupUsersForTest(args) {
        return this.#assignToGroupUsers(args);
    }

    /**
     * Handles action types that can't be pre-resolved to a cola_de_trabajo group
     * (e.g., dynamic external code, or groups without work-queue config).
     * Loads all active cases, validates, and directly assigns them using:
     * - AssignationService when groupId is known (non-work-queue fallback)
     * - AssignGroupByExternalDynamicCode handler for DINAMICO actions
     *
     * @param {Object} params
     * @param {Object} params.action
     * @param {Object} params.result
     * @param {string} [params.groupId] - Pre-resolved group ID (available from #handleGroupAssignment fallback)
     */
    async #processNonWorkQueueAssignment({
        action,
        result,
        groupId,
        contextMap,
        evaluationNow,
        candidatesByAction,
        caseById,
    }) {
        try {
            const candidateIds = candidatesByAction?.get(action.id.value) ?? new Set();
            Helper.logDebug(
                `AutomatedGroupAssignmentService::processNonWorkQueueAssignment action=${action?.id?.value}, ` +
                    `candidates=${candidateIds.size}, groupId=${groupId || 'dynamic'}`
            );

            for (const caseId of candidateIds) {
                const activeCase = caseById?.get(caseId);
                if (!activeCase) continue;
                try {
                    const isValid = contextMap?.has(caseId)
                        ? await this.caseActionValidator.validateWithContext(
                              activeCase,
                              action,
                              contextMap.get(caseId),
                              { evaluationNow }
                          )
                        : await this.caseActionValidator.validate(activeCase, action);
                    if (isValid) {
                        await this.#executeDirectAssignment({ activeCase, action, groupId, result });
                    }
                } catch (error) {
                    Helper.logError(
                        `AutomatedGroupAssignmentService::processNonWorkQueueAssignment error processing case ${activeCase?.id?.value}`,
                        error
                    );
                    result.errors++;
                }
            }
        } catch (error) {
            Helper.logError(`AutomatedGroupAssignmentService::processNonWorkQueueAssignment critical error`, error);
            result.errors++;
        }
    }

    /**
     * Executes direct assignment for a single valid case in the non-work-queue path.
     * - When groupId is known: uses AssignationService to find a responsible user,
     *   then CaseUserAssignmentService to assign.
     * - When groupId is unknown (DINAMICO): delegates to the dynamic group handler
     *   (AssignGroupByExternalDynamicCode) which resolves group from aux case data.
     */
    async #executeDirectAssignment({ activeCase, action, groupId, result }) {
        if (groupId) {
            const originalValues = activeCase.toJson();
            const responsableId = await this.assignationService.execute(groupId, activeCase?.id?.value);
            if (responsableId) {
                await this.caseUserAssignmentService.execute(
                    activeCase,
                    responsableId,
                    groupId,
                    ValueObjectAssignmentChangeType.AUTOMATIC
                );
                result.assigned++;
                this.runObserver?.recordGroupAssignment(groupId);

                await this.eventLogger.logEvent({
                    success: true,
                    action,
                    caseEntity: activeCase,
                    originalValues,
                });
            } else {
                Helper.logInfo('automated-assignment.no-responsible-assigned', {
                    reason: 'group_has_no_available_users',
                    caseId: activeCase?.id?.value,
                    groupId,
                    actionId: action?.id?.value,
                    actionType: action?.action_type?.value,
                });
                this.runObserver?.recordSkipReason(action?.id?.value, 'group_has_no_available_users');
                result.skipped++;
                await this.eventLogger.logEvent({
                    success: false,
                    action,
                    caseEntity: activeCase,
                    originalValues,
                });
            }
        } else if (this.dynamicGroupAssignmentHandler) {
            const success = await this.dynamicGroupAssignmentHandler.execute(
                activeCase,
                action,
                ActionTriggers.CRON_JOB.value
            );
            if (success) {
                result.assigned++;
            } else {
                result.skipped++;
            }
        } else {
            Helper.logError(
                `AutomatedGroupAssignmentService::executeDirectAssignment no handler available for dynamic assignment, case ${activeCase?.id?.value}`
            );
            result.errors++;
        }
    }

    /**
     * Decision point: routes to cola_de_trabajo (direct user-slot assignment)
     * or non-work-queue (direct assignment via AssignationService).
     */
    async #handleGroupAssignment({
        action,
        groupId,
        capacityByGroup,
        usersByGroup,
        contextMap,
        evaluationNow,
        candidatesByAction,
        caseById,
        result,
        trackerByGroup,
    }) {
        const isWorkQueue = capacityByGroup.has(groupId);

        if (isWorkQueue) {
            const candidateIds = candidatesByAction?.get(action.id.value) ?? new Set();
            const candidatesForGroup = [...candidateIds].map((id) => caseById?.get(id)).filter(Boolean);
            await this.#assignToGroupUsers({
                action,
                groupId,
                usersInGroup: usersByGroup.get(groupId),
                capacityByGroup,
                candidatesForGroup,
                contextMap,
                evaluationNow,
                result,
                capacityTracker: trackerByGroup?.get(groupId),
            });
        } else {
            await this.#processNonWorkQueueAssignment({
                action,
                result,
                groupId,
                contextMap,
                evaluationNow,
                candidatesByAction,
                caseById,
            });
        }
    }

    // Test-only accessor — never call from production code.
    async _handleGroupAssignmentForTest(args) {
        return this.#handleGroupAssignment(args);
    }

    /**
     * Emits the exact side-effects of a "no users with capacity" skip: the
     * structured log, the observer skip reason, and the result increment. Shared
     * by #assignToGroupUsers (target group has empty usersInGroup) and by the
     * capacity short-circuit in assign() (dead action resolved before prefilter).
     */
    #skipNoCapacity(action, groupId, result) {
        Helper.logInfo('automated-assignment.no-responsible-assigned', {
            reason: 'group_has_no_users_with_capacity',
            groupId,
            actionId: action?.id?.value,
        });
        this.runObserver?.recordSkipReason(action?.id?.value, 'group_has_no_users_with_capacity');
        result.skipped++;
    }

    /**
     * For a resolved `groupId` (cola_de_trabajo), receives pre-loaded candidate
     * cases and delegates to the appropriate assignment strategy. The caller
     * supplies `candidatesForGroup`; this method renames it to `candidateCases`
     * before invoking the strategy so the strategy contract stays stable.
     *
     * @param {Object} params
     * @param {import('../../../actions/domain/Action.js').Action} params.action
     * @param {string} params.groupId
     * @param {Array<{ id: string, remaining: number }>} params.usersInGroup
     * @param {Map} params.capacityByGroup
     * @param {Array<Object>} params.candidatesForGroup - Pre-filtered cases for this group.
     * @param {Object} params.result
     */
    async #assignToGroupUsers({
        action,
        groupId,
        usersInGroup,
        capacityByGroup,
        candidatesForGroup,
        contextMap,
        evaluationNow,
        result,
        capacityTracker,
    }) {
        if (!usersInGroup || usersInGroup.length === 0) {
            this.#skipNoCapacity(action, groupId, result);
            return;
        }

        if (!capacityTracker) {
            Helper.logError(
                `AutomatedGroupAssignmentService::assignToGroupUsers missing capacityTracker for group ${groupId}, action ${action?.id?.value} — skipping to prevent crash in strategy`
            );
            result.errors++;
            return;
        }

        const capacityConfig = capacityByGroup.get(groupId);
        const workQueueSortingRules = capacityConfig?.work_queue_sorting_rules || [];
        const usePrioritizedAssignment = capacityConfig?.assignLastResponsibleIgnoreDefault === true;

        let orderedCases = candidatesForGroup || [];
        if (workQueueSortingRules.length > 0 && orderedCases.length > 0) {
            Helper.logTime(`AutomatedGroupAssignmentService::assignToGroupUsers::reorder group=${groupId}`);
            const restrictToIds = orderedCases.map((c) => c.id.value);
            // NOT chunked: re-orders this group's already-capped candidates by
            // work_queue_sorting_rules. Chunking would sort each chunk independently and
            // concatenate, breaking the global order the assignment strategy relies on.
            orderedCases = await this.caseFindAllActiveService.execute(
                { 'cases.fecha_resolucion': null },
                { restrictToIds, work_queue_sorting_rules: workQueueSortingRules }
            );
            Helper.logTimeEnd(`AutomatedGroupAssignmentService::assignToGroupUsers::reorder group=${groupId}`);
        }

        Helper.logDebug(
            `AutomatedGroupAssignmentService::assignToGroupUsers action=${action?.id?.value} group=${groupId}, users=${usersInGroup.length}, candidates=${orderedCases.length}, strategy=${usePrioritizedAssignment ? 'prioritized' : 'userSlot'}`
        );

        const strategy = usePrioritizedAssignment ? this.prioritizedStrategy : this.defaultStrategy;

        await strategy.execute({
            action,
            groupId,
            usersInGroup,
            candidateCases: orderedCases,
            contextMap,
            evaluationNow,
            result,
            capacityTracker,
        });
    }
}
