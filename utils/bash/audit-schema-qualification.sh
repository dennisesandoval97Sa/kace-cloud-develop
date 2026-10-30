#!/bin/bash
# audit-schema-qualification.sh
# Busca queries Knex que potencialmente no califican schema.
# Run: bash utils/bash/audit-schema-qualification.sh

set -e
EXIT_CODE=0
# Scan both the core package source AND the Lambda controllers in apps/.
# Lambda controllers occasionally bypass repository helpers and call
# `this.repository.connection('table')` directly — those queries also need
# schema qualification.
PKG_DIR="packages/kace_cloud_core/src apps/apiv1"

# Common exclusions applied to every grep below.
EXCLUDE_PATHS="/dist/|/cdk.out/|/node_modules/|/test/|/tests/|\.test\.|\.integration\."

echo "🔍 Auditing schema qualification in Knex repos..."
echo

# Pattern 1: this.connection(STRING_LITERAL) sin withSchema/table()
echo "=== Pattern 1: this.connection('STRING') sin .withSchema() ni this.table() ==="
HITS=$(grep -rnE "this\.connection\(['\"\`][a-z_]" $PKG_DIR \
    --include="*.js" --include="*.mjs" 2>/dev/null | \
    grep -vE "$EXCLUDE_PATHS" | \
    grep -v "information_schema\|pg_\|sqlite_master\|withSchema" || true)

if [ -n "$HITS" ]; then
    echo "$HITS"
    echo "❌ Found $(echo "$HITS" | wc -l) potential issues"
    EXIT_CODE=1
else
    echo "✅ Clean"
fi
echo

# Pattern 2: .join/.leftJoin/.innerJoin/.rightJoin con string literal sin schema.
echo "=== Pattern 2: .join/leftJoin/innerJoin('STRING' o 'STRING as X', ...) ==="
HITS=$(grep -rnE "\.(left|right|inner|cross)?[Jj]oin\(['\"\`][a-z_][a-z_0-9]*(\s+[Aa][Ss]\s+[a-z_][a-z_0-9]*)?['\"\`]" \
    $PKG_DIR --include="*.js" --include="*.mjs" 2>/dev/null | \
    grep -vE "$EXCLUDE_PATHS" | \
    grep -v "information_schema\|pg_\|\${this\.schema}\|qualifiedName\|this\.schema\|audit:cte" || true)

if [ -n "$HITS" ]; then
    echo "$HITS"
    echo "⚠️  Found $(echo "$HITS" | wc -l) joins sin schema prefix"
    EXIT_CODE=1
else
    echo "✅ Clean"
fi
echo

# Pattern 2b: Domain services / non-repo code accessing repository.connection('table') directly.
# Catches both single-line forms (e.g. `this.repository.connection('X').select(...)`)
# and multi-line forms where the .connection call is on its own line:
#     this.repository
#         .connection('X')
#         .select(...)
echo "=== Pattern 2b: repository.connection('table') sin qualifiedName (domain services) ==="
HITS=$(grep -rnE "(\.|^\s*\.)connection\(['\"\`][a-z_][a-z_0-9]*['\"\`]\)" \
    $PKG_DIR --include="*.js" --include="*.mjs" 2>/dev/null | \
    grep -vE "$EXCLUDE_PATHS" | \
    grep -vE "information_schema|pg_|sqlite_master|qualifiedName|this\.connection\(|this\.#connection\(" || true)

if [ -n "$HITS" ]; then
    echo "$HITS"
    echo "⚠️  Found $(echo "$HITS" | wc -l) domain services con connection('table') sin schema"
    EXIT_CODE=1
else
    echo "✅ Clean"
fi
echo

# Pattern 3: .from('STRING_LITERAL') sin schema
echo "=== Pattern 3: .from('STRING_NO_DOT') ==="
HITS=$(grep -rnE "\.from\(['\"\`][a-z_][a-z_0-9]*['\"\`]\)" \
    $PKG_DIR --include="*.js" --include="*.mjs" 2>/dev/null | \
    grep -vE "$EXCLUDE_PATHS" | \
    grep -v "information_schema\|pg_\|\${this\.schema}\|qualifiedName" || true)

if [ -n "$HITS" ]; then
    echo "$HITS"
    echo "⚠️  Found $(echo "$HITS" | wc -l) .from() sin schema"
    EXIT_CODE=1
else
    echo "✅ Clean"
fi
echo

# Pattern 4: .raw() con FROM/INTO/UPDATE/JOIN sobre tabla literal sin schema
echo "=== Pattern 4: .raw() con FROM/INTO/UPDATE/JOIN tabla literal ==="
HITS=$(grep -rnE "\.raw\([^)]*\b(FROM|INTO|UPDATE|JOIN)\s+[a-z_][a-z_0-9]*[\s,)]" \
    $PKG_DIR --include="*.js" --include="*.mjs" 2>/dev/null | \
    grep -vE "$EXCLUDE_PATHS" | \
    grep -v "information_schema\|pg_\|\${this\.schema}\|qualifiedName\|\?\?" || true)

if [ -n "$HITS" ]; then
    echo "$HITS"
    echo "⚠️  Found $(echo "$HITS" | wc -l) raw queries que pueden no calificar"
    EXIT_CODE=1
else
    echo "✅ Clean"
fi
echo

# Pattern 5: searchPath como CLAVE de config (causa el pinning del RDS Proxy).
echo "=== Pattern 5: searchPath: como clave de config ==="
HITS=$(grep -rnE "(^|[^\.])searchPath\s*:" $PKG_DIR \
    --include="*.js" --include="*.mjs" 2>/dev/null | \
    grep -vE "$EXCLUDE_PATHS" | \
    grep -v "//\|/\*\|\.test\.\|migrations\|knexfile" || true)

if [ -n "$HITS" ]; then
    echo "$HITS"
    echo "❌ Found $(echo "$HITS" | wc -l) referencias a searchPath"
    EXIT_CODE=1
else
    echo "✅ Clean"
fi
echo

if [ $EXIT_CODE -ne 0 ]; then
    echo "🚨 Audit FAILED. Fix the above before proceeding."
else
    echo "✅ Audit PASSED"
fi

exit $EXIT_CODE
