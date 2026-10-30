#!/usr/bin/env bash
# Pre-deploy check: valida que un archivo .env contenga TODAS las variables
# declaradas en .env.example (el "contrato" del entorno).
#
# A diferencia de validate-env-vars.sh (que valida código -> .env.example),
# este script valida .env.example -> .env, es decir que el entorno donde se va
# a desplegar tenga definidas todas las claves esperadas.
#
# Uso:
#   validate-env-deploy.sh [ruta-al-env] [--strict]
#     ruta-al-env : archivo a validar (default: .env en la raíz del repo)
#     --strict    : trata también las variables presentes-pero-VACÍAS como error
#
# Comportamiento por defecto:
#   - Clave declarada en .env.example y AUSENTE en el .env  -> ERROR (bloquea, exit 1)
#   - Clave presente pero con valor vacío                    -> WARNING (no bloquea)
#   Con --strict, las vacías también bloquean.
#
# Exit: 0 OK | 1 faltan variables (o vacías en --strict) | 2 error de uso.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_EXAMPLE="$ROOT_DIR/.env.example"
ENV_FILE="$ROOT_DIR/.env"
STRICT=0

for arg in "$@"; do
    case "$arg" in
        --strict) STRICT=1 ;;
        -h|--help)
            grep -E '^#' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        -*) echo "✗ Opción desconocida: $arg" >&2; exit 2 ;;
        *)  ENV_FILE="$arg" ;;
    esac
done

if [ ! -f "$ENV_EXAMPLE" ]; then
    echo "✗ No existe .env.example en $ENV_EXAMPLE" >&2
    exit 2
fi
if [ ! -f "$ENV_FILE" ]; then
    echo "✗ No existe el archivo env a validar: $ENV_FILE" >&2
    echo "  Crea el .env (o pásalo como argumento) antes de desplegar." >&2
    exit 2
fi

# Claves declaradas (no comentadas) en el contrato .env.example
REQUIRED=$(grep -oP '^\K[A-Z_][A-Z0-9_]*(?==)' "$ENV_EXAMPLE" | sort -u)

MISSING=()
EMPTY=()

for VAR in $REQUIRED; do
    # Última definición de la clave en el env target (admite "export " y espacios)
    LINE=$(grep -E "^[[:space:]]*(export[[:space:]]+)?${VAR}=" "$ENV_FILE" | tail -n1 || true)
    if [ -z "$LINE" ]; then
        MISSING+=("$VAR")
        continue
    fi
    # Valor tras el primer '=', sin espacios ni comillas envolventes
    VAL="${LINE#*=}"
    VAL="$(printf '%s' "$VAL" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//; s/^"(.*)"$/\1/; s/^'\''(.*)'\''$/\1/')"
    [ -z "$VAL" ] && EMPTY+=("$VAR")
done

TOTAL=$(printf '%s\n' "$REQUIRED" | grep -c '^' || true)

echo "=== Validación de .env para deploy ==="
echo ""
echo "Contrato : $ENV_EXAMPLE"
echo "Objetivo : $ENV_FILE"
echo "Variables requeridas: $TOTAL"
echo ""

STATUS=0

if [ ${#MISSING[@]} -gt 0 ]; then
    echo "✗ Faltan ${#MISSING[@]} variable(s) en el .env:"
    printf '    - %s\n' "${MISSING[@]}"
    STATUS=1
else
    echo "✓ Todas las variables declaradas están presentes"
fi
echo ""

if [ ${#EMPTY[@]} -gt 0 ]; then
    if [ "$STRICT" -eq 1 ]; then
        echo "✗ ${#EMPTY[@]} variable(s) presentes pero VACÍAS (--strict las bloquea):"
        STATUS=1
    else
        echo "⚠ ${#EMPTY[@]} variable(s) presentes pero vacías (informativo, no bloquea):"
    fi
    printf '    - %s\n' "${EMPTY[@]}"
    echo ""
fi

if [ "$STATUS" -eq 0 ]; then
    echo "--- OK: el .env cumple el contrato de .env.example ---"
else
    echo "--- BLOQUEADO: registra los valores anteriores antes de desplegar ---"
fi

exit "$STATUS"
