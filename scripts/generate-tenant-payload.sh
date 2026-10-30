#!/usr/bin/env bash
#
# generate-tenant-payload.sh
#
# Generates a JSON payload for the Tenant API (POST /tenant)
# based on the .env file values.
#
# Usage:
#   ./scripts/generate-tenant-payload.sh                  # Uses .env from project root
#   ./scripts/generate-tenant-payload.sh /path/to/.env    # Uses specified .env file
#   ./scripts/generate-tenant-payload.sh .env.staging     # Uses a specific env file
#
# Output: JSON payload printed to stdout (pipe to file or clipboard as needed)
#   ./scripts/generate-tenant-payload.sh > tenant-payload.json
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ENV_FILE="${1:-$PROJECT_ROOT/.env}"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "Error: File not found: $ENV_FILE" >&2
    echo "Usage: $0 [path/to/.env]" >&2
    exit 1
fi

# Load env vars from file (skip comments and empty lines)
set -a
while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip empty lines and comments
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    # Only process lines with KEY=VALUE format
    [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] && eval "$line" 2>/dev/null || true
done < "$ENV_FILE"
set +a

# Generate UUID for tenant id
TENANT_ID=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || python3 -c "import uuid; print(uuid.uuid4())")

# Derive subdomain from service name (lowercase, replace spaces/underscores with hyphens)
SUBDOMAIN=$(echo "${APPS_SERVICE_NAME:-}" | tr '[:upper:]' '[:lower:]' | tr ' _' '--')

# Helper: output a JSON string field (only if value is non-empty)
json_string() {
    local key="$1"
    local value="$2"
    if [[ -n "$value" && "$value" != "ADMINISTRADORES" ]]; then
        printf '    "%s": "%s"' "$key" "$value"
        return 0
    fi
    return 1
}

# Helper: output a JSON number field (only if value is non-empty)
json_number() {
    local key="$1"
    local value="$2"
    if [[ -n "$value" && "$value" != "ADMINISTRADORES" ]]; then
        printf '    "%s": %s' "$key" "$value"
        return 0
    fi
    return 1
}

# Build JSON payload
# We collect all fields and join them with commas
fields=()

add_string() {
    local field
    if field=$(json_string "$1" "$2"); then
        fields+=("$field")
    fi
}

add_number() {
    local field
    if field=$(json_number "$1" "$2"); then
        fields+=("$field")
    fi
}

# Required fields
add_string "id"                                     "${VITE_TENANT_ID:-}"
add_string "subdomain"                              "$SUBDOMAIN"
add_string "apps_environment"                       "${APPS_ENVIRONMENT:-}"
add_string "apps_service_name"                      "${APPS_SERVICE_NAME:-}"
add_string "apps_domain"                            "${APPS_DOMAIN:-}"

# App configuration
add_string "apps_debug"                             "${APPS_DEBUG:-}"
add_string "apps_api_subdomain"                     "${APPS_API_SUBDOMAIN:-}"
add_string "apps_admin_subdomain"                   "${APPS_ADMIN_SUBDOMAIN:-}"
add_string "apps_allowed_origins"                   "${APPS_ALLOWED_ORIGINS:-}"
add_string "apps_content_security_policy_domains"   "${APPS_CONTENT_SECURITY_POLICY_DOMAINS:-}"
add_string "apps_frame_origins"                     "${APPS_FRAME_ORIGINS:-}"
add_string "apps_certificate_domain_arn"            "${APPS_CERTIFICATE_DOMAIN_ARN:-}"
add_string "apps_hosted_zone_id"                    "${APPS_HOSTED_ZONE_ID:-}"
add_string "apps_execute_rest_hook_service_url"     "${APPS_EXECUTE_REST_HOOK_SERVICE_URL:-}"
add_number "apps_timeout_rest_flows_value_ms"       "${APPS_TIMEOUT_REST_FLOWS_VALUE_MS:-}"
add_number "apps_actions_queue_executor_timeout_ms"  "${APPS_ACTIONS_QUEUE_EXECUTOR_TIMEOUT_MS:-}"
add_number "apps_actions_queue_execution_timeout_ms" "${APPS_ACTIONS_QUEUE_EXECUTION_TIMEOUT_MS:-}"
add_string "timezone"                               "${TIMEZONE:-}"

# Database configuration
add_string "db_host"                                "${DB_HOST:-}"
add_string "db_database"                            "${DB_DATABASE:-}"
add_string "db_user"                                "${DB_USER:-}"
add_string "db_password"                            "${DB_PASSWORD:-}"
add_string "db_auxiliar_user"                       "${DB_AUXILIAR_USER:-}"
add_string "db_auxiliar_password"                   "${DB_AUXILIAR_PASSWORD:-}"
add_number "db_port"                                "${DB_PORT:-}"
add_string "db_schema"                              "${DB_SCHEMA:-}"

# Encryption
add_string "secret_key"                             "${SECRET_KEY:-}"
add_string "secret_iv"                              "${SECRET_IV:-}"
add_string "encryption_method"                      "${ENCRYPTION_METHOD:-}"

# AWS DynamoDB
add_string "aws_dynamodb_multitenant_table_arn"     "${AWS_DYNAMODB_MULTITENANT_TABLE_ARN:-}"

# AWS S3
add_string "aws_s3_bucket"                          "${AWS_S3_BUCKET:-}"
add_string "aws_s3_access_key_id"                   "${AWS_S3_ACCESS_KEY_ID:-}"
add_string "aws_s3_secret_access_key"               "${AWS_S3_SECRET_ACCESS_KEY:-}"
add_string "aws_s3_region"                          "${AWS_S3_REGION:-}"

# AWS CSS (Antivirus)
add_number "aws_css_enable"                         "${AWS_CSS_ENABLE:-}"
add_string "aws_css_url"                            "${AWS_CSS_URL:-}"
add_string "aws_css_username"                       "${AWS_CSS_USERNAME:-}"
add_string "aws_css_password"                       "${AWS_CSS_PASSWORD:-}"

# AWS Cognito
add_string "aws_cognito_user_pool_id"               "${AWS_COGNITO_USER_POOL_ID:-}"
add_string "aws_cognito_app_client_id"              "${AWS_COGNITO_APP_CLIENT_ID:-}"
add_string "aws_cognito_region"                     "${AWS_COGNITO_REGION:-}"
add_string "aws_cognito_url"                        "${AWS_COGNITO_URL:-}"
add_string "aws_cognito_identity_provider"          "${VITE_IDENTITY_PROVIDER:-}"
add_string "aws_cognito_response_type"              "${VITE_COGNITO_RESPONSE_TYPE:-}"
add_string "aws_cognito_scope"                      "${VITE_COGNITO_SCOPE:-}"
add_string "aws_cognito_redirect_to_exchange"       "${VITE_COGNITO_REDIRECT_URI_PROD:-}"
add_string "aws_cognito_redirect_to_frontend"       "${VITE_COGNITO_LOGOUT_URI_PROD:-}"

# Print JSON
echo "{"
for i in "${!fields[@]}"; do
    if [[ $i -lt $((${#fields[@]} - 1)) ]]; then
        echo "${fields[$i]},"
    else
        echo "${fields[$i]}"
    fi
done
echo "}"
