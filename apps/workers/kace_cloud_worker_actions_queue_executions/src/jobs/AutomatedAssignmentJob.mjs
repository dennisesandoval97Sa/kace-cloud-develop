import knex from 'knex';
import { TenantContextManager } from '@kace/api-common';
import { KnexActionRepository } from '@kace/core/src/actions/index.js';
import { AutomatedGroupAssignmentExecutor } from '@kace/core/src/actions-queue-executions/application/executions/AutomatedGroupAssignmentExecutor.js';
import { ActionsProcessor } from '@kace/core/src/actions-queue-executions/domain/services/ActionsProcessor.js';
import { AutomatedGroupAssignmentService } from '@kace/core/src/actions-queue-executions/domain/services/AutomatedGroupAssignmentService.js';
import { LegacyAutomatedGroupAssignmentService } from '@kace/core/src/actions-queue-executions/domain/services/LegacyAutomatedGroupAssignmentService.js';
import { EntityCandidateFinder } from '@kace/core/src/actions-queue-executions/domain/services/EntityCandidateFinder.js';
import { CaseContextBatchLoader } from '@kace/core/src/actions-queue-executions/domain/services/CaseContextBatchLoader.js';
import { ActionConditionsToSqlTranslator } from '@kace/core/src/actions/domain/QueryTranslator/ActionConditionsToSqlTranslator.js';
import { createCasesFieldCatalog } from '@kace/core/src/actions/domain/QueryTranslator/FieldCatalog.js';
import { FinderByTrigger } from '@kace/core/src/actions/domain/services/FinderByTrigger.js';
import { AutomationValidationService } from '@kace/core/src/automation-settings/domain/AutomationValidationService.js';
import { KnexAutomationSettingsRepository } from '@kace/core/src/automation-settings/infrastructure/persistence/KnexAutomationSettingsRepository.js';
import { KnexBackgroundExecutionRepository } from '@kace/core/src/background-executions/infrastructure/persistence/KnexBackgroundExecutionRepository.js';
import { KnexCaseRepository } from '@kace/core/src/cases/index.js';
import { KnexGroupsRepository } from '@kace/core/src/grupos/index.js';
import { KnexUserListsRepository } from '@kace/core/src/user-lists/infrastructure/persistence/KnexUserListsRepository.js';
import { KnexUsersRepository } from '@kace/core/src/users/index.js';
import { KnexGlobalConfigurationRepository } from '@kace/core/src/global-config/infrastructure/persistence/KnexGlobalConfigurationRepository.js';
import { KnexClassificationRepository } from '@kace/core/src/classifications/index.js';
import { KnexAuxCasesRepository } from '@kace/core/src/aux_casos/infrastructure/persitance/KnexAuxCasesRepository.js';
import { CaseActionValidator } from '@kace/core/src/shared/domain/services/CaseActionValidator.js';
import { AssignationService } from '@kace/core/src/shared/assignation/AssignationService.js';
import { AssignGroupByExternalDynamicCode } from '@kace/core/src/actions/domain/types/AssignGroupByExternalDynamicCode.js';
import { BackgroundExecutionService } from '@kace/core/src/shared/domain/services/background-execution/BackgroundExecutionService.js';
import { Helper } from '@kace/core/src/shared/index.js';
import { PoolTelemetry } from '@kace/core/src/shared/infrastructure/persistence/PoolTelemetry.js';
import { AssignmentRunObserver } from '@kace/core/src/automated-assignment-runs/domain/services/AssignmentRunObserver.js';
import { KnexAutomatedAssignmentRunsRepository } from '@kace/core/src/automated-assignment-runs/infrastructure/persistence/KnexAutomatedAssignmentRunsRepository.js';

import { KnexAutomatedAssignmentBacklogSnapshotsRepository } from '@kace/core/src/automated-assignment-runs/infrastructure/persistence/KnexAutomatedAssignmentBacklogSnapshotsRepository.js';
import { buildActiveCasesBaseQuery } from './activeCasesBaseQuery.mjs';

const RUN_RETENTION_DAYS = 7;

export class AutomatedAssignmentJob {
    name = 'AutomatedAssignmentJob';

    /**
     * @param {Tenant} tenant
     */
    async run(tenant) {
        Helper.logDebug('AutomatedAssignmentJob.start', { tenantId: tenant.id?.value });
        Helper.logTime('AutomatedAssignmentJob.run');
        // Loads case context via CaseContextBatchLoader, whose bounded fan-out can request several
        // connections at once. A pool of 10 — behind RDS Proxy — keeps that off the default pool
        // of 3 (which would starve and time out locally). Scoped to this job; other Lambdas/
        // services keep the default poolMax=3.
        const knexConfig = TenantContextManager.buildKnexConfig(tenant, { poolMax: 10 });
        const db = knex(knexConfig);
        const endPoolTelemetry = PoolTelemetry.attach(db, {
            job: 'AutomatedAssignmentJob',
            tenantId: tenant.id?.value,
        });

        const runsRepository = new KnexAutomatedAssignmentRunsRepository(db);
        const runObserver = new AssignmentRunObserver(runsRepository);
        runObserver.recordStart();

        let originalError;
        try {
            const actionRepository = new KnexActionRepository(db);
            const automationSettingsRepository = new KnexAutomationSettingsRepository(db);
            const groupsRepository = new KnexGroupsRepository(db);
            const userListsRepository = new KnexUserListsRepository(db);
            const caseRepository = new KnexCaseRepository(db);
            const backgroundExecutionRepository = new KnexBackgroundExecutionRepository(db);
            const userRepository = new KnexUsersRepository(db);
            const globalConfigurationRepository = new KnexGlobalConfigurationRepository(db);
            const classificationRepository = new KnexClassificationRepository(db);
            const auxCaseRepository = new KnexAuxCasesRepository(db);

            const assignationService = new AssignationService(
                groupsRepository,
                globalConfigurationRepository,
                userRepository
            );

            const dynamicGroupAssignmentHandler = new AssignGroupByExternalDynamicCode(
                caseRepository,
                userRepository,
                groupsRepository,
                classificationRepository,
                assignationService,
                auxCaseRepository
            );

            const actionsProcessor = new ActionsProcessor(
                new FinderByTrigger(actionRepository),
                new AutomationValidationService(automationSettingsRepository)
            );

            const useSqlPrefilter = process.env.AUTOMATED_ASSIGNMENT_SQL_PREFILTER_ENABLED === 'true';

            const sharedDeps = {
                groupsRepository,
                userListsRepository,
                caseRepository,
                assignationService,
                dynamicGroupAssignmentHandler,
                runObserver,
            };

            let automatedGroupAssignmentService;
            if (useSqlPrefilter) {
                const caseCandidateFinder = new EntityCandidateFinder({
                    entityRepository: caseRepository,
                    translator: new ActionConditionsToSqlTranslator({ catalog: createCasesFieldCatalog() }),
                    buildBaseQuery: buildActiveCasesBaseQuery,
                });
                const caseContextBatchLoader = new CaseContextBatchLoader(caseRepository);
                automatedGroupAssignmentService = new AutomatedGroupAssignmentService(
                    new CaseActionValidator(actionRepository),
                    {
                        ...sharedDeps,
                        caseCandidateFinder,
                        caseContextBatchLoader,
                        backlogSnapshotsRepository: new KnexAutomatedAssignmentBacklogSnapshotsRepository(db),
                    }
                );
                Helper.logDebug('AutomatedAssignmentJob: SQL prefilter ENABLED');
            } else {
                automatedGroupAssignmentService = new LegacyAutomatedGroupAssignmentService(
                    new CaseActionValidator(actionRepository),
                    sharedDeps
                );
                Helper.logDebug('AutomatedAssignmentJob: SQL prefilter DISABLED (legacy mode)');
            }

            const backgroundExecutionService = new BackgroundExecutionService(backgroundExecutionRepository);

            const executor = new AutomatedGroupAssignmentExecutor(
                actionsProcessor,
                automatedGroupAssignmentService,
                backgroundExecutionService,
                runObserver
            );

            return await executor.execute();
        } catch (error) {
            runObserver.recordError(error);
            originalError = error;
            throw error;
        } finally {
            // Observabilidad best-effort: persist() nunca lanza y la purga captura su propio error;
            // en paralelo para no alargar el teardown si la BD está degradada.
            await Promise.allSettled([
                runObserver.persist(),
                runsRepository.purgeOlderThan(RUN_RETENTION_DAYS).catch((purgeError) => {
                    Helper.logError('AutomatedAssignmentJob.purgeRuns.failed', {
                        tenantId: tenant.id?.value,
                        err: purgeError?.message,
                    });
                }),
            ]);
            endPoolTelemetry();
            try {
                await db.destroy();
            } catch (destroyError) {
                Helper.logError('AutomatedAssignmentJob.destroy.failed', {
                    tenantId: tenant.id?.value,
                    err: destroyError?.message,
                    stack: destroyError?.stack,
                    errorName: destroyError?.name,
                    originalErr: originalError?.message,
                });
            }
            Helper.logTimeEnd('AutomatedAssignmentJob.run');
        }
    }
}
