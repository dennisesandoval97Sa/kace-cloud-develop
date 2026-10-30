#!/usr/bin/env bash
# Validates that every environment variable USED in the codebase is registered in .env.example.
#
# Scope (repo-wide):
#   - Backend : process.env.NAME across apps/ and packages/
#   - Frontend: import.meta.env.VITE_NAME across apps/kace-saas/
#
# It compares ONLY against the root .env.example (the file the team commits and shares).
# The local .env is personal and intentionally NOT validated here.
#
# Variables that are injected at runtime by AWS/CDK, or are exclusive to tests/perf/infra,
# are skipped via the ALLOWLIST below (prefixes + exact names). Excluding a var only removes
# the OBLIGATION for it to appear in .env.example; it does not forbid it from being there.
#
# Exit code: 0 if every required var is present, 1 if any is missing (so it can gate a git push).
#
# Wired as: `pnpm run validate:env` and the .husky/pre-push hook.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_EXAMPLE="$ROOT_DIR/.env.example"

if ! command -v rg >/dev/null 2>&1; then
    echo "✗ ripgrep (rg) is required but not installed." >&2
    exit 2
fi

if [ ! -f "$ENV_EXAMPLE" ]; then
    echo "✗ .env.example not found at $ENV_EXAMPLE" >&2
    exit 2
fi

# ---------------------------------------------------------------------------
# ALLOWLIST — vars used in code but NOT required in .env.example.
# Keep this list up to date when adding runtime/test-only variables.
# ---------------------------------------------------------------------------

# Prefixes: any var starting with one of these is ignored.
IGNORE_PREFIXES=(
    "PERF_"          # perf/load-test package (kace_cloud_perf)
    "WORKER_"        # ECS worker knobs, injected by the worker CDK stacks
    "CDK_"           # CDK_DEFAULT_ACCOUNT / CDK_DEFAULT_REGION (CDK-provided)
    "DEBUG_TOGGLE_"  # debug-toggle infra ARNs/roles (CDK-provided)
    "SCHEMAS_TEST_"  # schemas-builder test-only host/port
)

# Exact names: injected at runtime by AWS/CDK, or exclusive to tests/infra.
IGNORE_VARS=(
    # --- AWS / CDK / runtime-injected ---
    "AWS_REGION" "AWS_LAMBDA_FUNCTION_NAME" "NODE_ENV" "DB_TARGET" "API_VERSION"
    "TARGET_DYNAMODB_TABLE" "TARGET_DYNAMODB_REGION" "TARGET_LAMBDA_ARN" "USER"
    "JEST_WORKER_ID" "ANALYZE" "AWS_COGNITO_IDTOKEN" "MULTITENANCY_TABLE_NAME"
    "AWS_DYNAMODB_MULTITENANT_TABLE_NAME" "WEB_VITALS_TABLE_NAME"
    "DEBUG_OVERRIDE_PARAMETER_NAME"
    # --- ECS worker / health / cron runtime knobs (no WORKER_ prefix) ---
    "HEALTH_PORT" "HEALTH_STALENESS_SECONDS" "ANS_HEALTH_STALENESS_SECONDS"
    "LOCK_STALENESS_MINUTES" "SHUTDOWN_GRACE_SECONDS"
    # --- test / e2e / dev-runtime only ---
    "TEST_APP_USER" "TEST_APP_PASSWORD" "TEST_TENANT_ID" "TEST_CLIENT_FINGERPRINT"
    "APPS_CLIENT_FINGERPRINT" "CASES_BULK_E2E" "DRY_RUN" "INTEGRATION_TEST_QUEUE_URL"
    # KACE_TEST_TEMPLATE_DB la escribe el globalSetup de @kace/core y la leen los workers
    # de jest: es un traspaso entre procesos, no configuracion. Declararla en .env.example
    # sugeriria que hay que fijarla, y el globalSetup la sobrescribe igualmente.
    # REWRITE_IMPORTS_LOG es una ruta de log opcional de un script de migracion de un solo uso.
    "KACE_TEST_TEMPLATE_DB" "REWRITE_IMPORTS_LOG"
    "TX_TEST_SCHEMA_WORKER" "LOCAL_SERVER_PORT" "PII_MANIFEST_PATH" "SCHEMAS_API_REACHABLE"
    "LEGACY_ENCRYPTION_METHOD" "ALLOW_SCHEMA_RESET" "INTERACTIONS_BULK_E2E" "E2E_BASE_URL" "CI"
    "KACE_DIAGNOSTIC_OUTPUT" "KACE_TEST_RUN_ID"
    # --- infra toggles injected by CDK (not part of a dev .env) ---
    "ENABLE_AUTH" "TENANT_MIDDLEWARE_ENABLED" "TTL_DAYS" "BUCKET"
)

is_ignored() {
    local var="$1"
    local prefix
    for prefix in "${IGNORE_PREFIXES[@]}"; do
        case "$var" in
            "$prefix"*) return 0 ;;
        esac
    done
    local ignored
    for ignored in "${IGNORE_VARS[@]}"; do
        [ "$var" = "$ignored" ] && return 0
    done
    return 1
}

# ---------------------------------------------------------------------------
# 1) Collect env vars used in the codebase
# ---------------------------------------------------------------------------

RG_EXCLUDES=(
    -g '!**/node_modules/**' -g '!**/dist/**' -g '!**/cdk.out/**'
    -g '!**/coverage/**' -g '!**/build/**'
)

BACKEND_VARS=$(rg --no-filename -oP 'process\.env\.\K[A-Z0-9_]+' \
    "$ROOT_DIR/apps" "$ROOT_DIR/packages" "${RG_EXCLUDES[@]}" 2>/dev/null | sort -u || true)

FRONTEND_VARS=$(rg --no-filename -oP 'import\.meta\.env\.\K(VITE_[A-Z0-9_]+)' \
    "$ROOT_DIR/apps/kace-saas" "${RG_EXCLUDES[@]}" 2>/dev/null | sort -u || true)

USED_VARS=$(printf '%s\n%s\n' "$BACKEND_VARS" "$FRONTEND_VARS" | grep -v '^$' | sort -u)

# ---------------------------------------------------------------------------
# 2) Compare against .env.example
# ---------------------------------------------------------------------------

REQUIRED=()
MISSING=()
IGNORED_COUNT=0

for VAR in $USED_VARS; do
    if is_ignored "$VAR"; then
        IGNORED_COUNT=$((IGNORED_COUNT + 1))
        continue
    fi
    REQUIRED+=("$VAR")
    grep -qE "^${VAR}=" "$ENV_EXAMPLE" || MISSING+=("$VAR")
done

# ---------------------------------------------------------------------------
# 3) Report
# ---------------------------------------------------------------------------

TOTAL_USED=$(echo "$USED_VARS" | grep -c '^' || true)

echo "=== Environment Variables Validation ==="
echo ""
echo "Scanned: apps/ + packages/ (process.env) and apps/kace-saas (import.meta.env.VITE_)"
echo "Target : .env.example"
echo ""
echo "Variables used in code:    $TOTAL_USED"
echo "Ignored (allowlist):       $IGNORED_COUNT"
echo "Required in .env.example:  ${#REQUIRED[@]}"
echo ""

if [ ${#MISSING[@]} -eq 0 ]; then
    echo "✓ .env.example: All ${#REQUIRED[@]} required variables present"
    echo ""
    echo "--- OK ---"
    exit 0
fi

echo "✗ .env.example: ${#MISSING[@]} missing variable(s):"
for VAR in "${MISSING[@]}"; do
    echo "    - $VAR"
done
echo ""
echo "Register the variable(s) above in $ENV_EXAMPLE, or add them to the ALLOWLIST"
echo "in this script if they are runtime/test-only and must not live in .env.example."
exit 1
