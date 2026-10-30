import { Helper } from '@kace/core/src/shared/infrastructure/utils/Helper.js';
import { TenantContextManager } from '@kace/api-common/src/middleware/TenantContextManager.js';
import { TenantContext } from '@kace/core/src/shared/infrastructure/context/TenantContext.js';
import { KnexUsersRepository } from '@kace/core/src/users/index.js';
import { normalizeToRecords } from './normalizeRecords.mjs';
import { groupRecordsByTenant } from './groupByTenant.mjs';
import { runWithDeduplication } from './runWithDeduplication.mjs';

const KNEX_POOL_MAX = 5;

/**
 * Factory that builds a Lambda handler bound to a specific bounded-context's
 * event handlers.
 *
 * Pipeline per invocation:
 *   1. Normalize SQS/EventBridge envelopes → records[]
 *   2. Group records by tenant_id
 *   3. For each tenant: load tenant context, build a Knex connection, run
 *      each event through runWithDeduplication
 *   4. Aggregate failures into batchItemFailures and destroy the connection
 *
 * @param {Object} config
 * @param {Map<string, (deps: {userRepository: object}, event: object) => Promise<void>>} config.handlerFactories
 *        eventName → handler factory function
 * @param {string} config.lambdaName - identifier used in logs (e.g. "CasesEventProcessor")
 * @param {(failure: {record: object, domainEvent: object, tenant: object, error: Error}) => Promise<void>} [config.onRecordFailure]
 * @returns {(incomingEvent: object, lambdaContext?: object) => Promise<{batchItemFailures: Array}>}
 */
export function createEventLambdaHandler({ handlerFactories, lambdaName, onRecordFailure = null }) {
    return async function handler(incomingEvent, lambdaContext = {}) {
        const batchItemFailures = [];
        const records = normalizeToRecords(incomingEvent);

        Helper.logDebug(`${lambdaName}: processing batch`, {
            lambdaName,
            recordCount: records.length,
        });

        const recordsByTenant = groupRecordsByTenant(records, batchItemFailures);

        for (const [tenantId, items] of recordsByTenant) {
            let userRepository;
            try {
                const tenant = await TenantContextManager.getTenant(tenantId);
                const knexConfig = TenantContextManager.buildKnexConfig(tenant, { poolMax: KNEX_POOL_MAX });
                const readerConfig = TenantContextManager.buildReaderConfig(tenant, { poolMax: KNEX_POOL_MAX });
                userRepository = new KnexUsersRepository(knexConfig);
                const getRemainingTimeInMillis = () =>
                    lambdaContext.getRemainingTimeInMillis?.() ?? Number.POSITIVE_INFINITY;
                const invocationHandlerFactories = new Map(
                    [...handlerFactories].map(([eventName, eventHandler]) => [
                        eventName,
                        (eventContext, domainEvent) =>
                            eventHandler(
                                {
                                    ...eventContext,
                                    tenant,
                                    writerConfig: knexConfig,
                                    readerConfig,
                                    getRemainingTimeInMillis,
                                },
                                domainEvent
                            ),
                    ])
                );

                await TenantContext.run(tenant, async () => {
                    for (const { record, domainEvent } of items) {
                        const startedAt = process.hrtime.bigint();
                        try {
                            Helper.logDebug(`${lambdaName}: processing event`, {
                                lambdaName,
                                eventName: domainEvent.eventName,
                                eventId: domainEvent.eventId,
                                aggregateId: domainEvent.aggregateId,
                                tenantId,
                            });
                            const { deduped } = await runWithDeduplication(
                                domainEvent,
                                userRepository,
                                invocationHandlerFactories
                            );
                            const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
                            Helper.logMetric('EventProcessor.HandlerLatency', durationMs, 'Milliseconds', {
                                BC: lambdaName,
                                EventName: domainEvent.eventName,
                            });
                            if (deduped) {
                                Helper.logMetric('EventProcessor.DedupHits', 1, 'Count', {
                                    BC: lambdaName,
                                    EventName: domainEvent.eventName,
                                });
                            }
                            Helper.logDebug(`${lambdaName}: event processed`, {
                                lambdaName,
                                eventId: domainEvent.eventId,
                                durationMs,
                                deduped,
                            });
                        } catch (error) {
                            Helper.logMetric('EventProcessor.HandlerErrors', 1, 'Count', {
                                BC: lambdaName,
                                EventName: domainEvent.eventName,
                                ErrorType: error.name || 'Error',
                            });
                            Helper.logError(`${lambdaName}: failed to process record`, {
                                lambdaName,
                                messageId: record.messageId,
                                eventName: domainEvent.eventName,
                                error: error.message,
                                stack: error.stack,
                            });
                            if (onRecordFailure) {
                                try {
                                    await onRecordFailure({ record, domainEvent, tenant, error });
                                } catch (failureHandlingError) {
                                    Helper.logError(`${lambdaName}: failed to handle record failure`, {
                                        lambdaName,
                                        messageId: record.messageId,
                                        eventName: domainEvent.eventName,
                                        error: failureHandlingError.message,
                                    });
                                }
                            }
                            batchItemFailures.push({ itemIdentifier: record.messageId });
                        }
                    }
                });
            } catch (error) {
                Helper.logError(`${lambdaName}: failed to load tenant context`, {
                    lambdaName,
                    tenantId,
                    error: error.message,
                });
                for (const { record } of items) {
                    batchItemFailures.push({ itemIdentifier: record.messageId });
                }
            } finally {
                if (userRepository) {
                    await userRepository.destroyConnection();
                }
            }
        }

        if (batchItemFailures.length > 0) {
            Helper.logError(`${lambdaName}: batch completed with failures`, {
                lambdaName,
                total: records.length,
                failed: batchItemFailures.length,
            });
        } else {
            Helper.logDebug(`${lambdaName}: batch completed`, { lambdaName, total: records.length });
        }

        return { batchItemFailures };
    };
}
