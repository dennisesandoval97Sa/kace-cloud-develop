import Tenant from '@kace/core/src/tenant/domain/Tenant.js';
import { ANS_SCHEDULE, BACKLOG_SCHEDULE, FAST_SCHEDULE, resolveTenantCron } from '../src/tenantCronSelector.mjs';

// Guards the field names shared with @kace/core: a rename there must not silently fall back to defaults.
describe('worker schedule settings with a real Tenant', () => {
    const dto = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        subdomain: 'test',
        apps_environment: 'test',
        apps_service_name: 'test-service',
        apps_debug: false,
        apps_debug_level: 0,
        apps_domain: 'example.com',
        apps_api_subdomain: 'api',
        apps_admin_subdomain: 'admin',
        apps_allowed_origins: 'https://example.com',
        apps_content_security_policy_domains: 'example.com',
        apps_frame_origins: 'none',
        apps_certificate_domain_arn: 'arn:aws:acm:us-east-1:123456789012:certificate/abc',
        apps_hosted_zone_id: 'Z1234567890ABC',
        apps_execute_rest_hook_service_url: 'https://hooks.example.com',
        apps_timeout_rest_flows_value_ms: 5000,
        apps_actions_queue_executor_timeout_ms: 3000,
        apps_actions_queue_execution_timeout_ms: 3000,
        timezone: 'UTC',
        db_host: 'localhost',
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
        aws_dynamodb_multitenant_table_arn: 'arn:aws:dynamodb:us-east-1:123456789012:table/tenants',
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

    it('reads the crons stored in the tenant record', () => {
        const tenant = new Tenant({
            ...dto,
            apps_worker_fast_cron_expression: '*/2 * * * *',
            apps_worker_ans_cron_expression: '*/10 * * * *',
            apps_assignment_backlog_cron_expression: '1-59/10 * * * *',
        });

        expect(resolveTenantCron(tenant, FAST_SCHEDULE).getPattern()).toBe('*/2 * * * *');
        expect(resolveTenantCron(tenant, ANS_SCHEDULE).getPattern()).toBe('*/10 * * * *');
        expect(resolveTenantCron(tenant, BACKLOG_SCHEDULE).getPattern()).toBe('1-59/10 * * * *');
    });
});
