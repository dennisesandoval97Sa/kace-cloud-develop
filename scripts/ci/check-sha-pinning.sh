#!/usr/bin/env bash
# Política DevSecOps §6.3: todo `uses:` de GitHub Actions debe pinear un SHA
# de commit completo (40 caracteres). Tags y ramas son punteros mutables y
# están prohibidos en definiciones de pipeline.
set -euo pipefail

violations=0
while IFS= read -r line; do
    ref="${line##*@}"
    ref="${ref%% *}"
    if ! [[ "$ref" =~ ^[0-9a-f]{40}$ ]]; then
        echo "VIOLACIÓN §6.3 (referencia mutable): $line"
        violations=$((violations + 1))
    fi
done < <(grep -rhoE 'uses:[[:space:]]*[^[:space:]]+@[^[:space:]]+' .github/workflows/ | grep -v '@\./')

if [ "$violations" -gt 0 ]; then
    echo "$violations referencia(s) mutable(s). Pinear a SHA completo con comentario de versión (# vX.Y.Z)."
    exit 1
fi
echo "OK: todas las actions están SHA-pinned."
