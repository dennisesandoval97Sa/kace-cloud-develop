/**
 * Service Manifest - Maps all Lambda microservices to their base paths and routes.
 *
 * Generated from CDK stack definitions in apps/apiv1/[service]/lib/*-stack.ts
 *
 * Each service gets the DEFAULT_ROUTES automatically (from KApiStack.setDefaultResources).
 * Only services with additional routes need customRoutes entries.
 *
 * To add a new service:
 * 1. Check its CDK stack for the base path (setDefaultOptions('path') or setBasePath('path', ...))
 * 2. Check for addResource() calls beyond setDefaultResources
 * 3. Add an entry to this array
 */

/**
 * Standard routes registered for every service (from KApiStack.setDefaultResources).
 * These map to: actionIndex, actionCreate, actionRead, actionUpdate, actionDelete,
 * actionSearch, actionHistory, actionAdvanceSearch in BaseController.
 */
export const DEFAULT_ROUTES = [
    { method: 'GET', resource: '/' },
    { method: 'POST', resource: '/' },
    { method: 'GET', resource: '/{id}' },
    { method: 'POST', resource: '/{id}' },
    { method: 'GET', resource: '/{id}/delete' },
    { method: 'POST', resource: '/search' },
    { method: 'POST', resource: '/{id}/history' },
    { method: 'POST', resource: '/advance-search' },
];

/**
 * @typedef {Object} ServiceRoute
 * @property {string} method - HTTP method (GET, POST)
 * @property {string} resource - API Gateway resource pattern (e.g., '/{id}/transition')
 */

/**
 * @typedef {Object} ServiceEntry
 * @property {string} directory - Directory name under apps/apiv1/
 * @property {string} basePath - URL base path (e.g., 'cases' -> /cases/*)
 * @property {ServiceRoute[]} customRoutes - Routes beyond DEFAULT_ROUTES
 * @property {boolean} [skipDefaultRoutes] - If true, only register customRoutes
 * @property {boolean} [excluded] - If true, skip this service entirely
 * @property {string} [excludeReason] - Reason for exclusion
 */

/** @type {ServiceEntry[]} */
export const SERVICE_MANIFEST = [
    // ─────────────────────────────────────────────────────
    // Services with CUSTOM routes (beyond defaults)
    // ─────────────────────────────────────────────────────

    {
        directory: 'kace_cloud_api_quick_links',
        basePath: 'quick-links',
        skipDefaultRoutes: true,
        customRoutes: [
            { method: 'GET', resource: '/' },
            { method: 'POST', resource: '/' },
            { method: 'GET', resource: '/{id}/delete' },
        ],
    },

    {
        directory: 'kace_cloud_api_folio_configurations',
        basePath: 'folio-configurations',
        customRoutes: [
            { method: 'POST', resource: '/preview' },
            { method: 'GET', resource: '/{id}/classifications' },
        ],
    },
    {
        directory: 'kace_cloud_api_cases',
        basePath: 'cases',
        customRoutes: [
            { method: 'GET', resource: '/view' },
            { method: 'POST', resource: '/view/search' },
            { method: 'POST', resource: '/{id}/transition' },
            { method: 'POST', resource: '/{id}/sub-cases' },
            { method: 'POST', resource: '/{id}/sub-cases/delete' },
            { method: 'POST', resource: '/{id}/sub-cases/search' },
            { method: 'POST', resource: '/auxiliary' },
            { method: 'POST', resource: '/auxiliary/{id}' },
            { method: 'POST', resource: '/visible' },
            { method: 'POST', resource: '/{id}/delete' },
        ],
    },
    {
        directory: 'kace_cloud_api_channel_hub',
        basePath: 'channel-hub',
        customRoutes: [
            { method: 'POST', resource: '/{id}/register' },
            { method: 'GET', resource: '/{id}/workspace-priorities' },
            { method: 'POST', resource: '/{id}/workspace-priorities/reorder' },
            { method: 'GET', resource: '/{id}/workspace-priorities/reorders/{operationId}' },
        ],
    },
    {
        directory: 'kace_cloud_api_users',
        basePath: 'users',
        // Mirrors users-stack.ts, which does not mount advance-search nor a bare POST /session.
        skipDefaultRoutes: true,
        customRoutes: [
            ...DEFAULT_ROUTES.filter((route) => route.resource !== '/advance-search'),
            { method: 'POST', resource: '/{id}/integration-activity' },
            { method: 'POST', resource: '/searchByName' },
            { method: 'POST', resource: '/session/alive' },
            { method: 'GET', resource: '/session/validate-group' },
            { method: 'POST', resource: '/update-active-group' },
            { method: 'POST', resource: '/bulk-update' },
        ],
    },
    {
        directory: 'kace_cloud_api_auxiliaries',
        basePath: 'auxiliaries',
        skipDefaultRoutes: true,
        customRoutes: [
            { method: 'GET', resource: '/{entity}' },
            { method: 'POST', resource: '/{entity}' },
            { method: 'POST', resource: '/{entity}/search' },
            { method: 'GET', resource: '/{entity}/list' },
            { method: 'POST', resource: '/{entity}/list/search' },
            { method: 'GET', resource: '/{entity}/{id}' },
            { method: 'POST', resource: '/{entity}/{id}' },
            { method: 'GET', resource: '/{entity}/{id}/delete' },
            { method: 'POST', resource: '/{entity}/{id}/history' },
        ],
    },
    {
        directory: 'kace_cloud_api_agendas_groups',
        basePath: 'agendas-groups',
        customRoutes: [
            { method: 'GET', resource: '/agenda/{agendaId}/group/{groupId}' },
            { method: 'GET', resource: '/agenda/{agendaId}/group/{groupId}/delete' },
            { method: 'POST', resource: '/batch' },
            { method: 'POST', resource: '/batch/delete' },
        ],
    },
    {
        directory: 'kace_cloud_api_classification_group_relationships',
        basePath: 'classifications-groups-relationships',
        customRoutes: [
            { method: 'GET', resource: '/classification/{classificationId}/group/{groupId}' },
            { method: 'GET', resource: '/classification/{classificationId}/group/{groupId}/delete' },
        ],
    },
    {
        directory: 'kace_cloud_api_boards',
        basePath: 'boards',
        customRoutes: [
            { method: 'GET', resource: '/relations' },
            { method: 'GET', resource: '/available' },
            { method: 'GET', resource: '/relations/{entity}' },
            { method: 'POST', resource: '/{id}/resources' },
        ],
    },
    {
        directory: 'kace_cloud_api_schemas',
        basePath: 'schemas',
        customRoutes: [
            { method: 'GET', resource: '/{id}/relations-count' },
            { method: 'GET', resource: '/{id}/rules' },
            { method: 'GET', resource: '/functions' },
        ],
    },
    {
        directory: 'kace_cloud_api_action_update_model',
        basePath: 'action-update-model',
        customRoutes: [
            { method: 'GET', resource: '/types' },
            { method: 'GET', resource: '/formulas' },
            { method: 'GET', resource: '/aggregates' },
            { method: 'GET', resource: '/customer-fields' },
            { method: 'GET', resource: '/case-fields' },
        ],
    },
    {
        directory: 'kace_cloud_api_action_batch_executions',
        basePath: 'action-jobs',
        customRoutes: [
            { method: 'POST', resource: '/validate-csv' },
            { method: 'POST', resource: '/process-queue' },
        ],
    },
    {
        directory: 'kace_cloud_api_appointments',
        basePath: 'appointments',
        customRoutes: [
            { method: 'POST', resource: '/{id}/re-scheduler' },
            { method: 'GET', resource: '/by-case/count/{id}' },
        ],
    },
    {
        directory: 'kace_cloud_api_cognito_authorization',
        basePath: 'auth-cognito',
        customRoutes: [{ method: 'POST', resource: '/logout' }],
    },
    {
        directory: 'kace_cloud_api_classifications',
        basePath: 'classifications',
        customRoutes: [{ method: 'GET', resource: '/list' }],
    },
    {
        directory: 'kace_cloud_api_states',
        basePath: 'states',
        customRoutes: [{ method: 'GET', resource: '/list' }],
    },
    {
        directory: 'kace_cloud_api_ws_rest_flows',
        basePath: 'ws-rest-flows',
        customRoutes: [{ method: 'GET', resource: '/list' }],
    },
    {
        directory: 'kace_cloud_api_ws_rest_endpoints',
        basePath: 'ws-rest-endpoints',
        customRoutes: [{ method: 'GET', resource: '/tryout/{id}' }],
    },
    {
        directory: 'kace_cloud_api_literals',
        basePath: 'literals',
        customRoutes: [{ method: 'GET', resource: '/{id}/list' }],
    },
    {
        directory: 'kace_cloud_api_interactions',
        basePath: 'interactions',
        customRoutes: [
            { method: 'POST', resource: '/webhook' },
            { method: 'POST', resource: '/interaction-cases' },
            { method: 'POST', resource: '/interaction-cases/search' },
            { method: 'POST', resource: '/interaction-cases/candidates/search' },
            { method: 'GET', resource: '/interaction-cases/{id}' },
            { method: 'POST', resource: '/{id}/review/claim' },
            { method: 'POST', resource: '/{id}/review/release' },
        ],
    },
    {
        directory: 'kace_cloud_api_interactions_bulk',
        basePath: 'interactions-bulk',
        skipDefaultRoutes: true,
        customRoutes: [
            { method: 'POST', resource: '/move' },
            { method: 'POST', resource: '/close' },
            { method: 'POST', resource: '/delete' },
            { method: 'POST', resource: '/agent/close' },
            { method: 'POST', resource: '/agent/move' },
            { method: 'GET', resource: '/agent/{id}/move-destinations' },
        ],
    },
    {
        directory: 'kace_cloud_api_generate_csv',
        basePath: 'generate-csv',
        customRoutes: [{ method: 'GET', resource: '/{id}/execute' }],
    },
    {
        directory: 'kace_cloud_api_custom_lists',
        basePath: 'customlists',
        customRoutes: [{ method: 'GET', resource: '/active-group/{id}' }],
    },
    {
        directory: 'kace_cloud_api_broker',
        basePath: 'broker-adapters',
        customRoutes: [{ method: 'GET', resource: '/mapper/{id}' }],
    },
    {
        directory: 'kace_cloud_api_broker_mapper',
        basePath: 'broker-mappers',
        customRoutes: [{ method: 'GET', resource: '/mapper/{id}' }],
    },
    {
        directory: 'kace_cloud_api_event_logs',
        basePath: 'event-logs',
        customRoutes: [{ method: 'POST', resource: '/case/{id}' }],
    },
    {
        directory: 'kace_cloud_api_group',
        basePath: 'groups',
        customRoutes: [{ method: 'GET', resource: '/{id}/shift-management' }],
    },
    {
        directory: 'kace_cloud_api_upload_s3_files',
        basePath: 'upload-s3-files',
        customRoutes: [{ method: 'POST', resource: '/scan-s3-file' }],
    },
    {
        directory: 'kace_cloud_api_classification_template_relations',
        basePath: 'classification-template-relations',
        customRoutes: [{ method: 'POST', resource: '/delete' }],
    },
    {
        directory: 'kace_cloud_api_user_group_relations',
        basePath: 'user-group-relationships',
        customRoutes: [{ method: 'POST', resource: '/delete' }],
    },
    {
        directory: 'kace_cloud_api_ans',
        basePath: 'ans',
        customRoutes: [],
    },

    // ─────────────────────────────────────────────────────
    // Services with ONLY custom routes (no defaults)
    // ─────────────────────────────────────────────────────

    {
        directory: 'kace_cloud_api_permissions',
        basePath: 'permissions',
        skipDefaultRoutes: true,
        customRoutes: [{ method: 'GET', resource: '/' }],
    },
    {
        directory: 'kace_cloud_api_global_configurations_get',
        basePath: 'global-configuration-get',
        skipDefaultRoutes: true,
        customRoutes: [{ method: 'GET', resource: '/{id}' }],
    },

    // ─────────────────────────────────────────────────────
    // Services with STANDARD routes only (setDefaultOptions)
    // ─────────────────────────────────────────────────────

    { directory: 'kace_cloud_api_actions', basePath: 'actions', customRoutes: [] },
    { directory: 'kace_cloud_api_actions_queue_executions', basePath: 'actions-queue-executions', customRoutes: [] },
    { directory: 'kace_cloud_api_agendas', basePath: 'agendas', customRoutes: [] },
    { directory: 'kace_cloud_api_allowed_connections', basePath: 'allowed-connections', customRoutes: [] },
    { directory: 'kace_cloud_api_ans_calculate', basePath: 'ans-calculate', customRoutes: [] },
    { directory: 'kace_cloud_api_ans_types', basePath: 'ans-types', customRoutes: [] },
    { directory: 'kace_cloud_api_appointment_time_slots', basePath: 'appointment-time-slots', customRoutes: [] },
    { directory: 'kace_cloud_api_automation_settings', basePath: 'automation-settings', customRoutes: [] },
    { directory: 'kace_cloud_api_aux_cases', basePath: 'aux-cases', customRoutes: [] },
    { directory: 'kace_cloud_api_aux_clients', basePath: 'aux-clients', customRoutes: [] },
    { directory: 'kace_cloud_api_aux_definitions', basePath: 'aux-definitions', customRoutes: [] },
    { directory: 'kace_cloud_api_banners', basePath: 'banners', customRoutes: [] },
    { directory: 'kace_cloud_api_case_attachments', basePath: 'case-attachments', customRoutes: [] },
    { directory: 'kace_cloud_api_case_available_states', basePath: 'case-available-states', customRoutes: [] },
    { directory: 'kace_cloud_api_case_calculate_ans', basePath: 'case-calculate-ans', customRoutes: [] },
    { directory: 'kace_cloud_api_case_clone', basePath: 'case-clone', customRoutes: [] },
    { directory: 'kace_cloud_api_case_close', basePath: 'case-close', customRoutes: [] },
    { directory: 'kace_cloud_api_case_count', basePath: 'cases-count', customRoutes: [] },
    { directory: 'kace_cloud_api_case_count_by_group', basePath: 'cases-count-by-group', customRoutes: [] },
    { directory: 'kace_cloud_api_case_count_by_responsable', basePath: 'cases-count-by-responsable', customRoutes: [] },
    { directory: 'kace_cloud_api_case_descriptions', basePath: 'case-descriptions', customRoutes: [] },
    { directory: 'kace_cloud_api_case_reclassify', basePath: 'case-reclassification', customRoutes: [] },
    {
        directory: 'kace_cloud_api_case_reclassify_precheck',
        basePath: 'case-reclassification-precheck',
        customRoutes: [],
    },
    { directory: 'kace_cloud_api_case_re_open', basePath: 'case-re-open', customRoutes: [] },
    { directory: 'kace_cloud_api_case_session_duration', basePath: 'case-session-duration', customRoutes: [] },
    { directory: 'kace_cloud_api_case_transitions', basePath: 'case-transitions', customRoutes: [] },
    {
        directory: 'kace_cloud_api_classification_group_relationships_batch',
        basePath: 'classifications-groups-relationships-batch',
        customRoutes: [],
    },
    {
        directory: 'kace_cloud_api_classification_group_relationships_batch_delete',
        basePath: 'classifications-groups-relationships-batch-delete',
        customRoutes: [],
    },
    { directory: 'kace_cloud_api_classifications_levels', basePath: 'classifications-levels', customRoutes: [] },
    { directory: 'kace_cloud_api_client_contacts', basePath: 'clients_contacts', customRoutes: [] },
    { directory: 'kace_cloud_api_client_notifications', basePath: 'client-notifications', customRoutes: [] },
    { directory: 'kace_cloud_api_clients', basePath: 'clients', customRoutes: [] },
    { directory: 'kace_cloud_api_clients_doc_types', basePath: 'clients_doc_types', customRoutes: [] },
    { directory: 'kace_cloud_api_comments', basePath: 'comments', customRoutes: [] },
    { directory: 'kace_cloud_api_download_s3_files', basePath: 'download-s3-files', customRoutes: [] },
    { directory: 'kace_cloud_api_emails', basePath: 'emails', customRoutes: [] },
    { directory: 'kace_cloud_api_exports', basePath: 'exports', customRoutes: [] },
    { directory: 'kace_cloud_api_field_list', basePath: 'schema-fields', customRoutes: [] },
    { directory: 'kace_cloud_api_flow', basePath: 'flows', customRoutes: [] },
    { directory: 'kace_cloud_api_geolocation', basePath: 'geolocation', customRoutes: [] },
    { directory: 'kace_cloud_api_global_configurations', basePath: 'global-configuration', customRoutes: [] },
    { directory: 'kace_cloud_api_global_configurations_set', basePath: 'global-configuration-set', customRoutes: [] },
    { directory: 'kace_cloud_api_group_cases_assignment', basePath: 'group_cases_assignment', customRoutes: [] },
    { directory: 'kace_cloud_api_group_lists', basePath: 'group-lists', customRoutes: [] },
    { directory: 'kace_cloud_api_helps', basePath: 'helps', customRoutes: [] },
    { directory: 'kace_cloud_api_helps_attachments', basePath: 'helps_attachments', customRoutes: [] },
    { directory: 'kace_cloud_api_imports', basePath: 'imports', customRoutes: [] },
    { directory: 'kace_cloud_api_imports_dashboard', basePath: 'imports-dashboard', customRoutes: [] },
    { directory: 'kace_cloud_api_imports_processor', basePath: 'imports-processor', customRoutes: [] },
    { directory: 'kace_cloud_api_mail_accounts', basePath: 'mail-accounts', customRoutes: [] },
    { directory: 'kace_cloud_api_mail_accounts_types', basePath: 'mail-accounts-types', customRoutes: [] },
    { directory: 'kace_cloud_api_one_script', basePath: 'one_script', customRoutes: [] },
    { directory: 'kace_cloud_api_report_executions', basePath: 'report-executions', customRoutes: [] },
    { directory: 'kace_cloud_api_reports', basePath: 'reports', customRoutes: [] },
    { directory: 'kace_cloud_api_roles', basePath: 'roles', customRoutes: [] },
    { directory: 'kace_cloud_api_s3_files', basePath: 's3-files', customRoutes: [] },
    { directory: 'kace_cloud_api_secrets_vault', basePath: 'secrets-vaults', customRoutes: [] },
    { directory: 'kace_cloud_api_shift_management', basePath: 'shift-management', customRoutes: [] },
    { directory: 'kace_cloud_api_template_attachments', basePath: 'template-attachments', customRoutes: [] },
    { directory: 'kace_cloud_api_templates', basePath: 'templates', customRoutes: [] },
    { directory: 'kace_cloud_api_tenant', basePath: 'tenant', customRoutes: [] },
    { directory: 'kace_cloud_api_transitions', basePath: 'transitions', customRoutes: [] },
    { directory: 'kace_cloud_api_user_notifications', basePath: 'users-notifications', customRoutes: [] },
    {
        directory: 'kace_cloud_api_workspaces',
        basePath: 'workspaces',
        customRoutes: [
            { method: 'POST', resource: '/{id}/channel-hub-tags/register' },
            { method: 'POST', resource: '/{id}/deactivate' },
        ],
    },
    { directory: 'kace_cloud_api_ws_hook_rest_flow', basePath: 'ws-hook-rest-flows', customRoutes: [] },
    { directory: 'kace_cloud_api_ws_rest_functions', basePath: 'ws-rest-functions', customRoutes: [] },
    { directory: 'kace_cloud_api_ws_rest_steps', basePath: 'ws-rest-workflow-steps', customRoutes: [] },

    // ─────────────────────────────────────────────────────
    // Services WITHOUT CDK stacks (have handler.mjs, need manual base paths)
    // ─────────────────────────────────────────────────────

    { directory: 'kace_cloud_api_assignment_users_list', basePath: 'assignment-users-list', customRoutes: [] },
    { directory: 'kace_cloud_api_fake_cases', basePath: 'tempcases', customRoutes: [] },
    { directory: 'kace_cloud_api_fake_clients', basePath: 'tempclients', customRoutes: [] },
    { directory: 'kace_cloud_api_states_distinct', basePath: 'states-distinct', customRoutes: [] },
    { directory: 'kace_cloud_api_user_cases_assignment', basePath: 'user-cases-assignment', customRoutes: [] },

    // ─────────────────────────────────────────────────────
    // EXCLUDED services (not HTTP-based or no handler)
    // ─────────────────────────────────────────────────────

    {
        directory: 'kace_cloud_api_auth',
        basePath: 'auth',
        excluded: true,
        excludeReason: 'No handler.mjs',
        customRoutes: [],
    },
    {
        directory: 'kace_cloud_api_event_processor',
        basePath: 'event-processor',
        excluded: true,
        excludeReason: 'SQS event handler, not HTTP',
        customRoutes: [],
    },
    {
        directory: 'kace_cloud_api_metrics',
        basePath: 'metrics',
        excluded: true,
        excludeReason: 'DynamoDB stream handler, not HTTP',
        customRoutes: [],
    },
];
