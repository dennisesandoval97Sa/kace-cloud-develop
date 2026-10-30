/**
 * Build the event-name → SQS queue URL map from a Tenant aggregate.
 *
 * The Tenant carries per-BC queue URLs as ValueObject fields. Adding a new
 * domain event requires:
 *   1. Adding the entry to the map below
 *   2. Adding the corresponding ValueObject field to Tenant.js
 *   3. Updating the Tenant DynamoDB schema + population script for existing tenants
 *   4. Creating the SQS queue in EventProcessorStack
 *
 * @param {import('../../../tenant/domain/Tenant.js').Tenant} tenant
 * @returns {Record<string, string>} eventName → queueUrl
 * @throws {Error} if any required field is missing on the tenant (fail-fast)
 */
export function buildQueueMapFromTenant(tenant) {
    const map = {
        'kace.core.case.created': tenant.aws_cases_events_queue_url?.value,
        'kace.core.case.updated': tenant.aws_cases_events_queue_url?.value,
        'kace.core.action_job.created': tenant.aws_action_jobs_events_queue_url?.value,
        'kace.core.automated_actions.requested': tenant.aws_automated_actions_events_queue_url?.value,
        'kace.core.ws_rest_flow_execution.requested': tenant.aws_ws_rest_events_queue_url?.value,
        'kace.core.channel_hub_workspace_priority_reorder.requested': tenant.aws_ws_rest_events_queue_url?.value,
        'kace.core.report_execution.requested': tenant.aws_reports_events_queue_url?.value,
    };
    const ATTR_BY_EVENT = {
        'kace.core.case.created': 'aws_cases_events_queue_url',
        'kace.core.case.updated': 'aws_cases_events_queue_url',
        'kace.core.action_job.created': 'aws_action_jobs_events_queue_url',
        'kace.core.automated_actions.requested': 'aws_automated_actions_events_queue_url',
        'kace.core.ws_rest_flow_execution.requested': 'aws_ws_rest_events_queue_url',
        'kace.core.channel_hub_workspace_priority_reorder.requested': 'aws_ws_rest_events_queue_url',
        'kace.core.report_execution.requested': 'aws_reports_events_queue_url',
    };
    const tenantId = tenant.id?.value ?? 'unknown';
    for (const [eventName, url] of Object.entries(map)) {
        if (!url) {
            throw new Error(
                `eventRoutingConfig: tenant ${tenantId} is missing ${ATTR_BY_EVENT[eventName]} for event ${eventName}`
            );
        }
    }
    // Tolerant (optional) routing: the post-processing queue URL is backfilled
    // operationally after deploy, so a tenant that lacks it must NOT make this
    // builder throw (that would break publishing of every other event, e.g.
    // case.created). We only add the entry when the URL is present; if it is
    // absent the event is simply omitted from the map and any attempt to publish
    // it will fail clearly, while all strictly-validated events keep working.
    const postProcessingUrl = tenant.aws_case_post_processing_queue_url?.value;
    if (postProcessingUrl) {
        map['kace.core.case.post_processing.requested'] = postProcessingUrl;
    }
    const importsUrl = tenant.aws_imports_events_queue_url?.value;
    if (importsUrl) {
        map['kace.core.import_execution.requested'] = importsUrl;
    }
    return map;
}
