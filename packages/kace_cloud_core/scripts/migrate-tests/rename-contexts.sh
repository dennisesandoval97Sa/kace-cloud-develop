#!/usr/bin/env bash
#
# Tarea 13: alinea los directorios de tests/ con los módulos de src/.
#
# Para cada par (origen, destino):
#   - si el destino no existe todavía en tests/, se hace `git mv` del
#     directorio completo (rename simple).
#   - si el destino ya existe (porque src/ partió el bounded context en dos
#     carpetas de tests/), se mueve el CONTENIDO de origen dentro de destino,
#     archivo por archivo / subdirectorio por subdirectorio, abortando si
#     detecta una colisión de nombre.
#
# Este script NO reescribe imports; eso lo hace rewrite-imports.mjs, que se
# invoca por separado (o desde el mismo `run-all.sh`).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if [ ! -d tests ] || [ ! -d src ]; then
    echo "ERROR: este script debe ejecutarse desde packages/kace_cloud_core (no encuentro tests/ o src/)" >&2
    exit 1
fi

# origen:destino
MAPPINGS=(
    "case:cases"
    "aux-definitions:aux_definitions"
    "mail:mails"
    "groups:grupos"
    "aux-cases:aux_casos"
    "report_executions:report-executions"
    "secrets:secrets-vault"
    "background_execution:background-executions"
    "banner:banners"
    "action-model-update:action-update-model"
    "allowed-connections:allowed-conections"
    "aux-usuarios:aux_usuarios"
    "flows:flow"
    "roles:role"
    "transitions:transition"
    "aux-clients:aux_clientes"
    "classifications-level-distinction:ClassificationsLevelDistinction"
)

# --- Paso 1: detectar colisiones ANTES de mover nada -----------------------
echo "== Verificando colisiones =="
collisions=0
for pair in "${MAPPINGS[@]}"; do
    src_dir="tests/${pair%%:*}"
    dst_dir="tests/${pair##*:}"

    if [ ! -d "$src_dir" ]; then
        echo "ERROR: no existe $src_dir" >&2
        collisions=1
        continue
    fi

    if [ ! -d "$dst_dir" ]; then
        # rename simple, sin colisión posible
        continue
    fi

    while IFS= read -r -d '' file; do
        rel="${file#"$src_dir"/}"
        target="$dst_dir/$rel"
        if [ -e "$target" ]; then
            echo "COLISIÓN: $file -> $target ya existe" >&2
            collisions=1
        fi
    done < <(find "$src_dir" -type f -print0)
done

if [ "$collisions" -ne 0 ]; then
    echo "Abortando: hay colisiones sin resolver. No se movió nada." >&2
    exit 1
fi
echo "Sin colisiones."

# --- Paso 2: ejecutar los movimientos --------------------------------------
echo "== Moviendo directorios =="
for pair in "${MAPPINGS[@]}"; do
    src_dir="tests/${pair%%:*}"
    dst_dir="tests/${pair##*:}"

    if [ ! -d "$dst_dir" ]; then
        echo "git mv $src_dir $dst_dir"
        git mv "$src_dir" "$dst_dir"
        continue
    fi

    echo "merge $src_dir -> $dst_dir"
    # Mover primero los archivos de nivel más profundo no importa el orden,
    # porque git mv crea los directorios intermedios que hagan falta.
    while IFS= read -r -d '' file; do
        rel="${file#"$src_dir"/}"
        target="$dst_dir/$rel"
        mkdir -p "$(dirname "$target")"
        git mv "$file" "$target"
    done < <(find "$src_dir" -type f -print0)

    # limpiar subdirectorios vacíos que hayan quedado en el origen
    find "$src_dir" -type d -empty -delete 2>/dev/null || true
    if [ -d "$src_dir" ]; then
        if [ -z "$(find "$src_dir" -mindepth 1)" ]; then
            rmdir "$src_dir"
        else
            echo "WARN: $src_dir no quedó vacío tras el merge" >&2
        fi
    fi
done

echo "== Movimientos completados =="
