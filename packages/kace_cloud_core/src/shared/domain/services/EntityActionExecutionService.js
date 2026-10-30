import pLimit from 'p-limit';
import { ActionTriggers } from '../enum/ActionTriggersEnum.js';
import { Helper } from '../../index.js';
import { EntityActionValidator } from './EntityActionValidator.js';
import { FinderByTrigger } from '../../../actions/domain/services/FinderByTrigger.js';

/**
 * Domain service for executing actions on entities (users, groups, etc.)
 * This service is generic and not coupled to case-specific logic.
 */
export class EntityActionExecutionService {
    /** @type {KnexActionRepository} */
    #actionRepository;
    /** @type {EntityActionExecutor} */
    #actionExecutor;
    /** @type {EntityActionValidator} */
    #entityActionValidator;
    /** @type {FinderByTrigger} */
    #finderByTrigger;

    /**
     * @param {KnexActionRepository} actionRepository
     * @param {EntityActionExecutor} actionExecutor
     */
    constructor(actionRepository, actionExecutor) {
        this.#actionRepository = actionRepository;
        this.#actionExecutor = actionExecutor;
        this.#entityActionValidator = new EntityActionValidator();
        this.#finderByTrigger = new FinderByTrigger(actionRepository);
    }

    /**
     * Execute actions for a given trigger and entity
     *
     * @param {string} trigger - The trigger name (e.g., 'create_user', 'update_group')
     * @param {Aggregate} entity - The entity aggregate (User, Group, etc.)
     * @param {Object} content - Additional content for the action execution
     */
    async execute(trigger, entity, content = {}) {
        try {
            const actions = await this.#finderByTrigger.execute(trigger);
            if (!actions) return;

            for (const action of actions) {
                Helper.logInfo(`Entity evaluate conditions for action ${action.description.value}. Executing...`);

                const isValidate = await this.#entityActionValidator.validate(entity, action);

                if (isValidate) {
                    Helper.logInfo(`Entity meets conditions for action ${action.description.value}. Executing...`);
                    await this.#actionExecutor.execute(action, entity, content, trigger);
                    Helper.logDebug(`After executing action on entity ${entity.id.value}`);
                } else {
                    Helper.logInfo(
                        `Entity does not meet conditions for action ${action.description.value}. Skipping...`
                    );
                }
            }
        } catch (error) {
            Helper.logError(`Error executing actions for trigger ${trigger}:`, error);
        }
    }

    /**
     * Evaluate every (entity, action) pair and execute when conditions match.
     * Used by the worker's cron-job pipeline for `user` and `group` entities.
     *
     * Errors are logged and counted; never propagated. The next minute's tick re-evaluates.
     *
     * @note Each entity MUST have a non-null `created_by` or `updated_by`. Otherwise
     *   the underlying `EntityActionExecutor` will return false (counted as `failed`)
     *   because it cannot resolve the current user for permission checks.
     *
     * @param {Action[]} actions   — actions already filtered by trigger=cron_job and entityFilter.
     * @param {Aggregate[]} entities — active, non-deleted entities to evaluate against.
     * @param {{concurrency?: number}} [options]
     * @returns {Promise<{processed:number, matched:number, executed:number, failed:number}>}
     */
    async executeForCron(actions, entities, { concurrency = 50 } = {}) {
        const counters = { processed: 0, matched: 0, executed: 0, failed: 0 };
        if (!actions?.length || !entities?.length) {
            return counters;
        }

        const limit = pLimit(concurrency);
        const pairs = [];
        for (const entity of entities) {
            for (const action of actions) {
                pairs.push({ entity, action });
            }
        }

        const tasks = pairs.map(({ entity, action }) =>
            limit(async () => {
                counters.processed += 1;
                try {
                    const isMatch = await this.#entityActionValidator.validate(entity, action);
                    if (!isMatch) {
                        return;
                    }
                    counters.matched += 1;
                    const ok = await this.#actionExecutor.execute(action, entity, {}, ActionTriggers.CRON_JOB.value);
                    if (ok) {
                        counters.executed += 1;
                    } else {
                        counters.failed += 1;
                    }
                } catch (error) {
                    counters.failed += 1;
                    Helper.logError('EntityActionExecutionService.executeForCron pair failed', {
                        actionId: action?.id?.value,
                        entityId: entity?.id?.value,
                        err: error?.message,
                        stack: error?.stack,
                        errorName: error?.name,
                    });
                }
            })
        );

        await Promise.all(tasks);
        return counters;
    }

    /**
     * Execute pre-matched (entity, action) pairs without re-validating.
     * Used by the cron pipeline after a processor has already filtered to matching pairs.
     *
     * @param {Array<{ entity: Aggregate, action: Action }>} pairs
     * @param {{ concurrency?: number }} [options]
     * @returns {Promise<{processed:number, matched:number, executed:number, failed:number}>}
     */
    async executeMatchedPairs(pairs, { concurrency = 50 } = {}) {
        const counters = { processed: 0, matched: pairs.length, executed: 0, failed: 0 };
        if (!pairs.length) return counters;

        const limit = pLimit(concurrency);
        const tasks = pairs.map(({ entity, action }) =>
            limit(async () => {
                counters.processed += 1;
                try {
                    const ok = await this.#actionExecutor.execute(action, entity, {}, ActionTriggers.CRON_JOB.value);
                    if (ok) counters.executed += 1;
                    else counters.failed += 1;
                } catch (error) {
                    counters.failed += 1;
                    Helper.logError('EntityActionExecutionService.executeMatchedPairs pair failed', {
                        actionId: action?.id?.value,
                        entityId: entity?.id?.value,
                        err: error?.message,
                        stack: error?.stack,
                        errorName: error?.name,
                    });
                }
            })
        );

        await Promise.all(tasks);
        return counters;
    }
}
