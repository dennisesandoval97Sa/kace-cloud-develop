import knex from 'knex';
import { TenantContextManager } from '@kace/api-common';
import { KnexActionRepository } from '@kace/core/src/actions/index.js';
import { FinderByTrigger } from '@kace/core/src/actions/domain/services/FinderByTrigger.js';
import { ActionsProcessor } from '@kace/core/src/actions-queue-executions/domain/services/ActionsProcessor.js';
import { EntityCandidateFinder } from '@kace/core/src/actions-queue-executions/domain/services/EntityCandidateFinder.js';
import { ActionConditionsToSqlTranslator } from '@kace/core/src/actions/domain/QueryTranslator/ActionConditionsToSqlTranslator.js';
import { createCasesFieldCatalog } from '@kace/core/src/actions/domain/QueryTranslator/FieldCatalog.js';
import { AutomationValidationService } from '@kace/core/src/automation-settings/domain/AutomationValidationService.js';
import { KnexAutomationSettingsRepository } from '@kace/core/src/automation-settings/infrastructure/persistence/KnexAutomationSettingsRepository.js';
import { KnexCaseRepository } from '@kace/core/src/cases/index.js';
import { ActionBacklogSnapshotRefresher } from '@kace/core/src/automated-assignment-runs/application/backlog-snapshots/ActionBacklogSnapshotRefresher.js';
import { KnexAutomatedAssignmentBacklogSnapshotsRepository } from '@kace/core/src/automated-assignment-runs/infrastructure/persistence/KnexAutomatedAssignmentBacklogSnapshotsRepository.js';
import { Helper } from '@kace/core/src/shared/index.js';
import { buildActiveCasesBaseQuery } from './activeCasesBaseQuery.mjs';

export class AutomatedAssignmentBacklogJob {
    name = 'AutomatedAssignmentBacklogJob';

    /**
     * Recounts the backlog of every external-code assignment rule against the replica and stores
     * the last value per rule; the assignment tick only reads it.
     * @param {Tenant} tenant
     * @returns {Promise<{counted: number, skipped: number, failed: number, removed: number}|null>} null in legacy mode
     */
    async run(tenant) {
        if (process.env.AUTOMATED_ASSIGNMENT_SQL_PREFILTER_ENABLED !== 'true') return null;

        Helper.logTime('AutomatedAssignmentBacklogJob.run');
        // preferReplica is required: without it Tenant.buildKnexConfig resolves the writer host.
        const readerConfig = TenantContextManager.buildReaderConfig(tenant, { poolMax: 2, preferReplica: true });
        const readerDb = knex(readerConfig);
        const writerDb = knex(TenantContextManager.buildKnexConfig(tenant, { poolMax: 1 }));

        let originalError;
        try {
            const automationValidation = new AutomationValidationService(
                new KnexAutomationSettingsRepository(readerDb)
            );
            const refresher = new ActionBacklogSnapshotRefresher({
                actionsFinder: new ActionsProcessor(
                    new FinderByTrigger(new KnexActionRepository(readerDb)),
                    automationValidation
                ),
                automationValidation,
                candidateFinder: new EntityCandidateFinder({
                    entityRepository: new KnexCaseRepository(readerDb),
                    translator: new ActionConditionsToSqlTranslator({ catalog: createCasesFieldCatalog() }),
                    buildBaseQuery: buildActiveCasesBaseQuery,
                }),
                snapshotsRepository: new KnexAutomatedAssignmentBacklogSnapshotsRepository(writerDb),
            });
            return await refresher.execute();
        } catch (error) {
            originalError = error;
            throw error;
        } finally {
            const results = await Promise.allSettled([readerDb.destroy(), writerDb.destroy()]);
            for (const result of results) {
                if (result.status === 'rejected') {
                    Helper.logError('AutomatedAssignmentBacklogJob.destroy.failed', {
                        tenantId: tenant.id?.value,
                        err: result.reason?.message,
                        originalErr: originalError?.message,
                    });
                }
            }
            Helper.logTimeEnd('AutomatedAssignmentBacklogJob.run');
        }
    }
}
