import knex from 'knex';
import { TenantContextManager } from '@kace/api-common';
import { KnexCaseRepository } from '@kace/core/src/cases/index.js';
import { KnexBackgroundExecutionRepository } from '@kace/core/src/background-executions/infrastructure/persistence/KnexBackgroundExecutionRepository.js';
import { BackgroundExecutionService } from '@kace/core/src/shared/domain/services/background-execution/BackgroundExecutionService.js';
import { AnsBackgroundRunner } from '@kace/core/src/ans/application/calculator/AnsBackgroundRunner.js';
import { Helper } from '@kace/core/src/shared/index.js';
import { PoolTelemetry } from '@kace/core/src/shared/infrastructure/persistence/PoolTelemetry.js';

export class AnsCalculateJob {
    name = 'AnsCalculateJob';

    /**
     * @param {Tenant} tenant
     * @returns {Promise<void>}
     */
    async run(tenant) {
        Helper.logTime('AnsCalculateJob.run');
        // The ANS recalculation streams ~30k cases per tenant via keyset pagination + batch UPDATE.
        // A pool of 10 covers the query+update interleaving without starving other workers — the
        // override is scoped to this job only (TenantContextManager passes `options` to
        // `tenant.buildKnexConfig`), so other Lambdas/services keep the default poolMax=3.
        const knexConfig = TenantContextManager.buildKnexConfig(tenant, { poolMax: 10 });
        const db = knex(knexConfig);
        const endPoolTelemetry = PoolTelemetry.attach(db, { job: 'AnsCalculateJob', tenantId: tenant.id?.value });

        let originalError;
        try {
            const caseRepository = new KnexCaseRepository(db);
            const backgroundExecutionService = new BackgroundExecutionService(
                new KnexBackgroundExecutionRepository(db)
            );

            const runner = new AnsBackgroundRunner({
                caseRepository,
                backgroundExecutionService,
            });

            await runner.execute();
        } catch (error) {
            originalError = error;
            throw error;
        } finally {
            endPoolTelemetry();
            try {
                await db.destroy();
            } catch (destroyError) {
                Helper.logError('AnsCalculateJob.destroy.failed', {
                    tenantId: tenant.id?.value,
                    err: destroyError?.message,
                    stack: destroyError?.stack,
                    errorName: destroyError?.name,
                    originalErr: originalError?.message,
                });
            }
            Helper.logTimeEnd('AnsCalculateJob.run');
        }
    }
}
