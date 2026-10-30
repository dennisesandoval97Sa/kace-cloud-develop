import { SQSClient } from '@aws-sdk/client-sqs';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { RoutingEventBus } from './RoutingEventBus.js';
import { EventBridgeEventBus } from './EventBridgeEventBus.js';
import { buildQueueMapFromTenant } from './eventRoutingConfig.js';

/**
 * Factory that builds a RoutingEventBus from a Tenant aggregate.
 *
 * Drop-in replacement for the previous HybridEventBus construction. Callers
 * upgrade by replacing the SQSEventBus + EventBridgeEventBus + HybridEventBus
 * triplet with a single call to this factory.
 *
 * The tenant must carry:
 *   - aws_sqs_region
 *   - aws_event_bridge_region (optional; defaults to aws_sqs_region)
 *   - aws_event_bridge_event_bus_name
 *   - aws_cases_events_queue_url
 *   - aws_action_jobs_events_queue_url
 *   - aws_automated_actions_events_queue_url
 *   - aws_ws_rest_events_queue_url
 *
 * The EventBridge `source` is always 'kace.core'; extend here if BC-level source isolation is ever needed.
 * @param {import('../../../tenant/domain/Tenant.js').Tenant} tenant
 * @returns {RoutingEventBus}
 * @throws {Error} if any required tenant field is missing
 */
export function buildRoutingEventBusFromTenant(tenant, { SQSClient: SqsClientCtor = SQSClient } = {}) {
    if (!tenant) {
        throw new Error('buildRoutingEventBusFromTenant: tenant is required');
    }

    const sqsRegion = tenant.aws_sqs_region?.value;
    if (!sqsRegion) {
        throw new Error(`buildRoutingEventBusFromTenant: tenant ${tenant.id?.value} missing aws_sqs_region`);
    }

    const ebRegion = tenant.aws_event_bridge_region?.value || sqsRegion;
    const ebBusName = tenant.aws_event_bridge_event_bus_name?.value;
    if (!ebBusName) {
        throw new Error(
            `buildRoutingEventBusFromTenant: tenant ${tenant.id?.value} missing aws_event_bridge_event_bus_name`
        );
    }

    const sqsClient = new SqsClientCtor({ region: sqsRegion, maxAttempts: 5, retryMode: 'adaptive' });
    const eventBridgeClient = new EventBridgeClient({ region: ebRegion });
    const archiveBus = new EventBridgeEventBus({
        eventBridgeClient,
        eventBusName: ebBusName,
        source: 'kace.core',
    });
    const queueMap = buildQueueMapFromTenant(tenant);

    return new RoutingEventBus({ sqsClient, archiveBus, queueMap });
}
