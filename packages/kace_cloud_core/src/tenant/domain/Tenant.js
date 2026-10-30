import { AggregateRoot, Helper, ValueObject, ValueObjectInt, ValueObjectString } from '../../shared/index.js';

export default class Tenant extends AggregateRoot {
    /** @type {ValueObjectString} */
    #subdomain; // Initialized in the constructor
    /** @type {ValueObjectString} */
    #apps_environment; // Initialized in the constructor
    /** @type {ValueObjectString} */
    #apps_service_name; // Initialized in the constructor
    /** @type {ValueObject} */
    #apps_debug; // Initialized in the constructor
    /** @type {ValueObjectInt} */
    #apps_debug_level; // Initialized in the constructor
    /** @type {ValueObjectString} */
    #apps_domain; // Initialized in the constructor
    /** @type {ValueObjectString} */
    #apps_api_subdomain; // Initialized in the constructor
    /** @type {ValueObjectString} */
    #apps_admin_subdomain; // Initialized in the constructor
    /** @type {ValueObjectString} */
    #apps_allowed_origins; // Initialized in the constructor
    /** @type {ValueObjectString} */
    #apps_content_security_policy_domains; // Initialized in the constructor
    /** @type {ValueObjectString} */
    #apps_frame_origins; // Initialized in the constructor
    /** @type {ValueObjectString} */
    #apps_certificate_domain_arn; // Initialized in the constructor
    /** @type {ValueObjectString} */
    #apps_hosted_zone_id; // Initialized in the constructor
    /** @type {ValueObjectString} */
    #apps_execute_rest_hook_service_url; // Initialized in the constructor
    /** @type {ValueObjectInt} */
    #apps_timeout_rest_flows_value_ms; // Initialized in the constructor
    /** @type {ValueObjectInt} */
    #apps_actions_queue_executor_timeout_ms; // Initialized in the constructor
    /** @type {ValueObjectInt} */
    #apps_actions_queue_execution_timeout_ms; // Initialized in the constructor
    /** @type {ValueObjectString} */
    #timezone; // Initialized in the constructor
    /** @type {ValueObjectString} */
    #db_host; // Initialized in the constructor
    /** @type {ValueObjectString} */
    #db_host_reader; // Initialized in the constructor (nullable)
    /** @type {ValueObjectString} */
    #db_database; // Initialized in the constructor
    /** @type {ValueObjectString} */
    #db_user; // Initialized in the constructor
    /** @type {ValueObjectString} */
    #db_password; // Initialized in the constructor
    /** @type {ValueObjectString} */
    #db_auxiliar_user; // Initialized in the constructor
    /** @type {ValueObjectString} */
    #db_auxiliar_password; // Initialized in the constructor
    /** @type {ValueObjectString} */
    #db_name; // Initialized in the constructor
    /** @type {ValueObjectInt} */
    #db_port; // Initialized in the constructor
    /** @type {ValueObjectString} */
    #db_schema; // Initialized in the constructor
    /** @type {ValueObjectString} */
    #secret_key; // Initialized in the constructor
    /** @type {ValueObjectString} */
    #secret_iv; // Initialized in the constructor
    /** @type {ValueObjectString} */
    #encryption_method; // Initialized in the constructor
    /** @type {ValueObjectString} */
    #aws_dynamodb_multitenant_table_arn; // Initialized in the constructor

    /** @type {ValueObjectString} */
    #aws_s3_bucket; //Initialized in the constructor
    /** @type {ValueObjectString} */
    #aws_s3_access_key_id; //Initialized in the constructor
    /** @type {ValueObjectString} */
    #aws_s3_secret_access_key; //Initialized in the constructor
    /** @type {ValueObjectString} */
    #aws_s3_region; //Initialized in the constructor

    /** @type {ValueObjectInt} */
    #aws_css_enable; //Initialized in the constructor
    /** @type {ValueObjectString} */
    #aws_css_url; //Initialized in the constructor
    /** @type {ValueObjectString} */
    #aws_css_username; //Initialized in the constructor
    /** @type {ValueObjectString} */
    #aws_css_password; //Initialized in the constructor

    /** @type {ValueObjectString} */
    #aws_cognito_user_pool_id; //Initialized in the constructor
    /** @type {ValueObjectString} */
    #aws_cognito_app_client_id; //Initialized in the constructor
    /** @type {ValueObjectString} */
    #aws_cognito_region; //Initialized in the constructor
    /** @type {ValueObjectString} */
    #aws_cognito_url;
    /** @type {ValueObjectString} */
    #aws_cognito_identity_provider;

    get aws_cognito_identity_provider() {
        return this.#aws_cognito_identity_provider;
    }

    set aws_cognito_identity_provider(value) {
        if (this.#aws_cognito_identity_provider.value !== value) {
            this.#aws_cognito_identity_provider = new ValueObjectString('aws_cognito_identity_provider', value, true);
            this.changedAttributes.aws_cognito_identity_provider = value;
        }
    }
    /** @type {ValueObjectString} */
    #aws_cognito_response_type;

    get aws_cognito_response_type() {
        return this.#aws_cognito_response_type;
    }

    set aws_cognito_response_type(value) {
        if (this.#aws_cognito_response_type.value !== value) {
            this.#aws_cognito_response_type = new ValueObjectString('aws_cognito_response_type', value, true);
            this.changedAttributes.aws_cognito_response_type = value;
        }
    }
    /** @type {ValueObjectString} */
    #aws_cognito_scope;

    get aws_cognito_scope() {
        return this.#aws_cognito_scope;
    }

    set aws_cognito_scope(value) {
        if (this.#aws_cognito_scope.value !== value) {
            this.#aws_cognito_scope = new ValueObjectString('aws_cognito_scope', value, true);
            this.changedAttributes.aws_cognito_scope = value;
        }
    }

    /** @type {ValueObjectString} */
    #aws_cognito_redirect_to_exchange;

    get aws_cognito_redirect_to_exchange() {
        return this.#aws_cognito_redirect_to_exchange;
    }

    set aws_cognito_redirect_to_exchange(value) {
        if (this.#aws_cognito_redirect_to_exchange.value !== value) {
            this.#aws_cognito_redirect_to_exchange = new ValueObjectString(
                'aws_cognito_redirect_to_exchange',
                value,
                true
            );
            this.changedAttributes.aws_cognito_redirect_to_exchange = value;
        }
    }

    /** @type {ValueObjectString} */
    #aws_cognito_redirect_to_frontend;

    get aws_cognito_redirect_to_frontend() {
        return this.#aws_cognito_redirect_to_frontend;
    }

    set aws_cognito_redirect_to_frontend(value) {
        if (this.#aws_cognito_redirect_to_frontend.value !== value) {
            this.#aws_cognito_redirect_to_frontend = new ValueObjectString(
                'aws_cognito_redirect_to_frontend',
                value,
                true
            );
            this.changedAttributes.aws_cognito_redirect_to_frontend = value;
        }
    }

    /** @type {ValueObjectString} */
    #aws_sqs_region; // is initialized in the constructor
    get aws_sqs_region() {
        return this.#aws_sqs_region;
    }

    set aws_sqs_region(value) {
        if (this.#aws_sqs_region.value !== value) {
            this.#aws_sqs_region = new ValueObjectString('aws_sqs_region', value, true);
            this.changedAttributes.aws_sqs_region = value;
        }
    }

    /** @type {ValueObjectString} */
    #aws_sqs_events_queue_url; // is initialized in the constructor
    get aws_sqs_events_queue_url() {
        return this.#aws_sqs_events_queue_url;
    }

    set aws_sqs_events_queue_url(value) {
        if (this.#aws_sqs_events_queue_url.value !== value) {
            this.#aws_sqs_events_queue_url = new ValueObjectString('aws_sqs_events_queue_url', value, true);
            this.changedAttributes.aws_sqs_events_queue_url = value;
        }
    }

    /** @type {ValueObjectString} */
    #aws_event_bridge_region; // is initialized in the constructor
    get aws_event_bridge_region() {
        return this.#aws_event_bridge_region;
    }

    set aws_event_bridge_region(value) {
        if (this.#aws_event_bridge_region.value !== value) {
            this.#aws_event_bridge_region = new ValueObjectString('aws_event_bridge_region', value, true);
            this.changedAttributes.aws_event_bridge_region = value;
        }
    }

    /** @type {ValueObjectString} */
    #aws_event_bridge_event_bus_name; // is initialized in the constructor
    get aws_event_bridge_event_bus_name() {
        return this.#aws_event_bridge_event_bus_name;
    }

    set aws_event_bridge_event_bus_name(value) {
        if (this.#aws_event_bridge_event_bus_name.value !== value) {
            this.#aws_event_bridge_event_bus_name = new ValueObjectString(
                'aws_event_bridge_event_bus_name',
                value,
                true
            );
            this.changedAttributes.aws_event_bridge_event_bus_name = value;
        }
    }

    /** @type {ValueObjectString} */
    #aws_cases_events_queue_url; // is initialized in the constructor
    get aws_cases_events_queue_url() {
        return this.#aws_cases_events_queue_url;
    }

    set aws_cases_events_queue_url(value) {
        if (this.#aws_cases_events_queue_url.value !== value) {
            this.#aws_cases_events_queue_url = new ValueObjectString('aws_cases_events_queue_url', value, true);
            this.changedAttributes.aws_cases_events_queue_url = value;
        }
    }

    /** @type {ValueObjectString} */
    #aws_case_post_processing_queue_url; // is initialized in the constructor
    get aws_case_post_processing_queue_url() {
        return this.#aws_case_post_processing_queue_url;
    }

    set aws_case_post_processing_queue_url(value) {
        if (this.#aws_case_post_processing_queue_url.value !== value) {
            this.#aws_case_post_processing_queue_url = new ValueObjectString(
                'aws_case_post_processing_queue_url',
                value,
                true
            );
            this.changedAttributes.aws_case_post_processing_queue_url = value;
        }
    }

    /** @type {ValueObjectString} */
    #aws_action_jobs_events_queue_url; // is initialized in the constructor
    get aws_action_jobs_events_queue_url() {
        return this.#aws_action_jobs_events_queue_url;
    }

    set aws_action_jobs_events_queue_url(value) {
        if (this.#aws_action_jobs_events_queue_url.value !== value) {
            this.#aws_action_jobs_events_queue_url = new ValueObjectString(
                'aws_action_jobs_events_queue_url',
                value,
                true
            );
            this.changedAttributes.aws_action_jobs_events_queue_url = value;
        }
    }

    /** @type {ValueObjectString} */
    #aws_automated_actions_events_queue_url; // is initialized in the constructor
    get aws_automated_actions_events_queue_url() {
        return this.#aws_automated_actions_events_queue_url;
    }

    set aws_automated_actions_events_queue_url(value) {
        if (this.#aws_automated_actions_events_queue_url.value !== value) {
            this.#aws_automated_actions_events_queue_url = new ValueObjectString(
                'aws_automated_actions_events_queue_url',
                value,
                true
            );
            this.changedAttributes.aws_automated_actions_events_queue_url = value;
        }
    }

    /** @type {ValueObjectString} */
    #aws_ws_rest_events_queue_url; // is initialized in the constructor
    get aws_ws_rest_events_queue_url() {
        return this.#aws_ws_rest_events_queue_url;
    }

    set aws_ws_rest_events_queue_url(value) {
        if (this.#aws_ws_rest_events_queue_url.value !== value) {
            this.#aws_ws_rest_events_queue_url = new ValueObjectString('aws_ws_rest_events_queue_url', value, true);
            this.changedAttributes.aws_ws_rest_events_queue_url = value;
        }
    }

    /** @type {ValueObjectString} */
    #aws_reports_events_queue_url; // is initialized in the constructor
    get aws_reports_events_queue_url() {
        return this.#aws_reports_events_queue_url;
    }

    set aws_reports_events_queue_url(value) {
        if (this.#aws_reports_events_queue_url.value !== value) {
            this.#aws_reports_events_queue_url = new ValueObjectString('aws_reports_events_queue_url', value, true);
            this.changedAttributes.aws_reports_events_queue_url = value;
        }
    }

    /** @type {ValueObjectString} */
    #aws_imports_events_queue_url; // is initialized in the constructor
    get aws_imports_events_queue_url() {
        return this.#aws_imports_events_queue_url;
    }

    set aws_imports_events_queue_url(value) {
        if (this.#aws_imports_events_queue_url?.value !== value) {
            this.#aws_imports_events_queue_url = new ValueObjectString('aws_imports_events_queue_url', value, true);
            this.changedAttributes.aws_imports_events_queue_url = value;
        }
    }

    /** @type {ValueObjectString} */
    #channel_hub_user; // is initialized in the constructor
    get channel_hub_user() {
        return this.#channel_hub_user;
    }

    set channel_hub_user(value) {
        if (this.#channel_hub_user.value !== value) {
            this.#channel_hub_user = new ValueObjectString('channel_hub_user', value, true);
            this.changedAttributes.channel_hub_user = value;
        }
    }

    /** @type {ValueObjectString} */
    #channel_hub_password; // is initialized in the constructor
    get channel_hub_password() {
        return this.#channel_hub_password;
    }

    set channel_hub_password(value) {
        if (this.#channel_hub_password.value !== value) {
            this.#channel_hub_password = new ValueObjectString('channel_hub_password', value, true);
            this.changedAttributes.channel_hub_password = value;
        }
    }

    /** @type {ValueObjectString} */
    #webhook_api_key; // is initialized in the constructor
    get webhook_api_key() {
        return this.#webhook_api_key;
    }

    set webhook_api_key(value) {
        if (this.#webhook_api_key.value !== value) {
            this.#webhook_api_key = new ValueObjectString('webhook_api_key', value, true);
            this.changedAttributes.webhook_api_key = value;
        }
    }

    // Worker schedule overrides (actions_queue_executions worker). Untyped on purpose: the worker scans
    // every tenant, so a mistyped value here must not break hydration; the worker validates them.
    /** @type {ValueObject} */
    #apps_worker_fast_cron_expression; // is initialized in the constructor
    get apps_worker_fast_cron_expression() {
        return this.#apps_worker_fast_cron_expression;
    }

    set apps_worker_fast_cron_expression(value) {
        if (this.#apps_worker_fast_cron_expression.value !== value) {
            this.#apps_worker_fast_cron_expression = new ValueObject('apps_worker_fast_cron_expression', value);
            this.changedAttributes.apps_worker_fast_cron_expression = value;
        }
    }

    /** @type {ValueObject} */
    #apps_worker_ans_cron_expression; // is initialized in the constructor
    get apps_worker_ans_cron_expression() {
        return this.#apps_worker_ans_cron_expression;
    }

    set apps_worker_ans_cron_expression(value) {
        if (this.#apps_worker_ans_cron_expression.value !== value) {
            this.#apps_worker_ans_cron_expression = new ValueObject('apps_worker_ans_cron_expression', value);
            this.changedAttributes.apps_worker_ans_cron_expression = value;
        }
    }

    /** @type {ValueObject} */
    #apps_assignment_backlog_cron_expression; // is initialized in the constructor
    get apps_assignment_backlog_cron_expression() {
        return this.#apps_assignment_backlog_cron_expression;
    }

    set apps_assignment_backlog_cron_expression(value) {
        if (this.#apps_assignment_backlog_cron_expression.value !== value) {
            this.#apps_assignment_backlog_cron_expression = new ValueObject(
                'apps_assignment_backlog_cron_expression',
                value
            );
            this.changedAttributes.apps_assignment_backlog_cron_expression = value;
        }
    }

    constructor(dto) {
        super(dto.id);
        try {
            this.#subdomain = new ValueObjectString('subdomain', dto.subdomain, false);
            this.#apps_environment = new ValueObjectString('apps_environment', dto.apps_environment, false);
            this.#apps_service_name = new ValueObjectString('apps_service_name', dto.apps_service_name, false);
            this.#apps_debug = new ValueObject('apps_debug', dto.apps_debug, false);
            this.#apps_debug_level = new ValueObjectInt('apps_debug_level', dto.apps_debug_level, false);
            this.#apps_domain = new ValueObjectString('apps_domain', dto.apps_domain, false);
            this.#apps_api_subdomain = new ValueObjectString('apps_api_subdomain', dto.apps_api_subdomain, false);
            this.#apps_admin_subdomain = new ValueObjectString('apps_admin_subdomain', dto.apps_admin_subdomain, false);
            this.#apps_allowed_origins = new ValueObjectString('apps_allowed_origins', dto.apps_allowed_origins, false);
            this.#apps_content_security_policy_domains = new ValueObjectString(
                'apps_content_security_policy_domains',
                dto.apps_content_security_policy_domains,
                false
            );
            this.#apps_frame_origins = new ValueObjectString('apps_frame_origins', dto.apps_frame_origins, false);
            this.#apps_certificate_domain_arn = new ValueObjectString(
                'apps_certificate_domain_arn',
                dto.apps_certificate_domain_arn,
                false
            );
            this.#apps_hosted_zone_id = new ValueObjectString('apps_hosted_zone_id', dto.apps_hosted_zone_id, false);
            this.#apps_execute_rest_hook_service_url = new ValueObjectString(
                'apps_execute_rest_hook_service_url',
                dto.apps_execute_rest_hook_service_url,
                false
            );
            this.#apps_timeout_rest_flows_value_ms = new ValueObjectInt(
                'apps_timeout_rest_flows_value_ms',
                dto.apps_timeout_rest_flows_value_ms,
                false
            );
            this.#apps_actions_queue_executor_timeout_ms = new ValueObjectInt(
                'apps_actions_queue_executor_timeout_ms',
                dto.apps_actions_queue_executor_timeout_ms,
                false
            );
            this.#apps_actions_queue_execution_timeout_ms = new ValueObjectInt(
                'apps_actions_queue_execution_timeout_ms',
                dto.apps_actions_queue_execution_timeout_ms,
                false
            );
            this.#timezone = new ValueObjectString('timezone', dto.timezone, false);

            this.#db_host = new ValueObjectString('db_host', dto.db_host, false);
            this.#db_host_reader = new ValueObjectString('db_host_reader', dto.db_host_reader, true);
            this.#db_database = new ValueObjectString('db_database', dto.db_database, false);
            this.#db_user = new ValueObjectString('db_user', dto.db_user, false);
            this.#db_password = new ValueObjectString('db_password', dto.db_password, false);
            this.#db_auxiliar_user = new ValueObjectString('db_auxiliar_user', dto.db_auxiliar_user, false);
            this.#db_auxiliar_password = new ValueObjectString('db_auxiliar_password', dto.db_auxiliar_password, false);
            this.#db_name = new ValueObjectString('db_name', dto.db_name, false);
            this.#db_port = new ValueObjectInt('db_port', dto.db_port, false);
            this.#db_schema = new ValueObjectString('db_schema', dto.db_schema, false);

            this.#secret_key = new ValueObjectString('secret_key', dto.secret_key, false);
            this.#secret_iv = new ValueObjectString('secret_iv', dto.secret_iv, false);
            this.#encryption_method = new ValueObjectString('encryption_method', dto.encryption_method, false);

            this.#aws_dynamodb_multitenant_table_arn = new ValueObjectString(
                'aws_dynamodb_multitenant_table_arn',
                dto.aws_dynamodb_multitenant_table_arn,
                false
            );

            this.#aws_s3_bucket = new ValueObjectString('aws_s3_bucket', dto.aws_s3_bucket, false);
            this.#aws_s3_access_key_id = new ValueObjectString('aws_s3_access_key_id', dto.aws_s3_access_key_id, false);
            this.#aws_s3_secret_access_key = new ValueObjectString(
                'aws_s3_secret_access_key',
                dto.aws_s3_secret_access_key,
                false
            );
            this.#aws_s3_region = new ValueObjectString('aws_s3_region', dto.aws_s3_region, false);

            this.#aws_css_enable = new ValueObjectInt('aws_css_enable', dto.aws_css_enable, false);
            this.#aws_css_url = new ValueObjectString('aws_css_url', dto.aws_css_url, false);
            this.#aws_css_username = new ValueObjectString('aws_css_username', dto.aws_css_username, false);
            this.#aws_css_password = new ValueObjectString('aws_css_password', dto.aws_css_password, false);

            this.#aws_cognito_user_pool_id = new ValueObjectString(
                'aws_cognito_user_pool_id',
                dto.aws_cognito_user_pool_id,
                false
            );
            this.#aws_cognito_app_client_id = new ValueObjectString(
                'aws_cognito_app_client_id',
                dto.aws_cognito_app_client_id,
                false
            );
            this.#aws_cognito_region = new ValueObjectString('aws_cognito_region', dto.aws_cognito_region, true);
            this.#aws_cognito_url = new ValueObjectString('aws_cognito_url', dto.aws_cognito_url, true);
            this.#aws_cognito_identity_provider = new ValueObjectString(
                'aws_cognito_identity_provider',
                dto.aws_cognito_identity_provider,
                true
            );
            this.#aws_cognito_response_type = new ValueObjectString(
                'aws_cognito_response_type',
                dto.aws_cognito_response_type,
                true
            );
            this.#aws_cognito_scope = new ValueObjectString('aws_cognito_scope', dto.aws_cognito_scope, true);
            this.#aws_cognito_redirect_to_exchange = new ValueObjectString(
                'aws_cognito_redirect_to_exchange',
                dto.aws_cognito_redirect_to_exchange,
                true
            );
            this.#aws_cognito_redirect_to_frontend = new ValueObjectString(
                'aws_cognito_redirect_to_frontend',
                dto.aws_cognito_redirect_to_frontend,
                true
            );
            this.#aws_sqs_region = new ValueObjectString('aws_sqs_region', dto.aws_sqs_region, true);
            this.#aws_sqs_events_queue_url = new ValueObjectString(
                'aws_sqs_events_queue_url',
                dto.aws_sqs_events_queue_url,
                true
            );
            this.#aws_event_bridge_region = new ValueObjectString('aws_event_bridge_region', dto.aws_sqs_region, true);
            this.#aws_event_bridge_event_bus_name = new ValueObjectString(
                'aws_event_bridge_event_bus_name',
                dto.aws_event_bridge_event_bus_name,
                true
            );
            this.#aws_cases_events_queue_url = new ValueObjectString(
                'aws_cases_events_queue_url',
                dto.aws_cases_events_queue_url,
                true
            );
            this.#aws_case_post_processing_queue_url = new ValueObjectString(
                'aws_case_post_processing_queue_url',
                dto.aws_case_post_processing_queue_url,
                true
            );
            this.#aws_action_jobs_events_queue_url = new ValueObjectString(
                'aws_action_jobs_events_queue_url',
                dto.aws_action_jobs_events_queue_url,
                true
            );
            this.#aws_automated_actions_events_queue_url = new ValueObjectString(
                'aws_automated_actions_events_queue_url',
                dto.aws_automated_actions_events_queue_url,
                true
            );
            this.#aws_ws_rest_events_queue_url = new ValueObjectString(
                'aws_ws_rest_events_queue_url',
                dto.aws_ws_rest_events_queue_url,
                true
            );
            this.#aws_reports_events_queue_url = new ValueObjectString(
                'aws_reports_events_queue_url',
                dto.aws_reports_events_queue_url,
                true
            );
            this.#aws_imports_events_queue_url = new ValueObjectString(
                'aws_imports_events_queue_url',
                dto.aws_imports_events_queue_url,
                true
            );

            this.#channel_hub_user = new ValueObjectString('channel_hub_user', dto.channel_hub_user, true);
            this.#channel_hub_password = new ValueObjectString('channel_hub_password', dto.channel_hub_password, true);
            this.#webhook_api_key = new ValueObjectString('webhook_api_key', dto.webhook_api_key, true);
            this.#apps_worker_fast_cron_expression = new ValueObject(
                'apps_worker_fast_cron_expression',
                dto.apps_worker_fast_cron_expression
            );
            this.#apps_worker_ans_cron_expression = new ValueObject(
                'apps_worker_ans_cron_expression',
                dto.apps_worker_ans_cron_expression
            );
            this.#apps_assignment_backlog_cron_expression = new ValueObject(
                'apps_assignment_backlog_cron_expression',
                dto.apps_assignment_backlog_cron_expression
            );
        } catch (e) {
            Helper.logError(`Tenant::constructor: ${dto.id}`, e);
            throw e;
        }
    }

    // Getters
    get subdomain() {
        return this.#subdomain;
    }

    get apps_environment() {
        return this.#apps_environment;
    }

    get apps_service_name() {
        return this.#apps_service_name;
    }

    get apps_debug() {
        return this.#apps_debug;
    }

    get apps_debug_level() {
        return this.#apps_debug_level;
    }

    get apps_domain() {
        return this.#apps_domain;
    }

    get apps_api_subdomain() {
        return this.#apps_api_subdomain;
    }

    get apps_admin_subdomain() {
        return this.#apps_admin_subdomain;
    }

    get apps_allowed_origins() {
        return this.#apps_allowed_origins;
    }

    get apps_content_security_policy_domains() {
        return this.#apps_content_security_policy_domains;
    }

    get apps_frame_origins() {
        return this.#apps_frame_origins;
    }

    get apps_certificate_domain_arn() {
        return this.#apps_certificate_domain_arn;
    }

    get apps_hosted_zone_id() {
        return this.#apps_hosted_zone_id;
    }

    get apps_execute_rest_hook_service_url() {
        return this.#apps_execute_rest_hook_service_url;
    }

    get apps_timeout_rest_flows_value_ms() {
        return this.#apps_timeout_rest_flows_value_ms;
    }

    get apps_actions_queue_executor_timeout_ms() {
        return this.#apps_actions_queue_executor_timeout_ms;
    }

    get apps_actions_queue_execution_timeout_ms() {
        return this.#apps_actions_queue_execution_timeout_ms;
    }

    get timezone() {
        return this.#timezone;
    }

    get db_host() {
        return this.#db_host;
    }

    get db_host_reader() {
        return this.#db_host_reader;
    }

    get db_database() {
        return this.#db_database;
    }

    get db_user() {
        return this.#db_user;
    }

    get db_password() {
        return this.#db_password;
    }

    get db_auxiliar_user() {
        return this.#db_auxiliar_user;
    }

    get db_auxiliar_password() {
        return this.#db_auxiliar_password;
    }

    get db_name() {
        return this.#db_name;
    }

    get db_port() {
        return this.#db_port;
    }

    get db_schema() {
        return this.#db_schema;
    }

    get secret_key() {
        return this.#secret_key;
    }

    get secret_iv() {
        return this.#secret_iv;
    }

    get encryption_method() {
        return this.#encryption_method;
    }

    get aws_dynamodb_multitenant_table_arn() {
        return this.#aws_dynamodb_multitenant_table_arn;
    }

    get aws_s3_bucket() {
        return this.#aws_s3_bucket;
    }

    get aws_s3_access_key_id() {
        return this.#aws_s3_access_key_id;
    }

    get aws_s3_secret_access_key() {
        return this.#aws_s3_secret_access_key;
    }

    get aws_s3_region() {
        return this.#aws_s3_region;
    }

    get aws_css_enable() {
        return this.#aws_css_enable;
    }

    get aws_css_url() {
        return this.#aws_css_url;
    }

    get aws_css_username() {
        return this.#aws_css_username;
    }

    get aws_css_password() {
        return this.#aws_css_password;
    }

    // Setters
    set subdomain(value) {
        value = new ValueObjectString('subdomain', value, false);
        this.#subdomain = value;
        this.changedAttributes.subdomain = this.#subdomain.value;
    }

    set apps_environment(value) {
        value = new ValueObjectString('apps_environment', value, false);
        this.#apps_environment = value;
        this.changedAttributes.apps_environment = this.#apps_environment.value;
    }

    set apps_service_name(value) {
        value = new ValueObjectString('apps_service_name', value, false);
        this.#apps_service_name = value;
        this.changedAttributes.apps_service_name = this.#apps_service_name.value;
    }

    set apps_debug(value) {
        value = new ValueObject('apps_debug', value, false);
        this.#apps_debug = value;
        this.changedAttributes.apps_debug = this.#apps_debug.value;
    }

    set apps_debug_level(value) {
        value = new ValueObjectInt('apps_debug_level', value, false);
        this.#apps_debug_level = value;
        this.changedAttributes.apps_debug_level = this.#apps_debug_level.value;
    }

    set apps_domain(value) {
        value = new ValueObjectString('apps_domain', value, false);
        this.#apps_domain = value;
        this.changedAttributes.apps_domain = this.#apps_domain.value;
    }

    set apps_api_subdomain(value) {
        value = new ValueObjectString('apps_api_subdomain', value, false);
        this.#apps_api_subdomain = value;
        this.changedAttributes.apps_api_subdomain = this.#apps_api_subdomain.value;
    }

    set apps_admin_subdomain(value) {
        value = new ValueObjectString('apps_admin_subdomain', value, false);
        this.#apps_admin_subdomain = value;
        this.changedAttributes.apps_admin_subdomain = this.#apps_admin_subdomain.value;
    }

    set apps_allowed_origins(value) {
        value = new ValueObjectString('apps_allowed_origins', value, false);
        this.#apps_allowed_origins = value;
        this.changedAttributes.apps_allowed_origins = this.#apps_allowed_origins.value;
    }

    set apps_content_security_policy_domains(value) {
        value = new ValueObjectString('apps_content_security_policy_domains', value, false);
        this.#apps_content_security_policy_domains = value;
        this.changedAttributes.apps_content_security_policy_domains = this.#apps_content_security_policy_domains.value;
    }

    set apps_frame_origins(value) {
        value = new ValueObjectString('apps_frame_origins', value, false);
        this.#apps_frame_origins = value;
        this.changedAttributes.apps_frame_origins = this.#apps_frame_origins.value;
    }

    set apps_certificate_domain_arn(value) {
        value = new ValueObjectString('apps_certificate_domain_arn', value, false);
        this.#apps_certificate_domain_arn = value;
        this.changedAttributes.apps_certificate_domain_arn = this.#apps_certificate_domain_arn.value;
    }

    set apps_hosted_zone_id(value) {
        value = new ValueObjectString('apps_hosted_zone_id', value, false);
        this.#apps_hosted_zone_id = value;
        this.changedAttributes.apps_hosted_zone_id = this.#apps_hosted_zone_id.value;
    }

    set apps_execute_rest_hook_service_url(value) {
        value = new ValueObjectString('apps_execute_rest_hook_service_url', value, false);
        this.#apps_execute_rest_hook_service_url = value;
        this.changedAttributes.apps_execute_rest_hook_service_url = this.#apps_execute_rest_hook_service_url.value;
    }

    set apps_timeout_rest_flows_value_ms(value) {
        value = new ValueObjectInt('apps_timeout_rest_flows_value_ms', value, false);
        this.#apps_timeout_rest_flows_value_ms = value;
        this.changedAttributes.apps_timeout_rest_flows_value_ms = this.#apps_timeout_rest_flows_value_ms.value;
    }

    set apps_actions_queue_executor_timeout_ms(value) {
        value = new ValueObjectInt('apps_actions_queue_executor_timeout_ms', value, false);
        this.#apps_actions_queue_executor_timeout_ms = value;
        this.changedAttributes.apps_actions_queue_executor_timeout_ms =
            this.#apps_actions_queue_executor_timeout_ms.value;
    }

    set apps_actions_queue_execution_timeout_ms(value) {
        value = new ValueObjectInt('apps_actions_queue_execution_timeout_ms', value, false);
        this.#apps_actions_queue_execution_timeout_ms = value;
        this.changedAttributes.apps_actions_queue_execution_timeout_ms =
            this.#apps_actions_queue_execution_timeout_ms.value;
    }

    set timezone(value) {
        value = new ValueObjectString('timezone', value, false);
        this.#timezone = value;
        this.changedAttributes.timezone = this.#timezone.value;
    }

    set db_host(value) {
        value = new ValueObjectString('db_host', value, false);
        this.#db_host = value;
        this.changedAttributes.db_host = this.#db_host.value;
    }

    set db_database(value) {
        value = new ValueObjectString('db_database', value, false);
        this.#db_database = value;
        this.changedAttributes.db_database = this.#db_database.value;
    }

    set db_user(value) {
        value = new ValueObjectString('db_user', value, false);
        this.#db_user = value;
        this.changedAttributes.db_user = this.#db_user.value;
    }

    set db_password(value) {
        value = new ValueObjectString('db_password', value, false);
        this.#db_password = value;
        this.changedAttributes.db_password = this.#db_password.value;
    }

    set db_auxiliar_user(value) {
        value = new ValueObjectString('db_auxiliar_user', value, false);
        this.#db_auxiliar_user = value;
        this.changedAttributes.db_auxiliar_user = this.#db_auxiliar_user.value;
    }

    set db_auxiliar_password(value) {
        value = new ValueObjectString('db_auxiliar_password', value, false);
        this.#db_auxiliar_password = value;
        this.changedAttributes.db_auxiliar_password = this.#db_auxiliar_password.value;
    }

    set db_name(value) {
        value = new ValueObjectString('db_name', value, false);
        this.#db_name = value;
        this.changedAttributes.db_name = this.#db_name.value;
    }

    set db_port(value) {
        value = new ValueObjectInt('db_port', value, false);
        this.#db_port = value;
        this.changedAttributes.db_port = this.#db_port.value;
    }

    set db_schema(value) {
        value = new ValueObjectString('db_schema', value, false);
        this.#db_schema = value;
        this.changedAttributes.db_schema = this.#db_schema.value;
    }

    set secret_key(value) {
        value = new ValueObjectString('secret_key', value, false);
        this.#secret_key = value;
        this.changedAttributes.secret_key = this.#secret_key.value;
    }

    set secret_iv(value) {
        value = new ValueObjectString('secret_iv', value, false);
        this.#secret_iv = value;
        this.changedAttributes.secret_iv = this.#secret_iv.value;
    }

    set encryption_method(value) {
        value = new ValueObjectString('encryption_method', value, false);
        this.#encryption_method = value;
        this.changedAttributes.encryption_method = this.#encryption_method.value;
    }

    set aws_dynamodb_multitenant_table_arn(value) {
        value = new ValueObjectString('aws_dynamodb_multitenant_table_arn', value, false);
        this.#aws_dynamodb_multitenant_table_arn = value;
        this.changedAttributes.aws_dynamodb_multitenant_table_arn = this.#aws_dynamodb_multitenant_table_arn.value;
    }

    set aws_s3_bucket(value) {
        value = new ValueObjectString('aws_s3_bucket', value, false);
        this.#aws_s3_bucket = value;
        this.changedAttributes.aws_s3_bucket = this.#aws_s3_bucket.value;
    }

    set aws_s3_access_key_id(value) {
        value = new ValueObjectString('aws_s3_access_key_id', value, false);
        this.#aws_s3_access_key_id = value;
        this.changedAttributes.aws_s3_access_key_id = this.#aws_s3_access_key_id.value;
    }

    set aws_s3_secret_access_key(value) {
        value = new ValueObjectString('aws_s3_secret_access_key', value, false);
        this.#aws_s3_secret_access_key = value;
        this.changedAttributes.aws_s3_secret_access_key = this.#aws_s3_secret_access_key.value;
    }

    set aws_s3_region(value) {
        value = new ValueObjectString('aws_s3_region', value, false);
        this.#aws_s3_region = value;
        this.changedAttributes.aws_s3_region = this.#aws_s3_region.value;
    }

    set aws_css_enable(value) {
        value = new ValueObjectInt('aws_css_enable', value, false);
        this.#aws_css_enable = value;
        this.changedAttributes.aws_css_enable = this.#aws_css_enable.value;
    }

    set aws_css_url(value) {
        value = new ValueObjectString('aws_css_url', value, false);
        this.#aws_css_url = value;
        this.changedAttributes.aws_css_url = this.#aws_css_url.value;
    }

    set aws_css_username(value) {
        value = new ValueObjectString('aws_css_username', value, false);
        this.#aws_css_username = value;
        this.changedAttributes.aws_css_username = this.#aws_css_username.value;
    }

    set aws_css_password(value) {
        value = new ValueObjectString('aws_css_password', value, false);
        this.#aws_css_password = value;
        this.changedAttributes.aws_css_password = this.#aws_css_password.value;
    }

    get aws_cognito_user_pool_id() {
        return this.#aws_cognito_user_pool_id;
    }

    set aws_cognito_user_pool_id(value) {
        if (this.#aws_cognito_user_pool_id.value !== value) {
            this.#aws_cognito_user_pool_id = new ValueObjectString('aws_cognito_user_pool_id', value, false);
            this.changedAttributes.aws_cognito_user_pool_id = value;
        }
    }

    get aws_cognito_app_client_id() {
        return this.#aws_cognito_app_client_id;
    }

    set aws_cognito_app_client_id(value) {
        if (this.#aws_cognito_app_client_id.value !== value) {
            this.#aws_cognito_app_client_id = new ValueObjectString('aws_cognito_app_client_id', value, false);
            this.changedAttributes.aws_cognito_app_client_id = value;
        }
    }

    get aws_cognito_region() {
        return this.#aws_cognito_region;
    }

    set aws_cognito_region(value) {
        if (this.#aws_cognito_region.value !== value) {
            this.#aws_cognito_region = new ValueObjectString('aws_cognito_region', value, false);
            this.changedAttributes.aws_cognito_region = value;
        }
    }

    get aws_cognito_url() {
        return this.#aws_cognito_url;
    }

    set aws_cognito_url(value) {
        if (this.#aws_cognito_url.value !== value) {
            this.#aws_cognito_url = new ValueObjectString('aws_cognito_url', value, true);
            this.changedAttributes.aws_cognito_url = value;
        }
    }

    /**
     * Builds the Knex config for this tenant.
     *
     * @param {Object} [options]
     * @param {boolean} [options.preferReplica=false]  When true and role="reader", target db_host_reader (replica).
     * @param {"writer"|"reader"} [options.role="writer"]  Connection role.
     * @param {number} [options.poolMax=3]  Max Knex pool size.
     * @return {Object} Knex config object {client, connection, pool, schema}.
     */
    buildKnexConfig({ preferReplica = false, role = 'writer', poolMax = 3 } = {}) {
        const useReplica = role === 'reader' && preferReplica === true && Boolean(this.#db_host_reader.value);
        const host = useReplica ? this.#db_host_reader.value : this.db_host.value;

        return {
            client: 'pg',
            connection: {
                host,
                port: this.db_port.value,
                database: this.db_database.value,
                user: this.db_user.value,
                password: this.db_password.value,
                // Evita "Connection terminated unexpectedly" cuando NAT/firewall
                // corta sockets TCP idle durante llamadas HTTP largas del workflow.
                keepAlive: true,
                keepAliveInitialDelayMillis: 10000,
            },
            pool: {
                min: 0,
                max: poolMax,
                idleTimeoutMillis: 1000, // Devolver conexión al pool/PG rápido entre pasos
                acquireTimeoutMillis: 10000,
                propagateCreateError: true,
            },
            acquireConnectionTimeout: 10000,
            schema: this.db_schema.value,
        };
    }

    apiUrl() {
        return `https://${this.apps_api_subdomain.value}.${this.apps_domain.value}`;
    }

    appUrl() {
        return `https://${this.apps_admin_subdomain.value}.${this.apps_domain.value}`;
    }
}
