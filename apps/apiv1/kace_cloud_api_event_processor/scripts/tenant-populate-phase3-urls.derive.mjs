/**
 * Pure derivation of the per-BC SQS FIFO queue URLs from a tenant's legacy
 * single events queue URL. Kept SDK-free so it is trivially unit-testable.
 *
 * Given an existing legacy URL like
 *   https://sqs.us-east-1.amazonaws.com/123/DEVELOPMENT-events-queue.fifo
 * derive the per-BC URLs by replacing the queue name suffix.
 *
 * The derived names MUST exactly match the CDK-created queue names:
 *   `${appsServiceName}-${bcKebab}-events-queue.fifo`
 * where `appsServiceName` is the legacy URL's service prefix (`svc`).
 *
 * @param {string} legacyUrl
 * @returns {{cases: string, case_post_processing: string, action_jobs: string, automated_actions: string, ws_rest: string, reports: string, imports: string}}
 */
export function derivePerBcUrls(legacyUrl) {
    // Match: <base>/<svcPrefix>-events-queue.fifo
    const m = legacyUrl.match(/^(.*)\/([^/]+)-events-queue\.fifo$/);
    if (!m) {
        throw new Error(`Cannot parse legacy queue URL: ${legacyUrl}`);
    }
    const base = m[1]; // https://sqs.us-east-1.amazonaws.com/123
    const svc = m[2]; // DEVELOPMENT
    return {
        cases: `${base}/${svc}-cases-events-queue.fifo`,
        case_post_processing: `${base}/${svc}-case-post-processing-events-queue.fifo`,
        action_jobs: `${base}/${svc}-action-jobs-events-queue.fifo`,
        automated_actions: `${base}/${svc}-automated-actions-events-queue.fifo`,
        ws_rest: `${base}/${svc}-ws-rest-events-queue.fifo`,
        reports: `${base}/${svc}-reports-events-queue.fifo`,
        imports: `${base}/${svc}-imports-events-queue.fifo`,
    };
}
