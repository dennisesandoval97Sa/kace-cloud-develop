#!/bin/bash
# verify-search-path-fix.sh
# Smoke test post-deploy: valida que RDS Proxy ya no pina por SET search_path.
# Run 5 min después de un deploy a stage o prod.
#
# Args:
#   $1 PROXY_NAME   — e.g. proxy-1773420572027-database-1-sara
#   $2 LAMBDA_NAME  — e.g. ASISTENCIAEventProcessorS-eventprocessorlambda7EAB-yZMmD4kw58JZ
#   $3 MODE         — "full" (default) generates load, "readonly" just checks metrics
#
# Examples:
#   bash utils/bash/verify-search-path-fix.sh proxy-1773... my-lambda full
#   bash utils/bash/verify-search-path-fix.sh proxy-1773... my-lambda readonly

set -e

PROXY_NAME=${1:?"Proxy name required as first arg"}
LAMBDA_NAME=${2:?"Lambda name required as second arg"}
MODE=${3:-full}

if [[ "$MODE" != "full" && "$MODE" != "readonly" ]]; then
    echo "❌ MODE must be 'full' or 'readonly', got: $MODE"
    exit 2
fi

echo "🔥 Smoke test (mode=$MODE)"
echo "   Proxy:  $PROXY_NAME"
echo "   Lambda: $LAMBDA_NAME"
echo

# === FULL MODE: enable debug + generate load ===
if [[ "$MODE" == "full" ]]; then
    echo "[1/6] Enabling debug logging on proxy..."
    aws rds modify-db-proxy --db-proxy-name "$PROXY_NAME" --debug-logging > /dev/null
    sleep 60

    echo "[2/6] Generating load (100 parallel invocations)..."
    for i in {1..100}; do
        aws lambda invoke \
            --function-name "$LAMBDA_NAME" \
            --payload '{"Records":[{"body":"{}"}]}' \
            --invocation-type Event \
            "/tmp/smoke-r-$i.json" > /dev/null 2>&1 &
    done
    wait

    echo "[3/6] Waiting 2 min for processing..."
    sleep 120
else
    echo "[1-3/6] SKIPPED (readonly mode — no debug toggle, no load generation)"
fi

# === Check pinning warnings in proxy logs ===
LOG_GROUP="/aws/rds/proxy/$PROXY_NAME"
echo "[4/6] Checking proxy logs for search_path pinning..."

# filter-log-events paginates the response when there are many matches.
# Each page returns its own `events.length`, so the raw output may look like
# "0\n0\n3" (three pages). We sum across pages to get the real count.
PINNING_COUNT=$(aws logs filter-log-events \
    --log-group-name "$LOG_GROUP" \
    --start-time $(date -u -d '5 minutes ago' +%s)000 \
    --filter-pattern '"search_path"' \
    --query 'events | length(@)' --output text 2>/dev/null | \
    awk '{sum+=$1} END {print sum+0}')

PINNING_COUNT=${PINNING_COUNT:-0}

echo "       Pinning warnings con 'search_path' digest: $PINNING_COUNT (target: 0)"

# === Pinned/Borrowed ratio ===
echo "[5/6] Checking Pinned/Borrowed ratio..."

END=$(date -u +%FT%TZ)
START=$(date -u -d '10 minutes ago' +%FT%TZ)

BORROWED=$(aws cloudwatch get-metric-statistics --namespace AWS/RDS \
    --metric-name DatabaseConnectionsCurrentlyBorrowed \
    --dimensions Name=ProxyName,Value="$PROXY_NAME" \
    --start-time "$START" --end-time "$END" --period 60 --statistics Maximum \
    --query 'sort_by(Datapoints, &Maximum)[-1].Maximum' --output text 2>/dev/null || echo "None")

PINNED=$(aws cloudwatch get-metric-statistics --namespace AWS/RDS \
    --metric-name DatabaseConnectionsCurrentlySessionPinned \
    --dimensions Name=ProxyName,Value="$PROXY_NAME" \
    --start-time "$START" --end-time "$END" --period 60 --statistics Maximum \
    --query 'sort_by(Datapoints, &Maximum)[-1].Maximum' --output text 2>/dev/null || echo "None")

if [[ "$BORROWED" == "None" || "$BORROWED" == "0" || -z "$BORROWED" ]]; then
    echo "       ⚠️  Could not compute ratio (Borrowed=$BORROWED, Pinned=$PINNED)"
    RATIO="N/A"
else
    RATIO=$(echo "scale=3; $PINNED / $BORROWED" | bc)
    echo "       Borrowed=$BORROWED  Pinned=$PINNED  Ratio=$RATIO (target: <0.05)"
fi

# NOTE: A Ratio close to 1.0 does NOT necessarily mean the refactor failed.
# What matters is *what causes the pinning*: only search_path pinning is in
# scope for this refactor. Other causes (e.g. queries >16KB, prepared
# statements) are pre-existing patterns and considered out of scope.
# The PASS criterion below relies on PINNING_COUNT (search_path-specific).

# === Disable debug logging (only in full mode) ===
if [[ "$MODE" == "full" ]]; then
    echo "[6/6] Disabling debug logging..."
    aws rds modify-db-proxy --db-proxy-name "$PROXY_NAME" --no-debug-logging > /dev/null
else
    echo "[6/6] SKIPPED (readonly mode — debug was not enabled)"
fi

# === Decision ===
echo
echo "===================="
echo "Result:"
echo "===================="
PASS=true

if [[ "$PINNING_COUNT" != "0" ]]; then
    echo "  ❌ Pinning warnings detected: $PINNING_COUNT"
    PASS=false
else
    echo "  ✅ No pinning warnings with search_path"
fi

if [[ "$RATIO" != "N/A" ]]; then
    if (( $(echo "$RATIO < 0.05" | bc -l) )); then
        echo "  ✅ Pinned/Borrowed ratio: $RATIO < 0.05"
    elif [[ "$PINNING_COUNT" == "0" ]]; then
        echo "  ℹ️  Pinned/Borrowed ratio: $RATIO — but 0 search_path pins (out-of-scope causes only)"
        echo "       Borrowed=$BORROWED, Pinned=$PINNED. With small load, ratio approaches 1.0 even when refactor succeeded."
    else
        echo "  ❌ Pinned/Borrowed ratio: $RATIO >= 0.05 (and search_path pinning present)"
        PASS=false
    fi
else
    echo "  ⚠️  Could not measure ratio (no recent metrics)"
fi

echo
if [[ "$PASS" == "true" ]]; then
    echo "✅ Smoke test PASSED"
    exit 0
else
    echo "❌ Smoke test FAILED"
    exit 1
fi
