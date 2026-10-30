import knex from 'knex';
import { TenantContextManager } from '@kace/api-common';
import { ActionTriggers } from '@kace/core/src/shared/domain/enum/ActionTriggersEnum.js';
import { KnexActionRepository } from '@kace/core/src/actions/index.js';
import { FinderByTrigger } from '@kace/core/src/actions/domain/services/FinderByTrigger.js';
import { KnexGroupsRepository } from '@kace/core/src/grupos/index.js';
import { EntityActionExecutionServiceFactory } from '@kace/core/src/actions/infrastructure/EntityActionExecutionServiceFactory.js';
import { KnexAutomationSettingsRepository } from '@kace/core/src/automation-settings/infrastructure/persistence/KnexAutomationSettingsRepository.js';
import { AutomationValidationService } from '@kace/core/src/automation-settings/domain/AutomationValidationService.js';
import { EntityActionValidator } from '@kace/core/src/shared/domain/services/EntityActionValidator.js';
import { EntityCandidateFinder } from '@kace/core/src/actions-queue-executions/domain/services/EntityCandidateFinder.js';
import { GroupsProcessor } from '@kace/core/src/actions-queue-executions/domain/services/GroupsProcessor.js';
import { ActionConditionsToSqlTranslator } from '@kace/core/src/actions/domain/QueryTranslator/ActionConditionsToSqlTranslator.js';
import { createGroupsFieldCatalog } from '@kace/core/src/actions/domain/QueryTranslator/FieldCatalog.js';
import { Helper } from '@kace/core/src/shared/index.js';
import { PoolTelemetry } from '@kace/core/src/shared/infrastructure/persistence/PoolTelemetry.js';

const ZERO = { processed: 0, evaluatedPairs: 0, prefilteredOut: 0, matched: 0, executed: 0, failed: 0 };

export class GroupsActionsJob {
    name = 'GroupsActionsJob';

    /**
     * @param {Tenant} tenant
     * @returns {Promise<{processed:number, evaluatedPairs:number, prefilteredOut:number, matched:number, executed:number, failed:number}>}
     */
    async run(tenant) {
        Helper.logTime('GroupsActionJob.run');
        const knexConfig = TenantContextManager.buildKnexConfig(tenant, { poolMax: 10 });
        const db = knex(knexConfig);
        const endPoolTelemetry = PoolTelemetry.attach(db, { job: 'GroupsActionsJob', tenantId: tenant.id?.value });
        let originalError;

        try {
            const groupsRepository = new KnexGroupsRepository(db);
            const actionRepository = new KnexActionRepository(db);

            const actions = await new FinderByTrigger(actionRepository).execute(ActionTriggers.CRON_JOB.value, {
                entityFilter: 'group',
            });
            if (!actions || actions.length === 0) {
                Helper.logDebug('GroupsActionsJob.end', { tenantId: tenant.id?.value, actionsFound: 0, ...ZERO });
                return { ...ZERO };
            }

            const automationValidation = new AutomationValidationService(new KnexAutomationSettingsRepository(db));
            const dueActions = [];
            for (const action of actions) {
                if (await automationValidation.execute(action.automation_id.value)) {
                    dueActions.push(action);
                }
            }
            if (dueActions.length === 0) {
                Helper.logDebug('GroupsActionsJob.end', {
                    tenantId: tenant.id?.value,
                    actionsFound: actions.length,
                    actionsDue: 0,
                    ...ZERO,
                });
                return { ...ZERO };
            }

            const entitiesActive = await groupsRepository.countActive();
            if (entitiesActive === 0) {
                Helper.logDebug('GroupsActionsJob.end', {
                    tenantId: tenant.id?.value,
                    actionsFound: actions.length,
                    actionsDue: dueActions.length,
                    entitiesActive: 0,
                    ...ZERO,
                });
                return { ...ZERO };
            }

            Helper.logInfo('GroupsActionsJob.start', {
                tenantId: tenant.id?.value,
                actionsFound: actions.length,
                actionsDue: dueActions.length,
                entitiesActive,
            });

            const processor = new GroupsProcessor({
                groupsRepository,
                entityActionValidator: new EntityActionValidator(),
                candidateFinder: new EntityCandidateFinder({
                    entityRepository: groupsRepository,
                    translator: new ActionConditionsToSqlTranslator({ catalog: createGroupsFieldCatalog() }),
                    buildBaseQuery: (conn, t, qualify = (x) => x) =>
                        conn(qualify(t)).select(`${t}.id`).where('status', 1).whereNull('deleted_at'),
                }),
            });

            await processor.processEntitiesWithActions(dueActions);

            const service = EntityActionExecutionServiceFactory.create(groupsRepository);
            const successPairs = processor.getSuccessOperations().map((op) => ({
                entity: op.entity,
                action: op.action,
            }));
            const execCounters = await service.executeMatchedPairs(successPairs);

            const metrics = processor.getMetrics();
            const processed = dueActions.length * entitiesActive;
            const counters = {
                processed,
                evaluatedPairs: metrics.runtime_validations,
                prefilteredOut: processed - metrics.runtime_validations,
                matched: successPairs.length,
                executed: execCounters.executed,
                failed: execCounters.failed + processor.getErrorOperations().length,
            };

            Helper.logInfo('GroupsActionsJob.end', {
                tenantId: tenant.id?.value,
                actionsFound: actions.length,
                actionsDue: dueActions.length,
                entitiesActive,
                ...counters,
            });
            Helper.logDebug('GroupsActionsJob.end.metrics', {
                tenantId: tenant.id?.value,
                prefilterMetrics: metrics,
            });

            return counters;
        } catch (error) {
            originalError = error;
            throw error;
        } finally {
            endPoolTelemetry();
            try {
                await db.destroy();
            } catch (destroyError) {
                Helper.logError('GroupsActionsJob.destroy.failed', {
                    tenantId: tenant.id?.value,
                    err: destroyError?.message,
                    stack: destroyError?.stack,
                    errorName: destroyError?.name,
                    originalErr: originalError?.message,
                });
            }
            Helper.logTimeEnd('GroupsActionJob.run');
        }
    }
}
