export class TenantResponse {
    /** @type {Tenant} is initialized in the constructor */
    #tenant;

    constructor(tenant) {
        this.#tenant = tenant;
    }

    /**
     * Converts the Tenant object to a JSON representation.
     *
     * @returns {Object} A plain object containing the Tenant data.
     */
    toJson() {
        return {
            data: {
                id: this.#tenant.id.value,
                subdomain: this.#tenant.subdomain.value,
                apps_environment: this.#tenant.apps_environment.value,
                apps_service_name: this.#tenant.apps_service_name.value,
                apps_debug: this.#tenant.apps_debug.value,
                apps_debug_level: this.#tenant.apps_debug_level.value,
                apps_domain: this.#tenant.apps_domain.value,
                apps_api_subdomain: this.#tenant.apps_api_subdomain.value,
                apps_admin_subdomain: this.#tenant.apps_admin_subdomain.value,
                apps_allowed_origins: this.#tenant.apps_allowed_origins.value,
                apps_content_security_policy_domains: this.#tenant.apps_content_security_policy_domains.value,
                apps_frame_origins: this.#tenant.apps_frame_origins.value,
                apps_certificate_domain_arn: this.#tenant.apps_certificate_domain_arn.value,
                apps_hosted_zone_id: this.#tenant.apps_hosted_zone_id.value,
                apps_execute_rest_hook_service_url: this.#tenant.apps_execute_rest_hook_service_url.value,
                apps_timeout_rest_flows_value_ms: this.#tenant.apps_timeout_rest_flows_value_ms.value,
                apps_actions_queue_executor_timeout_ms: this.#tenant.apps_actions_queue_executor_timeout_ms.value,
                apps_actions_queue_execution_timeout_ms: this.#tenant.apps_actions_queue_execution_timeout_ms.value,
                timezone: this.#tenant.timezone.value,
                db_host: this.#tenant.db_host.value,
                db_host_reader: this.#tenant.db_host_reader.value,
                db_database: this.#tenant.db_database.value,
                db_user: this.#tenant.db_user.value,
                db_password: this.#tenant.db_password.value,
                db_auxiliar_user: this.#tenant.db_auxiliar_user.value,
                db_auxiliar_password: this.#tenant.db_auxiliar_password.value,
                db_name: this.#tenant.db_name.value,
                db_port: this.#tenant.db_port.value,
                db_schema: this.#tenant.db_schema.value,
                secret_key: this.#tenant.secret_key.value,
                secret_iv: this.#tenant.secret_iv.value,
                encryption_method: this.#tenant.encryption_method.value,
                aws_dynamodb_multitenant_table_arn: this.#tenant.aws_dynamodb_multitenant_table_arn.value,
                aws_s3_bucket: this.#tenant.aws_s3_bucket.value,
                aws_s3_access_key_id: this.#tenant.aws_s3_access_key_id.value,
                aws_s3_secret_access_key: this.#tenant.aws_s3_secret_access_key.value,
                aws_s3_region: this.#tenant.aws_s3_region.value,
                aws_css_enable: this.#tenant.aws_css_enable.value,
                aws_css_url: this.#tenant.aws_css_url.value,
                aws_css_username: this.#tenant.aws_css_username.value,
                aws_css_password: this.#tenant.aws_css_password.value,
                aws_cognito_user_pool_id: this.#tenant.aws_cognito_user_pool_id.value,
                aws_cognito_app_client_id: this.#tenant.aws_cognito_app_client_id.value,
                aws_cognito_region: this.#tenant.aws_cognito_region.value,
                aws_cognito_url: this.#tenant.aws_cognito_url.value,
                aws_cognito_identity_provider: this.#tenant.aws_cognito_identity_provider.value,
                aws_cognito_response_type: this.#tenant.aws_cognito_response_type.value,
                aws_cognito_scope: this.#tenant.aws_cognito_scope.value,
                aws_cognito_redirect_to_exchange: this.#tenant.aws_cognito_redirect_to_exchange.value,
                aws_cognito_redirect_to_frontend: this.#tenant.aws_cognito_redirect_to_frontend.value,
            },
        };
    }
}
