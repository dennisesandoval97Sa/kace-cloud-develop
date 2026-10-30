#!/usr/bin/env bash
# Carga un dump anonimizado al RDS perf.
# Uso: ./load.sh <dump-file>
# Lee credenciales de variables PERF_DB_*.
#
# Carga automáticamente ./.env.perf si existe (con auto-export). Para usar otro
# archivo: ENV_FILE=/path/to/env bash data/anonymizer/load.sh
# Para saltar el auto-source: ENV_FILE=/dev/null bash data/anonymizer/load.sh

set -euo pipefail

# Auto-source .env.perf (con auto-export) buscándolo desde la raíz del paquete
ENV_FILE="${ENV_FILE:-$(dirname "$(dirname "$(dirname "$(realpath "$0")")")")/.env.perf}"
if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
fi

# pg_restore lee PGPASSWORD del entorno; si solo tenemos PERF_DB_PASSWORD lo mapeamos.
export PGPASSWORD="${PGPASSWORD:-${PERF_DB_PASSWORD:-}}"

DUMP="${1:?Usage: load.sh <dump-file>}"

: "${PERF_DB_HOST:?PERF_DB_HOST not set}"
: "${PERF_DB_PORT:?PERF_DB_PORT not set}"
: "${PERF_DB_NAME:?PERF_DB_NAME not set}"
: "${PERF_DB_USER:?PERF_DB_USER not set}"
: "${PGPASSWORD:?PGPASSWORD or PERF_DB_PASSWORD not set}"

if [[ ! -f "$DUMP" ]]; then
    echo "Dump file not found: $DUMP" >&2
    exit 1
fi

echo "Loading $DUMP -> $PERF_DB_HOST:$PERF_DB_PORT/$PERF_DB_NAME"

if [[ "$DUMP" == *.gz ]]; then
    gunzip -c "$DUMP" | pg_restore \
        --host="$PERF_DB_HOST" \
        --port="$PERF_DB_PORT" \
        --username="$PERF_DB_USER" \
        --dbname="$PERF_DB_NAME" \
        --no-owner \
        --no-acl \
        --clean \
        --if-exists
else
    pg_restore \
        --host="$PERF_DB_HOST" \
        --port="$PERF_DB_PORT" \
        --username="$PERF_DB_USER" \
        --dbname="$PERF_DB_NAME" \
        --no-owner \
        --no-acl \
        --clean \
        --if-exists \
        "$DUMP"
fi

echo "Restore complete."
