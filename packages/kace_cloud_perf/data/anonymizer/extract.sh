#!/usr/bin/env bash
# Extrae un dump read-only de la DB de producción para anonimización posterior.
# Uso: ./extract.sh <output-file>
# Lee credenciales de variables de entorno PROD_DB_*.

set -euo pipefail

OUTPUT="${1:-./dump/prod-snapshot-$(date +%Y%m%d-%H%M%S).sql.gz}"
mkdir -p "$(dirname "$OUTPUT")"

: "${PROD_DB_HOST:?PROD_DB_HOST not set}"
: "${PROD_DB_PORT:?PROD_DB_PORT not set}"
: "${PROD_DB_NAME:?PROD_DB_NAME not set}"
: "${PROD_DB_USER:?PROD_DB_USER not set}"
: "${PGPASSWORD:?PGPASSWORD not set (export it before running)}"

echo "Extracting from $PROD_DB_HOST:$PROD_DB_PORT/$PROD_DB_NAME -> $OUTPUT"

pg_dump \
    --host="$PROD_DB_HOST" \
    --port="$PROD_DB_PORT" \
    --username="$PROD_DB_USER" \
    --dbname="$PROD_DB_NAME" \
    --no-owner \
    --no-acl \
    --format=custom \
    --file=- \
    | gzip -c > "$OUTPUT"

echo "Done. Output size: $(du -h "$OUTPUT" | cut -f1)"
