import Tenant from '../../../src/tenant/domain/Tenant.js';

const BASE_DTO = {
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

describe('Tenant — 5 per-BC events queue URL fields', () => {
    describe('constructor hydration from DTO', () => {
        it('should hydrate aws_cases_events_queue_url from its OWN DTO key', () => {
            // Arrange
            const url = 'https://sqs.us-east-1.amazonaws.com/123456789012/cases-events.fifo';
            const dto = { ...BASE_DTO, aws_cases_events_queue_url: url };

            // Act
            const tenant = new Tenant(dto);

            // Assert
            expect(tenant.aws_cases_events_queue_url.value).toBe(url);
        });

        it('should hydrate aws_action_jobs_events_queue_url from its OWN DTO key', () => {
            // Arrange
            const url = 'https://sqs.us-east-1.amazonaws.com/123456789012/action-jobs-events.fifo';
            const dto = { ...BASE_DTO, aws_action_jobs_events_queue_url: url };

            // Act
            const tenant = new Tenant(dto);

            // Assert
            expect(tenant.aws_action_jobs_events_queue_url.value).toBe(url);
        });

        it('should hydrate aws_automated_actions_events_queue_url from its OWN DTO key', () => {
            // Arrange
            const url = 'https://sqs.us-east-1.amazonaws.com/123456789012/automated-actions-events.fifo';
            const dto = { ...BASE_DTO, aws_automated_actions_events_queue_url: url };

            // Act
            const tenant = new Tenant(dto);

            // Assert
            expect(tenant.aws_automated_actions_events_queue_url.value).toBe(url);
        });

        it('should hydrate aws_ws_rest_events_queue_url from its OWN DTO key', () => {
            // Arrange
            const url = 'https://sqs.us-east-1.amazonaws.com/123456789012/ws-rest-events.fifo';
            const dto = { ...BASE_DTO, aws_ws_rest_events_queue_url: url };

            // Act
            const tenant = new Tenant(dto);

            // Assert
            expect(tenant.aws_ws_rest_events_queue_url.value).toBe(url);
        });

        it('should hydrate aws_reports_events_queue_url from its OWN DTO key', () => {
            // Arrange
            const url = 'https://sqs.us-east-1.amazonaws.com/123456789012/reports-events.fifo';
            const dto = { ...BASE_DTO, aws_reports_events_queue_url: url };

            // Act
            const tenant = new Tenant(dto);

            // Assert
            expect(tenant.aws_reports_events_queue_url.value).toBe(url);
        });

        it('should accept null values (nullable fields)', () => {
            // Arrange
            const dto = {
                ...BASE_DTO,
                aws_cases_events_queue_url: null,
                aws_action_jobs_events_queue_url: null,
                aws_automated_actions_events_queue_url: null,
                aws_ws_rest_events_queue_url: null,
                aws_reports_events_queue_url: null,
            };

            // Act
            const tenant = new Tenant(dto);

            // Assert
            expect(tenant.aws_cases_events_queue_url.value).toBeNull();
            expect(tenant.aws_action_jobs_events_queue_url.value).toBeNull();
            expect(tenant.aws_automated_actions_events_queue_url.value).toBeNull();
            expect(tenant.aws_ws_rest_events_queue_url.value).toBeNull();
            expect(tenant.aws_reports_events_queue_url.value).toBeNull();
        });

        it('should not cross-assign fields (each field reads its own DTO key)', () => {
            // Arrange — give each field a distinct URL so a cross-assignment would be detectable
            const dto = {
                ...BASE_DTO,
                aws_cases_events_queue_url: 'https://sqs.us-east-1.amazonaws.com/111/cases.fifo',
                aws_action_jobs_events_queue_url: 'https://sqs.us-east-1.amazonaws.com/222/action-jobs.fifo',
                aws_automated_actions_events_queue_url:
                    'https://sqs.us-east-1.amazonaws.com/333/automated-actions.fifo',
                aws_ws_rest_events_queue_url: 'https://sqs.us-east-1.amazonaws.com/444/ws-rest.fifo',
                aws_reports_events_queue_url: 'https://sqs.us-east-1.amazonaws.com/555/reports.fifo',
            };

            // Act
            const tenant = new Tenant(dto);

            // Assert — each getter returns the value from its own DTO key
            expect(tenant.aws_cases_events_queue_url.value).toBe(dto.aws_cases_events_queue_url);
            expect(tenant.aws_action_jobs_events_queue_url.value).toBe(dto.aws_action_jobs_events_queue_url);
            expect(tenant.aws_automated_actions_events_queue_url.value).toBe(
                dto.aws_automated_actions_events_queue_url
            );
            expect(tenant.aws_ws_rest_events_queue_url.value).toBe(dto.aws_ws_rest_events_queue_url);
            expect(tenant.aws_reports_events_queue_url.value).toBe(dto.aws_reports_events_queue_url);
        });
    });

    describe('setters update changedAttributes', () => {
        it('aws_cases_events_queue_url setter updates changedAttributes', () => {
            // Arrange
            const newUrl = 'https://sqs.us-east-1.amazonaws.com/123456789012/cases-updated.fifo';
            const tenant = new Tenant({ ...BASE_DTO, aws_cases_events_queue_url: null });

            // Act
            tenant.aws_cases_events_queue_url = newUrl;

            // Assert
            expect(tenant.aws_cases_events_queue_url.value).toBe(newUrl);
            expect(tenant.changedAttributes.aws_cases_events_queue_url).toBe(newUrl);
        });

        it('aws_action_jobs_events_queue_url setter updates changedAttributes', () => {
            // Arrange
            const newUrl = 'https://sqs.us-east-1.amazonaws.com/123456789012/action-jobs-updated.fifo';
            const tenant = new Tenant({ ...BASE_DTO, aws_action_jobs_events_queue_url: null });

            // Act
            tenant.aws_action_jobs_events_queue_url = newUrl;

            // Assert
            expect(tenant.aws_action_jobs_events_queue_url.value).toBe(newUrl);
            expect(tenant.changedAttributes.aws_action_jobs_events_queue_url).toBe(newUrl);
        });

        it('aws_automated_actions_events_queue_url setter updates changedAttributes', () => {
            // Arrange
            const newUrl = 'https://sqs.us-east-1.amazonaws.com/123456789012/automated-actions-updated.fifo';
            const tenant = new Tenant({ ...BASE_DTO, aws_automated_actions_events_queue_url: null });

            // Act
            tenant.aws_automated_actions_events_queue_url = newUrl;

            // Assert
            expect(tenant.aws_automated_actions_events_queue_url.value).toBe(newUrl);
            expect(tenant.changedAttributes.aws_automated_actions_events_queue_url).toBe(newUrl);
        });

        it('aws_ws_rest_events_queue_url setter updates changedAttributes', () => {
            // Arrange
            const newUrl = 'https://sqs.us-east-1.amazonaws.com/123456789012/ws-rest-updated.fifo';
            const tenant = new Tenant({ ...BASE_DTO, aws_ws_rest_events_queue_url: null });

            // Act
            tenant.aws_ws_rest_events_queue_url = newUrl;

            // Assert
            expect(tenant.aws_ws_rest_events_queue_url.value).toBe(newUrl);
            expect(tenant.changedAttributes.aws_ws_rest_events_queue_url).toBe(newUrl);
        });

        it('aws_reports_events_queue_url setter updates changedAttributes', () => {
            // Arrange
            const newUrl = 'https://sqs.us-east-1.amazonaws.com/123456789012/reports-updated.fifo';
            const tenant = new Tenant({ ...BASE_DTO, aws_reports_events_queue_url: null });

            // Act
            tenant.aws_reports_events_queue_url = newUrl;

            // Assert
            expect(tenant.aws_reports_events_queue_url.value).toBe(newUrl);
            expect(tenant.changedAttributes.aws_reports_events_queue_url).toBe(newUrl);
        });

        it('setter does NOT touch changedAttributes when assigned the current value', () => {
            const url = 'https://sqs.us-east-1.amazonaws.com/123456789012/cases-events.fifo';
            const tenant = new Tenant({ ...BASE_DTO, aws_cases_events_queue_url: url });

            tenant.aws_cases_events_queue_url = url; // same value → no-op

            expect(tenant.changedAttributes.aws_cases_events_queue_url).toBeUndefined();
        });
    });
});

describe('Tenant — aws_case_post_processing_queue_url (per-BC post-processing queue)', () => {
    it('should hydrate aws_case_post_processing_queue_url from its OWN DTO key', () => {
        // Arrange
        const url = 'https://sqs.us-east-1.amazonaws.com/123456789012/case-post-processing.fifo';
        const dto = { ...BASE_DTO, aws_case_post_processing_queue_url: url };

        // Act
        const tenant = new Tenant(dto);

        // Assert
        expect(tenant.aws_case_post_processing_queue_url.value).toBe(url);
    });

    it('should round-trip aws_case_post_processing_queue_url through toJson()', () => {
        // Arrange
        const url = 'https://sqs.us-east-1.amazonaws.com/123456789012/case-post-processing.fifo';
        const dto = { ...BASE_DTO, aws_case_post_processing_queue_url: url };

        // Act
        const json = new Tenant(dto).toJson();

        // Assert
        expect(json.aws_case_post_processing_queue_url).toBe(url);
    });

    it('should be optional/nullable — building WITHOUT the field does not throw and exposes null', () => {
        // Arrange — BASE_DTO does NOT include aws_case_post_processing_queue_url
        let tenant;

        // Act / Assert — backward compatible: absent nullable field does not throw and exposes no value
        expect(() => {
            tenant = new Tenant(BASE_DTO);
        }).not.toThrow();
        expect(tenant.aws_case_post_processing_queue_url.value).toBeUndefined();
    });

    it('should accept an explicit null value (nullable field)', () => {
        // Arrange
        const dto = { ...BASE_DTO, aws_case_post_processing_queue_url: null };

        // Act
        const tenant = new Tenant(dto);

        // Assert
        expect(tenant.aws_case_post_processing_queue_url.value).toBeNull();
    });

    it('setter updates changedAttributes', () => {
        // Arrange
        const newUrl = 'https://sqs.us-east-1.amazonaws.com/123456789012/case-post-processing-updated.fifo';
        const tenant = new Tenant({ ...BASE_DTO, aws_case_post_processing_queue_url: null });

        // Act
        tenant.aws_case_post_processing_queue_url = newUrl;

        // Assert
        expect(tenant.aws_case_post_processing_queue_url.value).toBe(newUrl);
        expect(tenant.changedAttributes.aws_case_post_processing_queue_url).toBe(newUrl);
    });

    it('setter does NOT touch changedAttributes when assigned the current value', () => {
        // Arrange
        const url = 'https://sqs.us-east-1.amazonaws.com/123456789012/case-post-processing.fifo';
        const tenant = new Tenant({ ...BASE_DTO, aws_case_post_processing_queue_url: url });

        // Act
        tenant.aws_case_post_processing_queue_url = url; // same value → no-op

        // Assert
        expect(tenant.changedAttributes.aws_case_post_processing_queue_url).toBeUndefined();
    });
});

describe('Tenant — worker schedule settings (per-tenant overrides)', () => {
    const FIELDS = [
        'apps_worker_fast_cron_expression',
        'apps_worker_ans_cron_expression',
        'apps_assignment_backlog_cron_expression',
    ];

    it('should hydrate every setting from its own key and round-trip it through toJson()', () => {
        // Arrange
        const values = {
            apps_worker_fast_cron_expression: '*/2 * * * *',
            apps_worker_ans_cron_expression: '*/10 * * * *',
            apps_assignment_backlog_cron_expression: '1-59/5 * * * *',
        };

        // Act
        const tenant = new Tenant({ ...BASE_DTO, ...values });
        const json = tenant.toJson();

        // Assert
        for (const [field, value] of Object.entries(values)) {
            expect(tenant[field].value).toBe(value);
            expect(json[field]).toBe(value);
        }
    });

    it('should be optional — a tenant without them builds and exposes undefined', () => {
        // Act
        const tenant = new Tenant(BASE_DTO);

        // Assert
        for (const field of FIELDS) {
            expect(tenant[field].value).toBeUndefined();
        }
    });

    // The worker scans every tenant: a mistyped value in one record must not break hydration of all.
    it('should not throw on a mistyped value (validated by the worker, not on hydration)', () => {
        // Arrange
        const dto = {
            ...BASE_DTO,
            apps_worker_fast_cron_expression: 5,
            apps_worker_ans_cron_expression: { pattern: '*/5 * * * *' },
            apps_assignment_backlog_cron_expression: 5,
        };

        // Act / Assert
        expect(() => new Tenant(dto)).not.toThrow();
    });

    it.each(FIELDS)('setter of %s updates changedAttributes only when the value changes', (field) => {
        // Arrange
        const tenant = new Tenant({ ...BASE_DTO, [field]: 'current' });

        // Act
        tenant[field] = 'current';
        const unchanged = tenant.changedAttributes[field];
        tenant[field] = 'new';

        // Assert
        expect(unchanged).toBeUndefined();
        expect(tenant[field].value).toBe('new');
        expect(tenant.changedAttributes[field]).toBe('new');
    });
});
