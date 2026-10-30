#!/usr/bin/env bash
# Disables APPS_DEBUG on every AWS Lambda whose FunctionName starts with the
# APPS_SERVICE_NAME read from a .env file. Preserves all other env vars.
#
# Also turns off the actions-queue-executions ECS worker, which is NOT a Lambda:
# it ignores APPS_DEBUG and reads an SSM parameter on every tick
# (apps/workers/kace_cloud_worker_actions_queue_executions/src/DebugOverride.mjs).
#
# Usage:
#   bash utils/bash/disable-lambda-debug.sh                       # uses .env
#   bash utils/bash/disable-lambda-debug.sh .env.pruebas_staging  # custom env file

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

# Ignore a literal '--' (pnpm forwards it as an argument in v9+).
if [[ "${1:-}" == "--" ]]; then
    shift
fi

ENV_FILE_ARG="${1:-.env}"
ENV_FILE="$ROOT_DIR/$ENV_FILE_ARG"

TMP_DIR="$(mktemp -d -t disable-lambda-debug.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

# ─────────────────────────────────────────────────────────────────────────────
# Pre-flight
# ─────────────────────────────────────────────────────────────────────────────

if ! command -v aws >/dev/null 2>&1; then
    echo "❌ 'aws' CLI no encontrado en el PATH." >&2
    exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
    echo "❌ 'jq' no encontrado en el PATH." >&2
    exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
    echo "❌ Archivo de entorno no encontrado: $ENV_FILE" >&2
    exit 1
fi

# Extract a variable from the env file respecting quotes/whitespace; ignore comments.
read_env_var() {
    grep -E "^[[:space:]]*$1=" "$ENV_FILE" \
        | tail -n 1 \
        | sed -E "s/^[[:space:]]*$1=//" \
        | sed -E 's/^"(.*)"$/\1/' \
        | sed -E "s/^'(.*)'\$/\\1/" \
        | sed -E 's/[[:space:]]+$//' \
        || true
}

APPS_SERVICE_NAME="$(read_env_var APPS_SERVICE_NAME)"

if [[ -z "${APPS_SERVICE_NAME:-}" ]]; then
    echo "❌ APPS_SERVICE_NAME vacío o ausente en $ENV_FILE" >&2
    exit 1
fi

# Same precedence as bin/actions_queue_executions_worker.ts, which synthesizes the
# worker stack from this very .env: WORKER_DEBUG_PARAMETER_NAME wins, else the default.
WORKER_DEBUG_PARAM="$(read_env_var WORKER_DEBUG_PARAMETER_NAME)"
if [[ -z "$WORKER_DEBUG_PARAM" ]]; then
    WORKER_DEBUG_PARAM="/kace/${APPS_SERVICE_NAME}/worker-actions-queue-executions/log-debug"
fi

# Validate AWS credentials
if ! ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text 2>/dev/null)"; then
    echo "❌ No se pudieron resolver credenciales AWS válidas. Revisa AWS_PROFILE/AWS_*." >&2
    exit 1
fi

# Resolve region
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-}}"
if [[ -z "$REGION" ]]; then
    REGION="$(aws configure get region 2>/dev/null || true)"
fi
if [[ -z "$REGION" ]]; then
    echo "❌ Región AWS no resuelta. Exporta AWS_REGION o configura un perfil." >&2
    exit 1
fi

echo "[pre-flight] aws ✓  jq ✓  env file ✓"
echo "[pre-flight] env file:        $ENV_FILE_ARG"
echo "[pre-flight] service prefix:  $APPS_SERVICE_NAME"
echo "[pre-flight] worker SSM param: $WORKER_DEBUG_PARAM"
echo "[pre-flight] AWS account:     $ACCOUNT_ID"
echo "[pre-flight] AWS region:      $REGION"
echo

# ─────────────────────────────────────────────────────────────────────────────
# Discovery
# ─────────────────────────────────────────────────────────────────────────────

echo "[discovery] Listando funciones con prefijo '$APPS_SERVICE_NAME'..."

FUNCTIONS_FILE="$TMP_DIR/functions.txt"
: > "$FUNCTIONS_FILE"

NEXT_MARKER=""
while :; do
    if [[ -n "$NEXT_MARKER" ]]; then
        PAGE_JSON="$(aws lambda list-functions --no-cli-pager --region "$REGION" --starting-token "$NEXT_MARKER")"
    else
        PAGE_JSON="$(aws lambda list-functions --no-cli-pager --region "$REGION")"
    fi

    echo "$PAGE_JSON" \
        | jq -r --arg p "$APPS_SERVICE_NAME" '.Functions[] | select(.FunctionName | startswith($p)) | .FunctionName' \
        >> "$FUNCTIONS_FILE"

    NEXT_MARKER="$(echo "$PAGE_JSON" | jq -r '.NextMarker // empty')"
    [[ -z "$NEXT_MARKER" ]] && break
done

TOTAL_MATCHED="$(wc -l < "$FUNCTIONS_FILE" | tr -d ' ')"
echo "[discovery] Funciones que matchean el prefijo: $TOTAL_MATCHED"

if [[ "$TOTAL_MATCHED" -eq 0 ]]; then
    echo "[discovery] Ninguna lambda comienza con '$APPS_SERVICE_NAME'; solo se evaluará el worker."
fi

# Classify each function
UPDATE_FILE="$TMP_DIR/to-update.txt"
SKIP_FILE="$TMP_DIR/already-off.txt"
NOENV_FILE="$TMP_DIR/no-env.txt"
: > "$UPDATE_FILE"
: > "$SKIP_FILE"
: > "$NOENV_FILE"

printf "\n[plan]\n"
printf "%-80s  %-12s  %s\n" "FunctionName" "APPS_DEBUG" "Acción"
printf '%s\n' "─────────────────────────────────────────────────────────────────────────────────────────────────────────────"

while IFS= read -r FN; do
    [[ -z "$FN" ]] && continue
    CFG="$(aws lambda get-function-configuration --no-cli-pager --region "$REGION" --function-name "$FN" 2>/dev/null || echo '{}')"

    HAS_ENV="$(echo "$CFG" | jq -r 'has("Environment") and (.Environment | has("Variables"))')"
    if [[ "$HAS_ENV" != "true" ]]; then
        printf "%-80s  %-12s  %s\n" "$FN" "<no env>" "skip"
        echo "$FN" >> "$NOENV_FILE"
        continue
    fi

    CURRENT="$(echo "$CFG" | jq -r '.Environment.Variables.APPS_DEBUG // "<missing>"')"
    if [[ "$CURRENT" == "false" ]]; then
        printf "%-80s  %-12s  %s\n" "$FN" "$CURRENT" "skip"
        echo "$FN" >> "$SKIP_FILE"
    else
        printf "%-80s  %-12s  %s\n" "$FN" "$CURRENT" "UPDATE"
        echo "$FN" >> "$UPDATE_FILE"
    fi
done < "$FUNCTIONS_FILE"

TO_UPDATE="$(wc -l < "$UPDATE_FILE" | tr -d ' ')"
ALREADY_OFF="$(wc -l < "$SKIP_FILE" | tr -d ' ')"
NO_ENV="$(wc -l < "$NOENV_FILE" | tr -d ' ')"

# ─────────────────────────────────────────────────────────────────────────────
# Worker (ECS) debug toggle: an SSM parameter, not a Lambda env var.
# ─────────────────────────────────────────────────────────────────────────────

SSM_ERR_FILE="$TMP_DIR/ssm-err.log"
SSM_ACTION="skip"

if SSM_CURRENT="$(aws ssm get-parameter --no-cli-pager --region "$REGION" \
    --name "$WORKER_DEBUG_PARAM" --query Parameter.Value --output text 2>"$SSM_ERR_FILE")"; then
    # DebugOverride.mjs enables debug only for 'true' / '1' / 'on' (lowercased, trimmed);
    # every other value already resolves to OFF, so leave it untouched.
    SSM_NORMALIZED="$(echo "$SSM_CURRENT" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
    case "$SSM_NORMALIZED" in
        true | 1 | on) SSM_ACTION="UPDATE" ;;
        *) SSM_ACTION="skip" ;;
    esac
else
    SSM_ERR="$(tr '\n' ' ' < "$SSM_ERR_FILE")"
    if [[ "$SSM_ERR" == *ParameterNotFound* ]]; then
        # Missing parameter => the worker forces debug OFF. Nothing to do.
        SSM_CURRENT="<no existe>"
        SSM_ACTION="skip"
    else
        SSM_CURRENT="<error>"
        SSM_ACTION="ERROR"
        echo "⚠️  No se pudo leer $WORKER_DEBUG_PARAM: $SSM_ERR" >&2
    fi
fi

printf "\n[plan] worker ECS (SSM parameter)\n"
printf "%-80s  %-12s  %s\n" "ParameterName" "Valor" "Acción"
printf '%s\n' "─────────────────────────────────────────────────────────────────────────────────────────────────────────────"
printf "%-80s  %-12s  %s\n" "$WORKER_DEBUG_PARAM" "$SSM_CURRENT" "$SSM_ACTION"

printf "\nResumen plan:  %d lambdas · %d UPDATE · %d ya en false · %d sin env · worker: %s\n\n" \
    "$TOTAL_MATCHED" "$TO_UPDATE" "$ALREADY_OFF" "$NO_ENV" "$SSM_ACTION"

if [[ "$TO_UPDATE" -eq 0 && "$SSM_ACTION" != "UPDATE" ]]; then
    echo "Nada que actualizar. Saliendo."
    if [[ "$SSM_ACTION" == "ERROR" ]]; then
        exit 1
    fi
    exit 0
fi

# ─────────────────────────────────────────────────────────────────────────────
# Confirmation
# ─────────────────────────────────────────────────────────────────────────────

TARGETS="$TO_UPDATE lambdas"
if [[ "$SSM_ACTION" == "UPDATE" ]]; then
    TARGETS="$TARGETS + el worker (SSM)"
fi

read -r -p "Continuar y aplicar debug=false en $TARGETS? [y/N] " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo "🚫 Operación cancelada."
    exit 0
fi

# ─────────────────────────────────────────────────────────────────────────────
# Update (sequential)
# ─────────────────────────────────────────────────────────────────────────────

UPDATED=0
FAILED=0

while IFS= read -r FN; do
    [[ -z "$FN" ]] && continue

    CFG="$(aws lambda get-function-configuration --no-cli-pager --region "$REGION" --function-name "$FN" 2>/dev/null || true)"
    if [[ -z "$CFG" ]]; then
        echo "[update] $FN ... FAIL: no se pudo leer la configuración"
        FAILED=$((FAILED + 1))
        continue
    fi

    PAYLOAD="$TMP_DIR/payload-$(echo "$FN" | tr -c 'a-zA-Z0-9' '_').json"
    echo "$CFG" \
        | jq '{Variables: ((.Environment.Variables // {}) | .APPS_DEBUG = "false")}' \
        > "$PAYLOAD"

    if aws lambda update-function-configuration \
        --no-cli-pager \
        --region "$REGION" \
        --function-name "$FN" \
        --environment "file://$PAYLOAD" \
        >/dev/null 2>"$TMP_DIR/err.log"; then
        echo "[update] $FN ... OK"
        UPDATED=$((UPDATED + 1))
    else
        ERR="$(tr '\n' ' ' < "$TMP_DIR/err.log")"
        echo "[update] $FN ... FAIL: $ERR"
        FAILED=$((FAILED + 1))
    fi
done < "$UPDATE_FILE"

# The worker re-reads this parameter at the start of every tick, so no redeploy
# or restart is needed; the change takes effect within ~60s.
WORKER_RESULT="skipped"
if [[ "$SSM_ACTION" == "UPDATE" ]]; then
    if aws ssm put-parameter \
        --no-cli-pager \
        --region "$REGION" \
        --name "$WORKER_DEBUG_PARAM" \
        --value "false" \
        --type "String" \
        --overwrite \
        >/dev/null 2>"$SSM_ERR_FILE"; then
        echo "[update] $WORKER_DEBUG_PARAM ... OK (efectivo en ≤60s)"
        WORKER_RESULT="updated"
    else
        ERR="$(tr '\n' ' ' < "$SSM_ERR_FILE")"
        echo "[update] $WORKER_DEBUG_PARAM ... FAIL: $ERR"
        WORKER_RESULT="failed"
        FAILED=$((FAILED + 1))
    fi
elif [[ "$SSM_ACTION" == "ERROR" ]]; then
    WORKER_RESULT="failed"
    FAILED=$((FAILED + 1))
fi

echo
echo "─────────────────────────────────────────────"
printf "Summary:  Updated %d  AlreadyOff %d  Skipped %d  Failed %d\n" \
    "$UPDATED" "$ALREADY_OFF" "$NO_ENV" "$FAILED"
printf "Worker (SSM):  %s\n" "$WORKER_RESULT"
echo "─────────────────────────────────────────────"

if [[ "$FAILED" -gt 0 ]]; then
    exit 1
fi
exit 0
