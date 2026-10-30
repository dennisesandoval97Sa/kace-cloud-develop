import Tenant from '../../domain/Tenant.js';

export const LOCAL_TENANT_ID = '8ce06db5-0dd3-4aba-a63d-42ed8f96ca4a';

/**
 * Local Tenant Repository for development environments
 * Extracts tenant configuration from environment variables (.env)
 * Simulates DynamoDB repository interface for local development
 */
export default class LocalTenantRepository {
    /**
     * Finds a Tenant by subdomain (ignores id parameter in local mode)
     * Creates a Tenant instance from environment variables
     * @param {string} id - The tenant subdomain (ignored in local mode)
     * @returns {Promise<Tenant|null>} The Tenant instance or null if required env vars missing
     */
    async find(id = '') {
        if (!id) {
            id = LOCAL_TENANT_ID;
        }
        const dto = {
            id: id,
            subdomain: process.env.APPS_API_SUBDOMAIN,
            apps_environment: process.env.APPS_ENVIRONMENT,
            apps_service_name: process.env.APPS_SERVICE_NAME,
            apps_debug: process.env.APPS_DEBUG,
            apps_debug_level: 2,
            apps_domain: process.env.APPS_DOMAIN,
            apps_api_subdomain: process.env.APPS_API_SUBDOMAIN,
            apps_admin_subdomain: process.env.APPS_ADMIN_SUBDOMAIN,
            apps_allowed_origins: process.env.APPS_ALLOWED_ORIGINS,
            apps_content_security_policy_domains: process.env.APPS_CONTENT_SECURITY_POLICY_DOMAINS,
            apps_frame_origins: process.env.APPS_FRAME_ORIGINS,
            apps_certificate_domain_arn: process.env.APPS_CERTIFICATE_DOMAIN_ARN,
            apps_hosted_zone_id: process.env.APPS_HOSTED_ZONE_ID,
            apps_execute_rest_hook_service_url: process.env.APPS_EXECUTE_REST_HOOK_SERVICE_URL,
            apps_timeout_rest_flows_value_ms: parseInt(process.env.APPS_TIMEOUT_REST_FLOWS_VALUE_MS, 10),
            apps_actions_queue_executor_timeout_ms: parseInt(process.env.APPS_ACTIONS_QUEUE_EXECUTOR_TIMEOUT_MS, 10),
            apps_actions_queue_execution_timeout_ms: parseInt(process.env.APPS_ACTIONS_QUEUE_EXECUTION_TIMEOUT_MS, 10),
            timezone: process.env.TIMEZONE,
            db_host: process.env.DB_TEST_HOST,
            db_host_reader: process.env.DB_TEST_HOST_READER,
            db_database: process.env.DB_TEST_DATABASE,
            db_user: process.env.DB_TEST_USER,
            db_password: process.env.DB_TEST_PASSWORD,
            db_auxiliar_user: process.env.DB_TEST_AUXILIAR_USER,
            db_auxiliar_password: process.env.DB_TEST_AUXILIAR_PASSWORD,
            db_name: process.env.DB_TEST_NAME,
            db_port: parseInt(process.env.DB_TEST_PORT, 10),
            db_schema: process.env.DB_TEST_SCHEMA,
            secret_key: process.env.SECRET_KEY,
            secret_iv: process.env.SECRET_IV,
            encryption_method: process.env.ENCRYPTION_METHOD,
            aws_dynamodb_multitenant_table_arn: process.env.AWS_DYNAMODB_MULTITENANT_TABLE_ARN,
            aws_s3_bucket: process.env.AWS_S3_BUCKET,
            aws_s3_access_key_id: process.env.AWS_S3_ACCESS_KEY_ID,
            aws_s3_secret_access_key: process.env.AWS_S3_SECRET_ACCESS_KEY,
            aws_s3_region: process.env.AWS_S3_REGION,
            aws_css_enable: parseInt(process.env.AWS_CSS_ENABLE, 10),
            aws_css_url: process.env.AWS_CSS_URL,
            aws_css_username: process.env.AWS_CSS_USERNAME,
            aws_css_password: process.env.AWS_CSS_PASSWORD,
            aws_cognito_user_pool_id: process.env.AWS_COGNITO_USER_POOL_ID,
            aws_cognito_app_client_id: process.env.AWS_COGNITO_APP_CLIENT_ID,
            aws_cognito_region: process.env.AWS_COGNITO_REGION,
            aws_cognito_url: process.env.AWS_COGNITO_URL,
            aws_sqs_events_queue_arn: process.env.AWS_SQS_EVENTS_QUEUE_ARN,
            aws_eventbridge_event_bus_arn: process.env.AWS_EVENTBRIDGE_EVENT_BUS_ARN,
            aws_sqs_events_queue_url: process.env.AWS_SQS_EVENTS_QUEUE_URL,
            aws_cases_events_queue_url: process.env.AWS_CASES_EVENTS_QUEUE_URL,
            aws_case_post_processing_queue_url: process.env.AWS_CASE_POST_PROCESSING_QUEUE_URL,
            aws_action_jobs_events_queue_url: process.env.AWS_ACTION_JOBS_EVENTS_QUEUE_URL,
            aws_automated_actions_events_queue_url: process.env.AWS_AUTOMATED_ACTIONS_EVENTS_QUEUE_URL,
            aws_ws_rest_events_queue_url: process.env.AWS_WS_REST_EVENTS_QUEUE_URL,
            aws_reports_events_queue_url: process.env.AWS_REPORTS_EVENTS_QUEUE_URL,
            aws_imports_events_queue_url: process.env.AWS_IMPORTS_EVENTS_QUEUE_URL,
        };

        return new Tenant(dto);
    }

    /**
     * Save operation not supported in local repository
     * @throws {Error} Always throws as local repository is read-only
     */
    async save() {
        throw new Error('LocalTenantRepository.save() is not supported in local development mode');
    }

    /**
     * Scan operation not supported in local repository
     * @throws {Error} Always throws as local repository only supports single tenant
     */
    async scan() {
        throw new Error('LocalTenantRepository.scan() is not supported in local development mode');
    }

    /**
     * Delete operation not supported in local repository
     * @throws {Error} Always throws as local repository is read-only
     */
    async delete() {
        throw new Error('LocalTenantRepository.delete() is not supported in local development mode');
    }
}
