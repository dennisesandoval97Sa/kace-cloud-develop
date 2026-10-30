# @kace/worker-actions-queue-executions

Long-running ECS worker that replaces the Lambda-based `actions-queue-executions` service. Runs an internal cron loop and processes both `ActionQueueExecutionsExecutor` and `AutomatedGroupAssignmentExecutor` per tenant, with bounded concurrency.

## Local development

```bash
pnpm install
pnpm test
pnpm start    # requires .env with TARGET_DYNAMODB_TABLE and AWS credentials
```

## Build & deploy

```bash
pnpm run cdk:synth
pnpm run cdk:deploy -c instanceType=t3.medium
```

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `WORKER_CONCURRENCY` | `5` | Tenants procesados en paralelo por tick |
| `WORKER_MODE` | `fast` | Qué schedulers corre este proceso: `fast` (jobs por minuto), `ans` (`AnsCalculateJob` y `AutomatedAssignmentBacklogJob`), o `all` (todos, local/dev). El stack despliega **dos** servicios desde la misma imagen (`fast` y `ans`). Aislar ANS evita que su recalc síncrona congele el event loop del worker `fast` (y su `/health`). |
| `SHUTDOWN_GRACE_SECONDS` | `1800` | Drain timeout en SIGTERM |
| `LOCK_STALENESS_MINUTES` | `30` | Umbral para considerar un lock stale |
| `HEALTH_PORT` | `8080` | Puerto del health endpoint (`fast` usa 8080, `ans` usa 8081) |
| `HEALTH_STALENESS_SECONDS` | `300` | Umbral del `/health` (worker_thread) para reportar `stale`. El servicio `ans` usa `1800` para no matarse durante una recalc larga. |
| `TARGET_DYNAMODB_TABLE` | — | Tabla DynamoDB de tenants (obligatoria) |
| `TARGET_DYNAMODB_REGION` | `us-east-1` | Región de DynamoDB |
| `AWS_REGION` | inherits `TARGET_DYNAMODB_REGION` | Región para clientes AWS (SSM) |
| `DEBUG_OVERRIDE_PARAMETER_NAME` | `''` | Nombre del SSM Parameter para toggle DEBUG. Si está vacío, debug queda OFF forzado. |
| `WORKER_DEBUG_PARAMETER_NAME` | `/kace/${APPS_SERVICE_NAME}/worker-actions-queue-executions/log-debug` | (CDK only) override del default usado al sintetizar el stack |

## Schedules por tenant

Los crons no son variables de entorno: viven en el registro del tenant (DynamoDB). Cada scheduler
hace tick cada minuto y corre un job para un tenant solo cuando el cron de ese tenant se disparó
desde la evaluación anterior. Sin valor se usa el default; un valor inválido salta ese tenant y
registra un error (`worker.schedule.invalid`, con el job en `job`).
Si el runner está ocupado, el disparo queda pendiente y corre al liberarse; un reinicio del contenedor
sí pierde los disparos de ese lapso (la ventana vive en memoria). Los crons deben tener 5 campos y
se evalúan en la zona horaria del contenedor (UTC).

| Campo del tenant | Default | Jobs |
|---|---|---|
| `apps_worker_fast_cron_expression` | `* * * * *` | actions queue, automated assignment, users/groups actions |
| `apps_worker_ans_cron_expression` | `*/5 * * * *` | `AnsCalculateJob` |
| `apps_assignment_backlog_cron_expression` | `2-59/5 * * * *` | `AutomatedAssignmentBacklogJob` |

## Toggle debug verbose (SSM, sin redeploy)

El worker ignora `tenant.apps_debug` de DynamoDB y consulta un parámetro SSM al inicio de cada tick (≤60s de latencia para que el cambio surta efecto).

Por defecto **debug está OFF**. Para activarlo en producción sin redeploy:

```bash
# Ruta del parámetro (sustituye DEVELOPMENT por el APPS_SERVICE_NAME del ambiente):
PARAM=/kace/DEVELOPMENT/worker-actions-queue-executions/log-debug

# Crear el parámetro (una sola vez por ambiente):
aws ssm put-parameter --name "$PARAM" --value "false" --type "String"
aws ssm put-parameter --name "/kace/DEVELOPMENT/worker-actions-queue-executions/log-debug" --value "true" --overwrite --type "String"

# Activar:
aws ssm put-parameter --name "$PARAM" --value "true" --overwrite --type "String"

# Apagar:
aws ssm put-parameter --name "$PARAM" --value "false" --overwrite --type "String"

# Ver estado actual:
aws ssm get-parameter --name "$PARAM" --query Parameter.Value --output text
```

Para apagarlo junto con el de todas las lambdas del ambiente, `pnpm run disable-lambda-debug`
(raíz del monorepo) resuelve este mismo parámetro desde el `.env` y lo pone en `false`.

**Notas:**
- Si el parámetro no existe → debug OFF (default).
- Si SSM no es alcanzable o falta IAM → debug OFF + log de error en CloudWatch (una vez).
- El override aplica a **todos los tenants** procesados por este worker.
- Costo SSM: ~$0.22/mes (1 read/min × 30 días, standard tier).

## Enabling AnsCalculateJob in production

The job is implemented and tested but currently commented out in `src/index.mjs`
(within the `ansJobs` array). It runs on its own scheduler (`ansScheduler`)
driven by the tenant's `apps_worker_ans_cron_expression` (default `*/5 * * * *`), independent
from the fast jobs (`apps_worker_fast_cron_expression`, default `* * * * *`).

To enable:

1. Verify the partial index `idx_cases_id_unresolved` exists in the target database
   (`SELECT indexname FROM pg_indexes WHERE indexname = 'idx_cases_id_unresolved';`).
2. Deploy with the line commented (no behavior change).
3. Run a smoke check against a staging tenant of comparable size (~30k unresolved
   cases). Expected single-tenant duration: ≤ 60 s p95.
4. Uncomment `new AnsCalculateJob()` inside the `ansJobs` array in `src/index.mjs`.
5. Deploy. Monitor CloudWatch Logs for the per-chunk debug entries from
   `CalculateService` (`CalcService-<type>-Chunk-N` and `CalcService-<type>-BulkUpdate-N`)
   and the `AnsBackgroundRunner` start/end markers.
6. If p95 > 60 s for any tenant, tune `CHUNK_SIZE` in `CalculateService.execute()`,
   raise `poolMax` in `AnsCalculateJob.mjs`, or loosen the tenant's `apps_worker_ans_cron_expression`
   (e.g. `*/10 * * * *`). Tuning it does **not** affect the
   cadence of the other jobs.

### Manual benchmark (gating rollout)

Before enabling in production, benchmark against a tenant with ~30,000 unresolved
cases (use a staging snapshot or seed via the regression test fixtures).

From `packages/kace_cloud_core`, the regression test at
`tests/ans/CalculateService.regression.test.js` exercises the full chunked path
with a smaller (300-case) seed in ~6 seconds. Scale the seed up locally (edit
`for (let i = 0; i < 100; i++)` → `< 10000`) to estimate runtime against the
production target.

Acceptance: total ≤ 120 s on dev hardware (the production target is ≤ 60 s p95 on
ECS hardware which is faster than a developer laptop).
