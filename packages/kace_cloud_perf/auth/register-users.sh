#!/usr/bin/env bash
# Registra los usuarios de prueba en la base de datos de la app llamando al
# endpoint POST /auth-cognito una vez por usuario. Esto crea el row
# correspondiente en la tabla `usuarios` del tenant — sin esto los endpoints
# reales devuelven 403/404 aunque la auth de Cognito sí funcione.
#
# Idempotente: si el usuario ya está registrado, el endpoint suele devolver
# 200/4xx que el script trata como "ya existente" sin abortar.
#
# Auto-carga ./.env.perf desde la raíz del paquete.
#
# Uso (desde packages/kace_cloud_perf/):
#   bash auth/register-users.sh
#
# Variables requeridas:
#   PERF_API_BASE_URL
#   PERF_TENANT_ID
# Opcionales:
#   PERF_CLIENT_FINGERPRINT (default: 2292838579)
#   PERF_TEST_USERS_FILE    (default: ./auth/test-users.local.json)

set -euo pipefail

ENV_FILE="${ENV_FILE:-$(dirname "$(dirname "$(realpath "$0")")")/.env.perf}"
if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
fi

USERS_FILE="${PERF_TEST_USERS_FILE:-./auth/test-users.local.json}"
FINGERPRINT="${PERF_CLIENT_FINGERPRINT:-2292838579}"

: "${PERF_API_BASE_URL:?PERF_API_BASE_URL not set}"
: "${PERF_TENANT_ID:?PERF_TENANT_ID not set}"

[[ -f "$USERS_FILE" ]] || { echo "User file not found: $USERS_FILE" >&2; exit 1; }
command -v jq   >/dev/null 2>&1 || { echo "jq required (brew install jq / apt install jq)" >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "curl required" >&2; exit 1; }

USER_COUNT=$(jq 'length' "$USERS_FILE")
echo "Registering $USER_COUNT users via POST $PERF_API_BASE_URL/auth-cognito"
echo "  tenant: $PERF_TENANT_ID"
echo "  fingerprint: $FINGERPRINT"
echo ""

REGISTERED=0
ALREADY=0
FAILED=0
RESP_FILE=$(mktemp)
trap 'rm -f "$RESP_FILE"' EXIT

for i in $(seq 0 $((USER_COUNT - 1))); do
    USERNAME=$(jq -r ".[$i].username" "$USERS_FILE")
    PASSWORD=$(jq -r ".[$i].password" "$USERS_FILE")

    # /auth-cognito espera el cognito username (sin @domain). Si el JSON tiene
    # email format, extraemos el local part — si ya viene sin @, queda igual.
    COGNITO_USERNAME="${USERNAME%@*}"

    BODY=$(jq -nc --arg u "$COGNITO_USERNAME" --arg p "$PASSWORD" '{username:$u, password:$p}')

    HTTP_CODE=$(curl -sS -o "$RESP_FILE" -w "%{http_code}" \
        -X POST "$PERF_API_BASE_URL/auth-cognito" \
        -H "x-client-fingerprint: $FINGERPRINT" \
        -H "X-Tenant-Id: $PERF_TENANT_ID" \
        -H "Content-Type: application/json" \
        --data-raw "$BODY" 2>/dev/null) || HTTP_CODE="000"

    case "$HTTP_CODE" in
        2*)
            REGISTERED=$((REGISTERED + 1))
            echo "  [$i] OK ($HTTP_CODE): $COGNITO_USERNAME"
            ;;
        409|400)
            ALREADY=$((ALREADY + 1))
            echo "  [$i] already registered ($HTTP_CODE): $COGNITO_USERNAME"
            ;;
        *)
            FAILED=$((FAILED + 1))
            echo "  [$i] FAILED ($HTTP_CODE): $COGNITO_USERNAME" >&2
            head -c 300 "$RESP_FILE" >&2
            echo "" >&2
            ;;
    esac
done

echo ""
echo "Summary: registered=$REGISTERED, already=$ALREADY, failed=$FAILED, total=$USER_COUNT"

[[ $FAILED -eq 0 ]]
