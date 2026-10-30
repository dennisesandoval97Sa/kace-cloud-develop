import knex from 'knex';
import { TenantContextManager } from '@kace/api-common';
import { KnexActionRepository } from '@kace/core/src/actions/index.js';
import { ActionQueueExecutionsExecutor } from '@kace/core/src/actions-queue-executions/application/executions/ActionQueueExecutionsExecutor.js';
import { KnexActionsQueueExecutionsRepository } from '@kace/core/src/actions-queue-executions/infrastructure/persistence/KnexActionsQueueExecutionsRepository.js';
import { KnexAutomationSettingsRepository } from '@kace/core/src/automation-settings/infrastructure/persistence/KnexAutomationSettingsRepository.js';
import { KnexBackgroundExecutionRepository } from '@kace/core/src/background-executions/infrastructure/persistence/KnexBackgroundExecutionRepository.js';
import { KnexCaseRepository } from '@kace/core/src/cases/index.js';
import { KnexGroupsRepository } from '@kace/core/src/grupos/index.js';
import { KnexUserListsRepository } from '@kace/core/src/user-lists/infrastructure/persistence/KnexUserListsRepository.js';
import { EventPublisher, Helper } from '@kace/core/src/shared/index.js';
import { buildRoutingEventBusFromTenant } from '@kace/core/src/shared/infrastructure/events/buildRoutingEventBusFromTenant.js';
import { PoolTelemetry } from '@kace/core/src/shared/infrastructure/persistence/PoolTelemetry.js';
import { DbRequestContext } from '@kace/core/src/shared/infrastructure/context/DbRequestContext.js';

export class ActionsQueueJob {
    name = 'ActionsQueueJob';

    #eventPublisher;

    constructor({ eventPublisher = null } = {}) {
        this.#eventPublisher = eventPublisher;
    }

    /**
     * @param {Tenant} tenant
     * @returns {Promise<Object>} The serialized executor response.
     */
    async run(tenant) {
        Helper.logTime('ActionsQueueJob.run');
        // The SQL-prefilter path loads case context via CaseContextBatchLoader, which fans out
        // into several concurrent queries (now bounded by the loader). A pool of 10 — behind RDS
        // Proxy — covers that fan-out without starving the local Knex pool (acquires would
        // otherwise queue locally and time out before reaching the DB). Scoped to this job;
        // other Lambdas/services keep the default poolMax=3.
        const writerConfig = TenantContextManager.buildKnexConfig(tenant, { poolMax: 10 });
        // Reader config targets db_host_reader (replica) when the tenant has one; otherwise it
        // resolves to the writer host and KnexRepository collapses to a single pool (§8.1).
        // preferReplica is implicit here: buildReaderConfig forces role:'reader', and
        // Tenant.buildKnexConfig only switches host when role==='reader' AND a reader host exists.
        const readerConfig = TenantContextManager.buildReaderConfig(tenant, { poolMax: 10 });

        const db = knex(writerConfig);
        const endPoolTelemetry = PoolTelemetry.attach(db, { job: 'ActionsQueueJob', tenantId: tenant.id?.value });
        const eventPublisher = this.#eventPublisher ?? this.#buildEventPublisher(tenant);
        Helper.logDebug('ActionsQueueJob.start', { tenantId: tenant.id?.value });
        let originalError;
        let caseRepository;
        try {
            // Per-job DbRequestContext scope: resets the write flag for each job and gives the
            // case repository's reader path read-after-write protection (read-write-split.md §8.4).
            return await DbRequestContext.runForJob(async () => {
                // Pass config objects (not the Knex instance) to avoid the §8.1 footgun where a
                // prebuilt instance collapses the reader onto the writer. KnexCaseRepository now
                // forwards readerConfig to its base, so this opens a live replica reader pool used
                // by the case-context batch loader's reads; it collapses to the writer only when
                // the tenant has no reader host (§8.1) or after a write in this job's
                // DbRequestContext scope (read-after-write).
                caseRepository = new KnexCaseRepository(writerConfig, readerConfig);
                const executor = new ActionQueueExecutionsExecutor(
                    new KnexActionsQueueExecutionsRepository(db),
                    new KnexActionRepository(db),
                    caseRepository,
                    new KnexBackgroundExecutionRepository(db),
                    new KnexAutomationSettingsRepository(db),
                    new KnexGroupsRepository(db),
                    new KnexUserListsRepository(db),
                    eventPublisher,
                    tenant
                );

                const response = await executor.execute();
                const result = response.toJson();
                const payload = { tenantId: tenant.id?.value, ...result };
                const hasWork = (result.successful ?? 0) + (result.failed ?? 0) + (result.duplicate ?? 0) > 0;
                if (hasWork) {
                    Helper.logInfo('ActionsQueueJob.end', payload);
                } else {
                    Helper.logDebug('ActionsQueueJob.end', payload);
                }
                return result;
            });
        } catch (error) {
            originalError = error;
            throw error;
        } finally {
            endPoolTelemetry();
            try {
                if (caseRepository) await caseRepository.destroyConnection();
            } catch (destroyError) {
                Helper.logError('ActionsQueueJob.caseRepo.destroy.failed', {
                    tenantId: tenant.id?.value,
                    err: destroyError?.message,
                });
            }
            try {
                await db.destroy();
            } catch (destroyError) {
                Helper.logError('ActionsQueueJob.destroy.failed', {
                    tenantId: tenant.id?.value,
                    err: destroyError?.message,
                    stack: destroyError?.stack,
                    errorName: destroyError?.name,
                    originalErr: originalError?.message,
                });
            }
            Helper.logTimeEnd('ActionsQueueJob.run');
        }
    }

    #buildEventPublisher(tenant) {
        try {
            const routingBus = buildRoutingEventBusFromTenant(tenant);
            return new EventPublisher(routingBus);
        } catch (error) {
            Helper.logInfo('ActionsQueueJob.eventPublisher.disabled', {
                tenantId: tenant?.id?.value,
                reason: error.message,
            });
            return null;
        }
    }
}
