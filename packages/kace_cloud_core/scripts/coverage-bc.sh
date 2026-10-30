#!/usr/bin/env bash
# Cobertura de un solo bounded context, sin umbrales.
#
# El número que imprime NO es comparable con el de la corrida completa: solo
# ejecuta los tests de este BC, y a módulos transversales como `shared` los
# cubre medio paquete. Sirve como delta antes/después con el mismo comando.
set -euo pipefail

BC="${1:?uso: scripts/coverage-bc.sh <bounded-context>}"
cd "$(dirname "$0")/.."

if [[ ! -d "src/$BC" ]]; then
    echo "No existe src/$BC" >&2
    exit 1
fi

node --experimental-vm-modules --max-old-space-size=6144 node_modules/jest/bin/jest.js \
    "tests/$BC" \
    --coverage \
    --collectCoverageFrom="src/$BC/**/*.js" \
    --coverageThreshold='{}' \
    --coverageReporters=text \
    --maxWorkers="${JEST_MAX_WORKERS:-6}"
