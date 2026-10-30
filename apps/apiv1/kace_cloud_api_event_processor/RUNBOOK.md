# Event Processor — Phase 3 Cutover Runbook

Spec: `docs/superpowers/specs/2026-05-25-event-processor-phase3-design.md`
Plan: `docs/superpowers/plans/2026-05-25-event-processor-phase3.md`

## Prerequisite: cutover scripts' AWS SDK dependencies

The cutover scripts (`tenant-populate-phase3-urls.mjs`, `preflight-check.mjs`, `smoke-test.mjs`) import AWS SDK v3 client packages (`@aws-sdk/client-dynamodb`, `-lambda`, `-sqs`, `-cloudformation`, `-cloudwatch`). These are NOT direct dependencies of this app's `package.json` — they currently resolve via pnpm hoisting from transitive deps (aws-cdk-lib, @kace/api-common, @kace/core). Before running the scripts, verify they resolve: a quick `node --check scripts/<name>.mjs` then a dry invocation. If you hit `ERR_MODULE_NOT_FOUND`, install the missing client(s) into a context where the scripts run (e.g. `pnpm add -D @aws-sdk/client-cloudformation @aws-sdk/client-cloudwatch` in this app) before the cutover window.

## Producers map (as of cutover)

| Event | Producer file (domain) | Producer runtime / stack |
|---|---|---|
| `kace.core.case.created` | `packages/kace_cloud_core/src/cases/application/create/CaseCreator.js` | Apiv1 Lambda(s) via BaseController — primary stack: `kace_cloud_api_cases` (controller.mjs) |
| `kace.core.case.updated` | `packages/kace_cloud_core/src/cases/application/update/CaseUpdater.js` and `packages/kace_cloud_core/src/cases/application/transitions-updater/CaseTransitionsUpdater.js` | Apiv1 Lambda(s) via BaseController — stacks: `kace_cloud_api_cases` (controller.mjs + caseTransitionController.mjs), `kace_cloud_api_case_reclassify` (controller.mjs) |
| `kace.core.action_job.created` | `packages/kace_cloud_core/src/action-jobs/application/create/ActionJobCreator.js` | Apiv1 Lambda `kace_cloud_api_action_batch_executions` (src/controller.mjs) — sole apiv1 stack that wires `ActionJobCreator` |
| `kace.core.automated_actions.requested` | `packages/kace_cloud_core/src/actions-queue-executions/application/executions/ActionQueueExecutionsExecutor.js` | Worker ECS `kace_cloud_worker_actions_queue_executions` (`apps/workers/kace_cloud_worker_actions_queue_executions/src/jobs/ActionsQueueJob.mjs`) |
| `kace.core.ws_rest_flow_execution.requested` | `packages/kace_cloud_core/src/ws-rest-flow-executions/domain/events/WSRestFlowExecutionRequested.js` (instantiated directly in controller) | Apiv1 Lambda `kace_cloud_api_ws_hook_rest_flow` (`apps/apiv1/kace_cloud_api_ws_hook_rest_flow/src/controller.mjs`) |

> Notes: all apiv1 producers share `BaseController.#buildEventPublisher`; a single change there affects all apiv1 producers simultaneously. The worker has its own `#buildEventPublisher` in `ActionsQueueJob.mjs`.

## Pre-cutover (T-2 days, no downtime)

1. **Notify the team** of the planned window (~10-15 min of paused events).
2. **Deploy the new EventProcessorStack** (creates the 4 queues + Lambdas + dashboard; routes nothing yet). `cd apps/apiv1/kace_cloud_api_event_processor && pnpm run cdk:deploy`.
   > Note on the WS-REST queue: its `ContentBasedDeduplication` flips from `true` (Phase 2, EventBridge->SQS could not supply a dedup id) to `false` (Phase 3, RoutingEventBus sets `MessageDeduplicationId=eventId`). `ContentBasedDeduplication` is a **mutable** SQS attribute — CloudFormation updates it in place via SetQueueAttributes; the queue is NOT replaced and its logical ID + name are preserved. No drain needed for the WS-REST queue.
3. **Populate the Tenant DynamoDB** with the 4 new per-BC queue URLs:
   ```bash
   cd apps/apiv1/kace_cloud_api_event_processor
   DRY_RUN=true MULTITENANCY_TABLE_NAME=<table> AWS_REGION=<region> node scripts/tenant-populate-phase3-urls.mjs   # validate
   MULTITENANCY_TABLE_NAME=<table> AWS_REGION=<region> node scripts/tenant-populate-phase3-urls.mjs                # apply
   ```
4. **Verify every tenant has the 4 new attributes**:
   ```bash
   aws dynamodb scan --table-name <table> --projection-expression \
     "id, aws_cases_events_queue_url, aws_action_jobs_events_queue_url, aws_automated_actions_events_queue_url, aws_ws_rest_events_queue_url" \
     --output json | jq '.Items[] | select(.aws_cases_events_queue_url == null)'
   ```
   Expected: empty (all tenants have the fields). A tenant missing these will cause its producers to throw at `#buildEventPublisher` after cutover (fail-fast) — fix before proceeding.
5. **Run preflight checks**: `node scripts/preflight-check.mjs` — resolve any FAIL before continuing.

## Cutover procedure (planned window)

### FASE 1 — Pause publishing (~30s)

> ⚠️ The code-level `EVENTS_PUBLISHING_ENABLED` feature flag was **removed** in the post-Phase-3 cleanup, so there is no longer a publish-only pause inside `EventPublisher`. Use ONE of the two flag-free approaches below to keep producers from writing to the old `{svc}-events-queue.fifo` while it drains (FASE 2) and is recreated (FASE 3).

**Option 1 — hard pause (recommended for a planned window).** Set reserved concurrency to 0 on each producer Lambda (and scale the worker service to 0). This stops the functions entirely. Trade-off: it also pauses those API endpoints for the window (heavier than the old publish-only flag).
```bash
# Each producer Lambda (see Producers map):
aws lambda put-function-concurrency --function-name <fn> --reserved-concurrent-executions 0
# Worker (ECS): scale to 0 tasks
aws ecs update-service --cluster <cluster> --service <worker-svc> --desired-count 0
```
Restore in FASE 5.

**Option 2 — no pause.** Skip pausing; accept that events published during the window may not reach SQS, and recover them afterward via EventBridge Archive replay (see Rollback / post-cutover). Lower friction, but requires a replay pass and the drain in FASE 2 may not reach 0 while producers keep writing.

### FASE 2 — Drain the renamed queue (~1-3 min)

> Only `{svc}-events-queue.fifo` is renamed (-> `{svc}-cases-events-queue.fifo`, delete+create). The WS-REST queue is preserved.
```bash
SVC=DEVELOPMENT
QUEUE_URL=$(aws sqs get-queue-url --queue-name ${SVC}-events-queue.fifo --query QueueUrl --output text)
while true; do
    OUT=$(aws sqs get-queue-attributes --queue-url $QUEUE_URL \
      --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible \
      --query 'Attributes' --output json)
    VIS=$(echo $OUT | jq -r '.ApproximateNumberOfMessages'); INVIS=$(echo $OUT | jq -r '.ApproximateNumberOfMessagesNotVisible')
    echo "visible=$VIS invisible=$INVIS"
    [ "$VIS" = "0" ] && [ "$INVIS" = "0" ] && break
    sleep 10
done
echo "Queue drained."
```

### FASE 3 — Deploy the EventProcessorStack (~5-8 min)

```bash
cd apps/apiv1/kace_cloud_api_event_processor && pnpm run cdk:deploy
```
Validate: 4 `*-cases/*-action-jobs/*-automated-actions/*-ws-rest` Lambdas Active; 4 FIFO queues MessageCount=0; 4 DLQs empty; DLQ alarms OK.

### FASE 4 — Deploy producers (apiv1 + worker, ~5-10 min)

The bus change lives in `BaseController` + `ScheduleEventController` (`@kace/api-common`) + the worker, so all apiv1 stacks inheriting BaseController must re-bundle.
```bash
pnpm deploy   # global; or filter to the producer stacks in the map
pnpm --filter @kace/worker-actions-queue-executions run cdk:deploy   # worker (ECS)
```

### FASE 5 — Resume publishing (~30s)

Reverse whatever pause you applied in FASE 1:
- **Option 1:** restore reserved concurrency on each producer (`aws lambda put-function-concurrency --function-name <fn> --reserved-concurrent-executions <N>`, or `aws lambda delete-function-concurrency` to go unreserved) and scale the worker service back up (`aws ecs update-service ... --desired-count <N>`).
- **Option 2:** nothing to resume; if events were dropped during the window, run an EventBridge Archive replay for that time range (see Rollback).

### FASE 6 — Verify (~5 min)

```bash
cd apps/apiv1/kace_cloud_api_event_processor && node scripts/smoke-test.mjs
```
Functional check: create a test case -> confirm the `*-cases` Lambda invoked, a row in `event_deduplication` for that event, and automated actions ran.

## Rollback

- **FASE 3 fail:** CloudFormation auto-rolls-back; resume publishing on old code; investigate.
- **FASE 4 fail (one producer):** redeploy that producer to the previous commit. **All fail:** redeploy EventProcessorStack + producers to previous commit (~10 min).
- **Post-FASE 6 bug, 1 BC:** SQS retries -> DLQ after 3; other BCs unaffected; fix-forward. **Systemic:** pause publishing globally, drain the 4 queues, rollback CDK.
- **Lost events:** replay from EventBridge Archive (90 days) or re-drive from DLQ.

## Post-cutover (T+1 to T+7 days)

- Monitor DLQ alarms + the KaceEventProcessor dashboard daily.
- Validate spec §8 success criteria.
- At T+7: run the cleanup (remove HybridEventBus, monolithic handler, legacy ARN, feature flag) — see plan Task 22.
