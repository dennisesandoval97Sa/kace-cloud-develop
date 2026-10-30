#!/usr/bin/env bash
# Réplica local de los jobs de ci.yml (`lint`, `test-core`, `security-scan`).
# Ejecutar ANTES de abrir/actualizar un PR para saber si los checks pasarán.
#
# Uso: scripts/ci/local-ci.sh [rama-base]      (default: origin/develop)
#      SKIP_CORE_TESTS=1 scripts/ci/local-ci.sh   (salta el paso 2, ~27 min)
#
# Diferencias deliberadas con el CI:
#   - Prettier también revisa cambios sin commitear (el CI solo ve lo commiteado);
#     aquí es más estricto a propósito.
#   - Los dos escaneos de Trivy corren sobre el árbol TRACKEADO (git archive HEAD),
#     igual que el CI: tus .env/.auth locales sin trackear NO cuentan.
#   - El CI parte @kace/core en 4 shards con 2 workers (un runner tiene 2 vCPU);
#     en local va la suite entera con la configuración del propio paquete.
#   - El CI usa scripts/ci/ci.env; aquí manda tu .env real.
set -euo pipefail

BASE="${1:-origin/develop}"
cd "$(git rev-parse --show-toplevel)"
FAILED=0

echo "════ 1/5 Prettier (cambios vs ${BASE}) ════"
MERGE_BASE=$(git merge-base "$BASE" HEAD)
CHANGED=$(
    {
        git diff --name-only --diff-filter=ACMR "$MERGE_BASE"
        git diff --name-only --diff-filter=ACMR
    } | sort -u | grep -v '^$' || true
)
if [ -n "$CHANGED" ]; then
    echo "$CHANGED" | xargs -d '\n' pnpm exec prettier --check --ignore-unknown || FAILED=1
else
    echo "Sin archivos cambiados."
fi

# ALLOWLIST: el gate solo corre los paquetes verificados. Hoy es @kace/core y
# nada más — no es un filtro por "paquetes tocados". Al añadir un paquete a la
# allowlist de ci.yml, añadirlo también aquí.
echo "════ 2/5 Tests de @kace/core (allowlist del gate) ════"
if [ "${SKIP_CORE_TESTS:-0}" = "1" ]; then
    echo "SALTADO por SKIP_CORE_TESTS=1 — el CI SÍ los corre."
else
    echo "Suite completa: ~27 min. Necesita Postgres con CREATEDB (clona una BD por archivo)."
    TZ=America/Bogota pnpm --filter "@kace/core" run tests --coverage || FAILED=1
fi

echo "════ 3/5 Trivy: secretos (BLOQUEANTE en CI) ════"
if ! command -v trivy > /dev/null; then
    echo "trivy no está instalado (binario pineado: v0.73.0 → ~/.local/bin). Abortando." >&2
    exit 1
fi
CLEAN_TREE=$(mktemp -d)
trap 'rm -rf "$CLEAN_TREE"' EXIT
git archive HEAD | tar -x -C "$CLEAN_TREE"
trivy fs --scanners secret --exit-code 1 --quiet "$CLEAN_TREE" || FAILED=1

echo "════ 4/5 Trivy: vulnerabilidades Critical/High (BLOQUEANTE en CI) ════"
# Las excepciones van en .trivyignore, que trivy toma del directorio de trabajo;
# por eso se invoca desde la raíz del repo apuntando al árbol limpio.
trivy fs --scanners vuln --severity CRITICAL,HIGH --exit-code 1 --quiet "$CLEAN_TREE" || FAILED=1

echo "════ 5/5 SBOM CycloneDX (informativo, NO bloquea) ════"
if SBOM_OUT=$(mktemp -d)/sbom.cdx.json; then
    if trivy fs --format cyclonedx --output "$SBOM_OUT" --quiet "$CLEAN_TREE"; then
        if python3 -c "
import json, sys
d = json.load(open('$SBOM_OUT'))
print('CycloneDX', d.get('specVersion'), '·', len(d.get('components', [])), 'componentes')
"; then
            :
        else
            echo "⚠️  No se pudo parsear el SBOM." >&2
        fi
    else
        echo "⚠️  Trivy no pudo generar el SBOM." >&2
    fi
else
    echo "⚠️  No se pudo crear directorio temporal para SBOM." >&2
fi

echo
if [ "$FAILED" -eq 0 ]; then
    echo "✅ Los checks bloqueantes del CI pasarían con este estado."
else
    echo "❌ Algún check bloqueante fallaría en el CI. Corrige antes de abrir el PR." >&2
    exit 1
fi
