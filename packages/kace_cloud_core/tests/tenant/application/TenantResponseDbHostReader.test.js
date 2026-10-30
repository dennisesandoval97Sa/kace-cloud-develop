import { TenantResponse } from '../../../src/tenant/application/TenantResponse.js';
import Tenant from '../../../src/tenant/domain/Tenant.js';

const BASE_DTO = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    subdomain: 'test',
    apps_environment: 'test',
    apps_service_name: 'svc',
    apps_debug: false,
    apps_debug_level: 0,
    apps_domain: 'example.com',
    apps_api_subdomain: 'api',
    apps_admin_subdomain: 'admin',
    apps_allowed_origins: 'https://example.com',
    apps_content_security_policy_domains: 'example.com',
    apps_frame_origins: 'none',
    apps_certificate_domain_arn: 'arn:aws:acm:us-east-1:1:certificate/abc',
    apps_hosted_zone_id: 'Z1',
    apps_execute_rest_hook_service_url: 'https://hooks.example.com',
    apps_timeout_rest_flows_value_ms: 5000,
    apps_actions_queue_executor_timeout_ms: 3000,
    apps_actions_queue_execution_timeout_ms: 3000,
    timezone: 'UTC',
    db_host: 'writer.example.com',
    db_database: 'kace',
    db_user: 'kace_user',
    db_password: 'kace_pass',
    db_auxiliar_user: 'kace_aux',
    db_auxiliar_password: 'kace_aux_pass',
    db_name: 'kace',
    db_port: 5432,
    db_schema: 'public',
    secret_key: 'some-secret-key-32chars-xxxxxxxxxx',
    secret_iv: 'some-iv-16charsxx',
    encryption_method: 'aes-256-cbc',
    aws_dynamodb_multitenant_table_arn: 'arn:aws:dynamodb:us-east-1:1:table/tenants',
    aws_s3_bucket: 'my-bucket',
    aws_s3_access_key_id: 'AKIAIOSFODNN7EXAMPLE',
    aws_s3_secret_access_key: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    aws_s3_region: 'us-east-1',
    aws_css_enable: 0,
    aws_css_url: 'https://css.example.com',
    aws_css_username: 'css_user',
    aws_css_password: 'css_pass',
    aws_cognito_user_pool_id: 'us-east-1_abcdefgh',
    aws_cognito_app_client_id: '1a2b3c4d5e6f7g8h9i0j',
};

describe('TenantResponse — db_host_reader round-trip', () => {
    it('includes db_host_reader in toJson() when present', () => {
        const tenant = new Tenant({ ...BASE_DTO, db_host_reader: 'reader.example.com' });

        const json = new TenantResponse(tenant).toJson();

        expect(json.data.db_host_reader).toBe('reader.example.com');
    });

    it('exposes null/undefined db_host_reader when absent', () => {
        const tenant = new Tenant({ ...BASE_DTO });

        const json = new TenantResponse(tenant).toJson();

        expect(json.data.db_host_reader ?? null).toBeNull();
    });
});
