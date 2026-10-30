#!/usr/bin/env bash
# Bootstrap test users in the perf Cognito User Pool with permanent passwords.
#
# Si ./auth/test-users.local.json no existe, está vacío o es JSON inválido,
# lo genera con N usuarios sintéticos antes de provisionarlos en Cognito.
# Idempotente: si un usuario ya existe en Cognito, solo le resetea el password.
#
# Requiere:
#   - aws-cli v2 con creds que tengan:
#       cognito-idp:AdminCreateUser
#       cognito-idp:AdminSetUserPassword
#   - jq, openssl
#   - .env.perf cargado:
#       PERF_COGNITO_USER_POOL_ID
#       PERF_COGNITO_REGION
#
# Uso (desde packages/kace_cloud_perf/):
#   bash auth/bootstrap-users.sh                      # genera 10 si no hay JSON
#   bash auth/bootstrap-users.sh --count 20           # 20 usuarios
#   bash auth/bootstrap-users.sh --regenerate         # fuerza regenerar JSON
#   bash auth/bootstrap-users.sh --email-domain perf.kace.example.com
#
# Carga automáticamente ./.env.perf si existe (con auto-export). Para usar otro
# archivo: ENV_FILE=/path/to/env bash auth/bootstrap-users.sh
# Para saltar el auto-source: ENV_FILE=/dev/null bash auth/bootstrap-users.sh
#
# NOTA: este script solo provisiona la cuenta en Cognito. Si el API requiere
# un row correspondiente en la tabla postgres `users`, ese es un seed aparte.

set -euo pipefail

# Auto-source .env.perf (con auto-export) buscándolo desde la raíz del paquete
ENV_FILE="${ENV_FILE:-$(dirname "$(dirname "$(realpath "$0")")")/.env.perf}"
if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
fi

USERS_FILE="./auth/test-users.local.json"
COUNT=10
EMAIL_PREFIX="perftest"
EMAIL_DOMAIN="kace-cloudperf.local"
REGENERATE=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --count)         COUNT="$2"; shift 2 ;;
        --email-prefix)  EMAIL_PREFIX="$2"; shift 2 ;;
        --email-domain)  EMAIL_DOMAIN="$2"; shift 2 ;;
        --users-file)    USERS_FILE="$2"; shift 2 ;;
        --regenerate)    REGENERATE=true; shift ;;
        -h|--help)
            cat <<EOF
Usage: $0 [options]
  --count N             Cuántos usuarios generar (default: 10)
  --email-prefix STR    Prefijo del email (default: perftest)
  --email-domain DOM    Dominio del email (default: kace-cloudperf.local)
  --users-file PATH     Ruta del JSON (default: ./auth/test-users.local.json)
  --regenerate          Forzar regenerar el JSON aunque exista
  -h, --help            Esta ayuda
EOF
            exit 0
            ;;
        *) echo "Unknown arg: $1" >&2; exit 1 ;;
    esac
done

: "${PERF_COGNITO_USER_POOL_ID:?PERF_COGNITO_USER_POOL_ID not set}"
: "${PERF_COGNITO_REGION:?PERF_COGNITO_REGION not set}"

command -v jq      >/dev/null 2>&1 || { echo "jq required (brew install jq / apt install jq)"   >&2; exit 1; }
command -v aws     >/dev/null 2>&1 || { echo "aws-cli required (https://aws.amazon.com/cli/)"   >&2; exit 1; }
command -v openssl >/dev/null 2>&1 || { echo "openssl required"                                 >&2; exit 1; }

# ------------------------------------------------------------------
# 1) Generar test-users.local.json si hace falta
# ------------------------------------------------------------------
NEEDS_GEN=false
if [[ "$REGENERATE" == "true" ]]; then
    NEEDS_GEN=true
elif [[ ! -s "$USERS_FILE" ]]; then
    NEEDS_GEN=true
elif ! jq empty "$USERS_FILE" >/dev/null 2>&1; then
    echo "Existing $USERS_FILE is invalid JSON; regenerating." >&2
    NEEDS_GEN=true
fi

if [[ "$NEEDS_GEN" == "true" ]]; then
    echo "Generating $USERS_FILE with $COUNT users (prefix=$EMAIL_PREFIX, domain=$EMAIL_DOMAIN)..."
    mkdir -p "$(dirname "$USERS_FILE")"
    USERS_JSON="[]"
    for i in $(seq 1 "$COUNT"); do
        IDX=$(printf "%02d" "$i")
        USERNAME="${EMAIL_PREFIX}-${IDX}@${EMAIL_DOMAIN}"
        RAND=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 20)
        PASSWORD="Pf#${RAND}9"
        USERS_JSON=$(echo "$USERS_JSON" | jq --arg u "$USERNAME" --arg p "$PASSWORD" \
            '. += [{"username":$u,"password":$p}]')
    done
    echo "$USERS_JSON" | jq '.' > "$USERS_FILE"
    chmod 600 "$USERS_FILE"
    echo "Wrote $USERS_FILE (chmod 600). Está cubierto por .gitignore — NO commitearlo."
fi

# ------------------------------------------------------------------
# 2) Provisionar en Cognito
# ------------------------------------------------------------------
USER_COUNT=$(jq 'length' "$USERS_FILE")
echo ""
echo "Bootstrapping $USER_COUNT users into pool $PERF_COGNITO_USER_POOL_ID (region $PERF_COGNITO_REGION)..."

CREATED=0
EXISTED=0
FAILED=0

for i in $(seq 0 $((USER_COUNT - 1))); do
    USERNAME=$(jq -r ".[$i].username" "$USERS_FILE")
    PASSWORD=$(jq -r ".[$i].password" "$USERS_FILE")

    if [[ -z "$USERNAME" || "$USERNAME" == "null" || -z "$PASSWORD" || "$PASSWORD" == "null" ]]; then
        echo "  [$i] skip: missing username or password" >&2
        FAILED=$((FAILED + 1))
        continue
    fi

    # En pools con AliasAttributes=[email], AdminCreateUser exige un username
    # NO-email; el email se pasa como atributo y queda como alias para login.
    # Probamos primero con el username tal cual; si Cognito rechaza por email
    # format, hacemos fallback a la versión sin '@domain'.
    EFFECTIVE_USERNAME="$USERNAME"
    if CREATE_OUTPUT=$(aws cognito-idp admin-create-user \
        --region "$PERF_COGNITO_REGION" \
        --user-pool-id "$PERF_COGNITO_USER_POOL_ID" \
        --username "$EFFECTIVE_USERNAME" \
        --user-attributes "Name=email,Value=$USERNAME" "Name=email_verified,Value=true" \
        --message-action SUPPRESS 2>&1); then
        CREATED=$((CREATED + 1))
        echo "  [$i] created: $USERNAME"
    elif echo "$CREATE_OUTPUT" | grep -q "UsernameExistsException"; then
        EXISTED=$((EXISTED + 1))
        echo "  [$i] exists:  $USERNAME (resetting password)"
    elif echo "$CREATE_OUTPUT" | grep -q "Username cannot be of email format" && [[ "$USERNAME" == *"@"* ]]; then
        EFFECTIVE_USERNAME="${USERNAME%@*}"
        if RETRY_OUTPUT=$(aws cognito-idp admin-create-user \
            --region "$PERF_COGNITO_REGION" \
            --user-pool-id "$PERF_COGNITO_USER_POOL_ID" \
            --username "$EFFECTIVE_USERNAME" \
            --user-attributes "Name=email,Value=$USERNAME" "Name=email_verified,Value=true" \
            --message-action SUPPRESS 2>&1); then
            CREATED=$((CREATED + 1))
            echo "  [$i] created: $USERNAME (cognito username=$EFFECTIVE_USERNAME, email alias)"
        elif echo "$RETRY_OUTPUT" | grep -q "UsernameExistsException"; then
            EXISTED=$((EXISTED + 1))
            echo "  [$i] exists:  $USERNAME (cognito username=$EFFECTIVE_USERNAME, resetting password)"
        else
            echo "  [$i] FAILED to create $USERNAME (email-alias retry):" >&2
            echo "    $RETRY_OUTPUT" >&2
            FAILED=$((FAILED + 1))
            continue
        fi
    else
        echo "  [$i] FAILED to create $USERNAME:" >&2
        echo "    $CREATE_OUTPUT" >&2
        FAILED=$((FAILED + 1))
        continue
    fi

    # admin-set-user-password acepta tanto el username Cognito como el email alias.
    # Usamos EFFECTIVE_USERNAME para mantener consistencia con la creación.
    if ! aws cognito-idp admin-set-user-password \
        --region "$PERF_COGNITO_REGION" \
        --user-pool-id "$PERF_COGNITO_USER_POOL_ID" \
        --username "$EFFECTIVE_USERNAME" \
        --password "$PASSWORD" \
        --permanent \
        >/dev/null 2>&1; then
        echo "  [$i] FAILED to set permanent password for $USERNAME (effective=$EFFECTIVE_USERNAME)" >&2
        FAILED=$((FAILED + 1))
    fi
done

echo ""
echo "Summary: created=$CREATED, existed=$EXISTED, failed=$FAILED, total=$USER_COUNT"

[[ $FAILED -eq 0 ]]
