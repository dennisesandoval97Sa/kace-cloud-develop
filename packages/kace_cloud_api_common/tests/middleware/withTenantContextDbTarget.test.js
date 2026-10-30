import { jest } from '@jest/globals';

jest.unstable_mockModule('@kace/core/src/tenant/infrastructure/aws/DynamoTenantRepository.js', () => {
    return {
        default: jest.fn().mockImplementation(() => ({
            find: jest.fn(),
        })),
    };
});

const { withTenantContext } = await import('../../src/middleware/withTenantContext.js');
const { TenantContextManager } = await import('../../src/middleware/TenantContextManager.js');
const { default: Tenant } = await import('@kace/core/src/tenant/domain/Tenant.js');
const { DbRequestContext } = await import('../../src/db-routing/DbRequestContext.js');
const { TENANT_CONTEXT_ERROR } = await import('@kace/error-codes');

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

const BASE_DTO = {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    subdomain: 't1',
    apps_environment: 'production',
    apps_service_name: 'kace',
    apps_debug: false,
    apps_debug_level: 0,
    apps_domain: 'example.com',
    apps_api_subdomain: 'api',
    apps_admin_subdomain: 'admin',
    apps_allowed_origins: '*',
    apps_content_security_policy_domains: '*',
    apps_frame_origins: '*',
    apps_certificate_domain_arn: 'arn:aws:acm:us-east-1:123456789012:certificate/abc',
    apps_hosted_zone_id: 'Z1234567890',
    apps_execute_rest_hook_service_url: 'https://hooks.example.com',
    apps_timeout_rest_flows_value_ms: 5000,
    apps_actions_queue_executor_timeout_ms: 30000,
    apps_actions_queue_execution_timeout_ms: 60000,
    timezone: 'America/New_York',
    db_host: 'writer.example.com',
    db_host_reader: null,
    db_database: 'kace_db',
    db_user: 'kace_user',
    db_password: 'secret',
    db_auxiliar_user: 'kace_aux',
    db_auxiliar_password: 'aux_secret',
    db_name: 'kace_db',
    db_port: 5432,
    db_schema: 'public',
    secret_key: 'enc-key',
    secret_iv: 'enc-iv',
    encryption_method: 'aes-256-cbc',
    aws_dynamodb_multitenant_table_arn: 'arn:aws:dynamodb:us-east-1:123456789012:table/tenants',
    aws_s3_bucket: 'kace-bucket',
    aws_s3_access_key_id: 'AKIAIOSFODNN7EXAMPLE',
    aws_s3_secret_access_key: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    aws_s3_region: 'us-east-1',
    aws_css_enable: 0,
    aws_css_url: 'https://css.example.com',
    aws_css_username: 'css_user',
    aws_css_password: 'css_pass',
    aws_cognito_user_pool_id: 'us-east-1_ABC123',
    aws_cognito_app_client_id: 'abc123clientid',
};

describe('withTenantContext — DB_TARGET wiring', () => {
    const buildEvent = () => ({ path: '/', headers: { 'x-tenant-id': 't1' }, requestContext: {} });

    afterEach(() => {
        delete process.env.DB_TARGET;
        if (ORIGINAL_NODE_ENV === undefined) {
            delete process.env.NODE_ENV;
        } else {
            process.env.NODE_ENV = ORIGINAL_NODE_ENV;
        }
        TenantContextManager.clearCache();
        jest.restoreAllMocks();
    });

    it('sets preferReplica=true and a readerConfig when DB_TARGET=replica', async () => {
        process.env.DB_TARGET = 'replica';
        const tenant = new Tenant({ ...BASE_DTO, db_host_reader: 'reader.example.com' });
        jest.spyOn(TenantContextManager, 'getTenant').mockResolvedValue(tenant);

        let captured;
        const handler = async (event) => {
            captured = event.tenantContext;
            return { statusCode: 200 };
        };

        await withTenantContext(handler)(buildEvent(), { requestId: 'r' });

        expect(captured.preferReplica).toBe(true);
        expect(captured.readerConfig.connection.host).toBe('reader.example.com');
        expect(captured.knexConfig.connection.host).toBe(BASE_DTO.db_host);
    });

    it('defaults to preferReplica=false (primary) when DB_TARGET is unset', async () => {
        const tenant = new Tenant({ ...BASE_DTO, db_host_reader: 'reader.example.com' });
        jest.spyOn(TenantContextManager, 'getTenant').mockResolvedValue(tenant);

        let captured;
        const handler = async (event) => {
            captured = event.tenantContext;
            return { statusCode: 200 };
        };

        await withTenantContext(handler)(buildEvent(), { requestId: 'r' });

        expect(captured.preferReplica).toBe(false);
        expect(captured.readerConfig.connection.host).toBe(BASE_DTO.db_host);
    });

    it('executes the handler inside a DbRequestContext store (write flag is request-scoped)', async () => {
        const tenant = new Tenant({ ...BASE_DTO });
        jest.spyOn(TenantContextManager, 'getTenant').mockResolvedValue(tenant);

        let hasWrittenInsideHandler;
        const handler = async () => {
            DbRequestContext.markWrite();
            hasWrittenInsideHandler = DbRequestContext.hasWritten();
            return { statusCode: 200 };
        };

        await withTenantContext(handler)(buildEvent(), { requestId: 'r' });

        expect(hasWrittenInsideHandler).toBe(true);
    });

    it('returns a public tenant-context error without leaking tenant lookup details', async () => {
        process.env.NODE_ENV = 'production';
        jest.spyOn(TenantContextManager, 'getTenant').mockRejectedValue(new Error('Tenant not found: secret-tenant'));

        const response = await withTenantContext(async () => ({ statusCode: 200 }))(buildEvent(), {
            requestId: 'tenant-context-request-1',
        });
        const body = JSON.parse(response.body);

        expect(response.statusCode).toBe(404);
        expect(body).toEqual({
            message: 'Not found',
            data: { code: TENANT_CONTEXT_ERROR },
            metadata: { request_id: 'tenant-context-request-1' },
            errors: [{ code: TENANT_CONTEXT_ERROR, message: 'Not found' }],
        });
        expect(response.body).not.toContain('secret-tenant');
        expect(response.body).not.toContain('TenantContextError');
    });
});
