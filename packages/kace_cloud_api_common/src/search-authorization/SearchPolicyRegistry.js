import { SearchPermissionsCatalog } from '@kace/core/src/role/domain/SearchPermissionsCatalog.js';

const catalogByEndpointKey = SearchPermissionsCatalog.permissionByEndpointKey();

// cases-2 is a deployment variant of Cases and intentionally shares its advanced-search permissions.
const catalogEndpointAliases = {
    'cases-2.case-view.search': 'cases.case-view.search',
    'cases-2.case-visible.search': 'cases.case-visible.search',
    'cases-2.search': 'cases.search',
    'cases-2.sub-cases.search': 'cases.sub-cases.search',
};

export const createAdvancedPermission = (moduleId, name) => ({
    role: 'search',
    module_id: moduleId,
    name,
});

const advancedPermissionForEndpointKey = (endpointKey, fallbackModuleId, fallbackName) => {
    const catalogEndpointKey = catalogEndpointAliases[endpointKey] ?? endpointKey;
    const fromCatalog = catalogByEndpointKey[catalogEndpointKey];
    if (fromCatalog) {
        return createAdvancedPermission(fromCatalog.module_id, fromCatalog.name);
    }
    return createAdvancedPermission(fallbackModuleId, fallbackName);
};

const createDefaultCapabilities = () => ({
    pagination: true,
    order: true,
    relationship: true,
    select: false,
    distinct: false,
    group_by: false,
    having: false,
});

const allowedFilter = (field, operators) => ({
    field,
    operators: Array.isArray(operators) ? operators : [operators],
});

const caseViewAllowedFilters = [
    allowedFilter('alto_impacto', 'eq'),
    allowedFilter('deleted_at', 'null'),
    allowedFilter('parent_id', 'notNull'),
];
const casesAllowedFilters = [
    allowedFilter('cases.deleted_at', 'null'),
    allowedFilter('cases.reference', 'eq'),
    allowedFilter('deleted_at', 'null'),
    allowedFilter('parent_id', ['notNull', 'null']),
    allowedFilter('alto_impacto', 'eq'),
];
const subCasesAllowedFilters = [allowedFilter('cases.is_visible', ['eq', 'null']), allowedFilter('deleted_at', 'null')];

// Frontend page-load/base searches inventoried from kace-saas.
// Keep this list evidence-based; every field/operator here should be traceable to
// a frontend query source and covered by a registry test.
const frontendAllowedFiltersByEndpointKey = {
    'action-jobs.search': [allowedFilter('deleted_at', 'null')],
    'action-update-model.search': [allowedFilter('action_model_updates.deleted_at', 'null')],
    'actions.search': [
        allowedFilter('actions.deleted_at', 'null'),
        allowedFilter('deleted_at', 'null'),
        allowedFilter('description', 'ilike'),
        allowedFilter('id', ['eq', 'in']), // board option labels (useSearchableSelectOptions ensure)
        allowedFilter('is_active', 'eq'),
    ],
    'agendas-groups.search': [allowedFilter('agenda_id', 'eq'), allowedFilter('group_id', 'eq')],
    'agendas.search': [
        allowedFilter('agendas.created_at', 'between'),
        allowedFilter('agendas.created_by', 'eq'),
        allowedFilter('agendas.daily_limit', 'eq'),
        allowedFilter('agendas.deleted_at', 'null'),
        allowedFilter('agendas.description', 'ilike'),
        allowedFilter('agendas.is_active', 'eq'),
        allowedFilter('agendas.is_for_weekend', 'eq'),
        allowedFilter('agendas.updated_at', 'between'),
        allowedFilter('agendas.updated_by', 'eq'),
        allowedFilter('deleted_at', 'null'),
    ],
    'allowed-connections.search': [
        allowedFilter('allowed_connections.connection', 'ilike'),
        allowedFilter('allowed_connections.created_at', 'between'),
        allowedFilter('allowed_connections.created_by', 'eq'),
        allowedFilter('allowed_connections.deleted_at', 'null'),
        allowedFilter('allowed_connections.description', 'ilike'),
        allowedFilter('allowed_connections.is_active', 'eq'),
        allowedFilter('allowed_connections.updated_at', 'between'),
        allowedFilter('allowed_connections.updated_by', 'eq'),
        allowedFilter('connection', 'eq'),
        allowedFilter('deleted_at', 'null'),
        allowedFilter('is_active', 'eq'),
    ],
    'ans.search': [
        allowedFilter('ans.color_ans_final', 'ilike'),
        allowedFilter('ans.color_ans_inicial', 'ilike'),
        allowedFilter('ans.color_ans_intermedio', 'ilike'),
        allowedFilter('ans.created_at', 'between'),
        allowedFilter('ans.created_by', 'eq'),
        allowedFilter('ans.deleted_at', 'null'),
        allowedFilter('ans.id', 'eq'),
        allowedFilter('ans.intermedio', 'eq'),
        allowedFilter('ans.nombre', 'ilike'),
        allowedFilter('ans.status', ['eq', 'neq']),
        allowedFilter('ans.updated_at', 'between'),
        allowedFilter('ans.updated_by', 'eq'),
        allowedFilter('ans.vencido', 'eq'),
        allowedFilter('deleted_at', 'null'),
    ],
    'appointment-time-slots.search': [
        allowedFilter('agenda_id', 'eq'),
        allowedFilter('appointment_time_slots.created_at', 'between'),
        allowedFilter('appointment_time_slots.created_by', 'eq'),
        allowedFilter('appointment_time_slots.deleted_at', 'null'),
        allowedFilter('appointment_time_slots.description', 'ilike'),
        allowedFilter('appointment_time_slots.start_time', 'eq'),
        allowedFilter('appointment_time_slots.end_time', 'eq'),
        allowedFilter('appointment_time_slots.is_active', 'eq'),
        allowedFilter('appointment_time_slots.max_appointments', 'eq'),
        allowedFilter('appointment_time_slots.updated_at', 'between'),
        allowedFilter('appointment_time_slots.updated_by', 'eq'),
        allowedFilter('deleted_at', 'null'),
    ],
    'appointments.search': [
        allowedFilter('appointments.agenda_id', 'eq'),
        allowedFilter('appointments.case_id', 'eq'),
        allowedFilter('appointments.date', 'gte'),
        allowedFilter('appointments.deleted_at', 'null'),
        allowedFilter('appointments.is_canceled', 'eq'),
        allowedFilter('appointments.is_completed', 'eq'),
        allowedFilter('cases.responsable_id', 'eq'),
    ],
    'assignment-users-list.search': [allowedFilter('deleted_at', 'null')],
    'automation-settings.search': [
        allowedFilter('automation_settings.created_at', 'between'),
        allowedFilter('automation_settings.deleted_at', 'null'),
        allowedFilter('automation_settings.description', 'ilike'),
        allowedFilter('automation_settings.end_date', 'between'),
        allowedFilter('automation_settings.frequency', 'ilike'),
        allowedFilter('automation_settings.start_date', 'between'),
        allowedFilter('automation_settings.updated_at', 'between'),
        allowedFilter('deleted_at', 'null'),
    ],
    'aux-clients.search': [allowedFilter('clients.deleted_at', 'null')],
    'aux-definitions.search': [
        allowedFilter('aux_definitions.deleted_at', 'null'),
        allowedFilter('deleted_at', 'null'),
        allowedFilter('name', ['eq', 'ilike']),
        allowedFilter('tablename', 'eq'),
    ],
    'banners.search': [
        allowedFilter('banners.deleted_at', 'null'),
        allowedFilter('deleted_at', 'null'),
        allowedFilter('fecha_fin', 'gte'),
        allowedFilter('fecha_inicio', 'lte'),
        allowedFilter('status', 'eq'),
    ],
    'broker.search': [
        allowedFilter('broker_adapters.deleted_at', 'null'),
        allowedFilter('broker_adapters.name', 'ilike'),
        allowedFilter('broker_adapters.created_at', 'between'),
        allowedFilter('broker_adapters.updated_at', 'between'),
    ],
    'broker-mapper.search': [
        allowedFilter('broker_message_mappers.deleted_at', 'null'),
        allowedFilter('broker_message_mappers.name', 'ilike'),
        allowedFilter('broker_message_mappers.created_at', 'between'),
        allowedFilter('broker_message_mappers.updated_at', 'between'),
    ],
    'case-attachments.search': [allowedFilter('case_id', 'eq'), allowedFilter('deleted_at', 'null')],
    'channel-hub.search': [
        allowedFilter('channel_hub_accounts.country_id', 'eq'),
        allowedFilter('channel_hub_accounts.deleted_at', 'null'),
        allowedFilter('channel_hub_accounts.email', 'ilike'),
        allowedFilter('channel_hub_accounts.name', 'ilike'),
        allowedFilter('deleted_at', 'null'),
    ],
    'cases.case-view.search': caseViewAllowedFilters,
    'cases-2.case-view.search': caseViewAllowedFilters,
    'cases-2.search': casesAllowedFilters,
    'cases-2.sub-cases.search': subCasesAllowedFilters,
    'cases.search': casesAllowedFilters,
    'cases.sub-cases.search': subCasesAllowedFilters,
    'classification-group-relationships.search': [
        allowedFilter('classification_id', 'eq'),
        allowedFilter('deleted_at', 'null'),
        allowedFilter('group_id', 'eq'),
    ],
    'classification-template-relations.search': [allowedFilter('classification_id', 'eq')],
    'classifications.search': [
        allowedFilter('clasificaciones.deleted_at', 'null'),
        allowedFilter('clasificaciones.deleted_by', 'null'),
        allowedFilter('clasificaciones.id', 'eq'),
        allowedFilter('deleted_at', 'null'),
    ],
    'client-notifications.search': [allowedFilter('client_notifications.deleted_at', 'null')],
    'clients.search': [
        allowedFilter('clients.deleted_at', 'null'),
        allowedFilter('deleted_at', 'null'),
        allowedFilter('email', 'ilike'),
        allowedFilter('id', 'like'),
        allowedFilter('status', 'eq'),
        /*
         * Gemelos cualificados: con el join a `aux_clients` las columnas homonimas (`id`,
         * `data`, `created_at`, `deleted_at`) son ambiguas para Postgres, asi que la ejecucion
         * masiva prefija todo filtro nativo con `clients.`. Mismos campos y operadores que sus
         * equivalentes sin prefijar: no amplian lo que un usuario puede consultar.
         */
        allowedFilter('clients.documento', ['eq', 'like', 'ilike']),
        allowedFilter('clients.email', 'ilike'),
        allowedFilter('clients.id', 'like'),
        allowedFilter('clients.status', 'eq'),
        allowedFilter('clients.nombres', ['like', 'ilike']),
        allowedFilter('clients.apellido1', ['like', 'ilike']),
        allowedFilter('clients.apellido2', ['like', 'ilike']),
        allowedFilter('clients.nombre_empresa', ['like', 'ilike']),
        allowedFilter('clients.tipo_cliente', 'ilike'),
        allowedFilter('clients.tipo_documento', 'ilike'),
        allowedFilter('clients.sexo', 'ilike'),
        allowedFilter('clients.estado_civil', 'ilike'),
        allowedFilter('clients.fecha_nacimiento', 'between'),
        allowedFilter('clients.email_alterno', 'ilike'),
        allowedFilter('clients.telefono', 'ilike'),
        allowedFilter('clients.telefono_alterno', 'ilike'),
        allowedFilter('clients.campos_extra1', 'ilike'),
        allowedFilter('clients.campos_extra2', 'ilike'),
        allowedFilter('clients.campos_extra3', 'ilike'),
        allowedFilter('clients.padre_id', 'ilike'),
        allowedFilter('clients.habeas_data', 'ilike'),
        // Filtro por datos del auxiliar del cliente, unico operador admitido.
        allowedFilter('aux_clients.data', 'jsonContains'),
        allowedFilter('aux_clients.deleted_at', 'null'),
    ],
    'comments.search': [allowedFilter('caso_id', 'eq'), allowedFilter('comentarios.caso_id', 'eq')],
    'custom-lists.search': [allowedFilter('custom_lists.deleted_at', 'null')],
    'event-logs.search': [
        allowedFilter('aggregate_id', ['in', 'notIn']),
        allowedFilter('case_id', 'in'),
        allowedFilter('event_name', ['in', 'notIn']),
        allowedFilter('initiated_by_user', ['in', 'notIn']),
        allowedFilter('occurred_at', 'between'),
    ],
    'event-logs.search-by-case.search': [allowedFilter('logs.deleted_at', 'null')],
    'flow.search': [
        allowedFilter('deleted_at', 'null'),
        allowedFilter('flows.deleted_at', 'null'),
        allowedFilter('status', 'eq'),
    ],
    'folio-configurations.search': [
        allowedFilter('deleted_at', 'null'),
        allowedFilter('folio_configurations.created_at', 'between'),
        allowedFilter('folio_configurations.deleted_at', 'null'),
        allowedFilter('folio_configurations.descripcion', 'ilike'),
        allowedFilter('folio_configurations.nombre', 'ilike'),
        allowedFilter('folio_configurations.status', ['eq', 'neq']),
        allowedFilter('folio_configurations.updated_at', 'between'),
        allowedFilter('id', 'eq'),
        allowedFilter('nombre', 'ilike'),
        allowedFilter('status', 'eq'),
    ],
    'generate-csv.search': [
        allowedFilter('csv_export_views.created_at', 'between'),
        allowedFilter('csv_export_views.created_by', 'eq'),
        allowedFilter('csv_export_views.deleted_at', 'null'),
        allowedFilter('csv_export_views.description', 'ilike'),
        allowedFilter('csv_export_views.frequency', 'ilike'),
        allowedFilter('csv_export_views.interval', 'eq'),
        allowedFilter('csv_export_views.is_active', 'eq'),
        allowedFilter('csv_export_views.last_execution_at', 'between'),
        allowedFilter('csv_export_views.next_execution_at', 'between'),
        allowedFilter('csv_export_views.storage_path', 'ilike'),
        allowedFilter('csv_export_views.updated_at', 'between'),
        allowedFilter('csv_export_views.updated_by', 'eq'),
        allowedFilter('deleted_at', 'null'),
    ],
    'geolocation.search': [allowedFilter('deleted_at', 'null'), allowedFilter('user_id', 'eq')],
    'global-configurations.search': [allowedFilter('deleted_at', 'null')],
    'group-lists.search': [allowedFilter('deleted_at', 'null')],
    'group.search': [
        allowedFilter('deleted_at', 'null'),
        allowedFilter('grupos.deleted_at', 'null'),
        allowedFilter('grupos.status', 'eq'),
        allowedFilter('id', 'in'),
        allowedFilter('nombre', 'ilike'),
        allowedFilter('status', 'eq'),
    ],
    'helps-attachments.search': [allowedFilter('deleted_at', 'null'), allowedFilter('help_id', 'eq')],
    'helps.search': [
        allowedFilter('deleted_at', 'null'),
        allowedFilter('helps.color', 'ilike'),
        allowedFilter('helps.created_at', 'between'),
        allowedFilter('helps.created_by', 'eq'),
        allowedFilter('helps.deleted_at', 'null'),
        allowedFilter('helps.descripcion', 'ilike'),
        allowedFilter('helps.is_active', 'eq'),
        allowedFilter('helps.titulo', 'ilike'),
        allowedFilter('helps.updated_at', 'between'),
        allowedFilter('helps.updated_by', 'eq'),
        allowedFilter('is_active', 'eq'),
    ],
    'imports-dashboard.search': [
        allowedFilter('s3_import_files.created_at', 'between'),
        // created_by is intentionally NOT allowed here: the imports dashboard is
        // per-user and the controller injects created_by = <caller> server-side.
        // Accepting it from the client would let a caller request another user's rows.
        allowedFilter('s3_import_files.error_details', 'ilike'),
        allowedFilter('s3_import_files.file_path', 'ilike'),
        allowedFilter('s3_import_files.last_updated_at', 'between'),
        allowedFilter('s3_import_files.processed_records', 'eq'),
        allowedFilter('s3_import_files.status', 'ilike'),
        allowedFilter('s3_import_files.total_records', 'eq'),
        allowedFilter('s3_import_files.upload_attempts', 'eq'),
    ],
    'interactions.associate-interaction-to-caso.search': [allowedFilter('deleted_at', 'null')],
    'interactions.candidate-cases.search': [
        allowedFilter('cliente_id', 'eq'),
        allowedFilter('deleted_at', 'null'),
        allowedFilter('fecha_resolucion', 'null'),
        allowedFilter('id', 'notIn'),
        allowedFilter('reference', 'eq'),
        allowedFilter('nivel1', 'ilike'),
        allowedFilter('nivel2', 'ilike'),
        allowedFilter('nivel3', 'ilike'),
        allowedFilter('nivel4', 'ilike'),
        allowedFilter('nivel5', 'ilike'),
        allowedFilter('nivel6', 'ilike'),
        allowedFilter('nivel7', 'ilike'),
        allowedFilter('nivel8', 'ilike'),
        allowedFilter('nivel9', 'ilike'),
        allowedFilter('nivel10', 'ilike'),
        allowedFilter('nombres', 'ilike'),
        allowedFilter('login', 'ilike'),
    ],
    'interactions.search': [
        allowedFilter('deleted_at', 'null'),
        allowedFilter('in_review', 'eq'),
        allowedFilter('is_closed', 'eq'),
        allowedFilter('start_review_by', 'eq'),
        allowedFilter('subject', 'ilike'),
        allowedFilter('workspace_id', ['eq', 'neq', 'null']),
    ],
    'literals.search': [
        allowedFilter('deleted_at', 'null'),
        allowedFilter('is_active', 'eq'),
        allowedFilter('tipo_literal', ['eq', 'null']),
    ],
    'mail-accounts.search': [
        allowedFilter('deleted_at', 'null'),
        allowedFilter('mail_accounts.created_at', 'between'),
        allowedFilter('mail_accounts.created_by', 'eq'),
        allowedFilter('mail_accounts.deleted_at', 'null'),
        allowedFilter('mail_accounts.description', 'ilike'),
        allowedFilter('mail_accounts.host', 'ilike'),
        allowedFilter('mail_accounts.is_active', ['eq', 'neq']),
        allowedFilter('mail_accounts.port', 'eq'),
        allowedFilter('mail_accounts.protocol', 'ilike'),
        allowedFilter('mail_accounts.type', 'ilike'),
        allowedFilter('mail_accounts.updated_at', 'between'),
        allowedFilter('mail_accounts.updated_by', 'eq'),
    ],
    'one-script.search': [
        allowedFilter('deleted_at', 'null'),
        allowedFilter('id', ['eq', 'in']), // board option labels (useSearchableSelectOptions ensure)
        allowedFilter('name', 'ilike'),
    ],
    'report-executions.search': [
        allowedFilter('created_at', 'between'),
        allowedFilter('created_by', 'eq'),
        allowedFilter('period', 'jsonPathDateBetween'),
        allowedFilter('report_executions.deleted_at', 'null'),
    ],
    'reports.search': [allowedFilter('report_executions.deleted_at', 'null')],
    'roles.search': [allowedFilter('deleted_at', 'null'), allowedFilter('descripcion', 'ilike')],
    'schemas.search': [
        allowedFilter('deleted_at', 'null'),
        allowedFilter('name', 'ilike'),
        allowedFilter('schemas.deleted_at', 'null'),
    ],
    'schemas.rules.search': [
        allowedFilter('deleted_at', 'null'),
        allowedFilter('id', 'eq'),
        allowedFilter('name', 'eq'),
        allowedFilter('name', 'ilike'),
        allowedFilter('schemas.deleted_at', 'null'),
    ],
    'secrets-vault.search': [
        allowedFilter('boveda_secretos.created_at', 'between'),
        allowedFilter('boveda_secretos.created_by', 'eq'),
        allowedFilter('boveda_secretos.deleted_at', 'null'),
        allowedFilter('boveda_secretos.descripcion', 'ilike'),
        allowedFilter('boveda_secretos.referencia', 'ilike'),
        allowedFilter('boveda_secretos.updated_at', 'between'),
        allowedFilter('boveda_secretos.updated_by', 'eq'),
        allowedFilter('deleted_at', 'null'),
    ],
    'shift-management.search': [
        allowedFilter('deleted_at', 'null'),
        allowedFilter('shift_management.deleted_at', 'null'),
    ],
    'states.search': [allowedFilter('deleted_at', 'null'), allowedFilter('states.deleted_at', 'null')],
    'template-attachments.search': [allowedFilter('deleted_at', 'null'), allowedFilter('template_id', 'eq')],
    'templates.search': [
        allowedFilter('deleted_at', 'null'),
        allowedFilter('descripcion', 'ilike'),
        allowedFilter('plantillas.deleted_at', 'null'),
    ],
    'transition-rules.search': [
        allowedFilter('deleted_at', 'null'),
        allowedFilter('transition_rules.deleted_at', 'null'),
    ],
    'transitions.search': [
        allowedFilter('transiciones.estado_actual_id', 'eq'),
        allowedFilter('transiciones.flujo_id', 'eq'),
    ],
    'user-group-relations.search': [
        allowedFilter('deleted_at', 'null'),
        allowedFilter('grupos.nombre', 'ilike'),
        allowedFilter('grupos.status', 'eq'),
        allowedFilter('rel_usuarios_grupos.grupo_id', 'eq'),
        allowedFilter('usuario_id', 'eq'),
    ],
    'user-notifications.search': [allowedFilter('user_notifications.deleted_at', 'null')],
    'users.search': [
        allowedFilter('deleted_at', 'null'),
        allowedFilter('id', 'in'),
        allowedFilter('status', 'eq'),
        allowedFilter('usuarios.deleted_at', 'null'),
    ],
    'users.search-by-name.search': [allowedFilter('nombres', 'eq')],
    'workspaces.search': [
        allowedFilter('deleted_at', 'null'),
        allowedFilter('id', 'neq'),
        allowedFilter('is_active', 'eq'),
        allowedFilter('workspaces.deleted_at', 'null'),
    ],
    'ws-rest-endpoints.search': [
        allowedFilter('deleted_at', 'null'),
        allowedFilter('ws_rest_endpoints.authorization', 'notNull'),
        allowedFilter('ws_rest_endpoints.deleted_at', 'null'),
        allowedFilter('ws_rest_endpoints.type', 'eq'),
    ],
    'ws-rest-flows.search': [
        allowedFilter('deleted_at', 'null'),
        allowedFilter('description', 'ilike'),
        allowedFilter('external_code', ['eq', 'like']),
        allowedFilter('id', ['eq', 'in']), // board option labels (useSearchableSelectOptions ensure)
        allowedFilter('is_active', 'eq'),
        allowedFilter('is_primary', 'eq'),
        allowedFilter('ws_rest_flows.deleted_at', 'null'),
    ],
    'ws-rest-functions.search': [
        allowedFilter('deleted_at', 'null'),
        allowedFilter('ws_rest_functions.deleted_at', 'null'),
    ],
};

const frontendAllowedRelationshipsByEndpointKey = {
    'appointments.search': [
        { table: 'cases', type: 'join', condition: { column: 'cases.id', refColumn: 'appointments.case_id' } },
    ],
    'aux-clients.search': [
        { table: 'clients', type: 'left', condition: { column: 'clients.id', refColumn: 'aux_clients.cliente_id' } },
    ],
    // La ejecucion masiva previsualiza siempre contra `clients` y adjunta el auxiliar por join,
    // de modo que un cliente sin fila en `aux_clients` siga apareciendo (de ahi el `left`).
    'clients.search': [
        {
            table: 'aux_clients',
            type: 'left',
            condition: { column: 'aux_clients.cliente_id', refColumn: 'clients.id' },
        },
    ],
};

const customQueryFieldAllowlists = {
    // TODO(KTSS-3211): `orders` debería normalizarse al canónico `order` en el DTO de boards.
    'boards.board-resources.search': ['tableName', 'orders', 'subQuery', 'quickAnsFilter'],
    'boards.available-boards.search': ['userId', 'groupId'],
    'auxiliaries.list.search': ['entity', 'field'],
    'case-session-duration.search': ['userId', 'caseId', 'page', 'pageSize'],
    'reports.search': ['name'],
    'users.search-by-name.search': ['name'],
};

const toPascalCase = (value) =>
    value
        .split(/[^a-zA-Z0-9]+/)
        .filter(Boolean)
        .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
        .join('');

const endpointModuleOverrides = {
    'action-batch-executions.process-queue': 'actions-queue-executor',
    'action-batch-executions': 'actions-queue-executions',
    'action-batch-executions.validate-csv': 'actions-queue-executions',
    'action-update-model': 'actions',
    'auxiliaries.list-search': 'auxiliaries',
    'auxiliaries.list': 'auxiliaries',
    'boards.available-boards': 'boards',
    'boards.board-resources': 'boards',
    'broker-mapper': 'broker_mappers',
    broker: 'broker_adapters',
    'case-session-duration': 'cases',
    'cases-2': 'cases',
    'cases-2.case-view': 'cases',
    'cases-2.case-visible': 'cases',
    'cases-2.sub-cases': 'cases',
    'cases.case-view': 'cases',
    'cases.case-visible': 'cases',
    'cases.sub-cases': 'cases',
    'custom-lists.active-group': 'custom-lists',
    'event-logs.search-by-case': 'event-logs',
    flow: 'flows',
    'generate-csv': 'csv-export-views',
    'group-lists': 'group-list',
    group: 'groups',
    'helps-attachments': 'help-attachments',
    helps: 'help',
    'interactions.associate-interaction-to-caso': 'interactions',
    'interactions.candidate-cases': 'interactions',
    'one-script': 'onescripts',
    'report-executions': 'exports',
    reports: 'exports',
    states: 'state',
    'upload-s3-files.scan-file': 's3-files',
    'user-group-relations': 'user-group-relationships',
    'users.search-by-name': 'users',
    'ws-rest-steps': 'ws-rest-workflow-steps',
};

const endpointNameFromEndpointKey = (endpointKey) => endpointKey.replace(/\.search$/, '');

const moduleIdFromEndpointKey = (endpointKey) => {
    const endpointName = endpointNameFromEndpointKey(endpointKey);
    return endpointModuleOverrides[endpointName] ?? endpointName;
};

const endpointPolicyConfigurationAliases = {
    'cases-2.case-view.search': 'cases.case-view.search',
    'cases-2.case-visible.search': 'cases.case-visible.search',
    'cases-2.search': 'cases.search',
    'cases-2.sub-cases.search': 'cases.sub-cases.search',
};

const policyAllowedFilterOverrides = {
    'cases.search': [
        ...frontendAllowedFiltersByEndpointKey['cases.search'],
        { field: 'id', operators: ['eq'] },
        { field: 'reference', operators: ['eq', 'like', 'ilike'] },
        { field: 'cliente_id', operators: ['eq'] },
        { field: 'responsable_id', operators: ['eq'] },
        { field: 'grupo_id', operators: ['eq'] },
        { field: 'estado_actual_id', operators: ['eq'] },
        { field: 'deleted_by', operators: ['null'] },
    ],
};

const createDefaultSearchPolicy = (endpointKey) => {
    const endpointName = endpointNameFromEndpointKey(endpointKey);
    const moduleId = moduleIdFromEndpointKey(endpointKey);
    const configurationEndpointKey = endpointPolicyConfigurationAliases[endpointKey] ?? endpointKey;

    return {
        endpointKey,
        advancedPermission: advancedPermissionForEndpointKey(
            endpointKey,
            moduleId,
            `${toPascalCase(endpointName)}SearchAdvanced`
        ),
        baseFilter: [],
        baseRelationships: [],
        allowedFilters:
            policyAllowedFilterOverrides[configurationEndpointKey] ||
            frontendAllowedFiltersByEndpointKey[configurationEndpointKey] ||
            [],
        allowedRelationships: frontendAllowedRelationshipsByEndpointKey[configurationEndpointKey] || [],
        allowedCapabilities: createDefaultCapabilities(),
        allowedCustomQueryFields: customQueryFieldAllowlists[configurationEndpointKey] || [],
    };
};

const defaultSearchEndpointKeys = [
    'action-batch-executions.process-queue.search',
    'action-batch-executions.search',
    'action-batch-executions.validate-csv.search',
    'action-update-model.search',
    'actions.search',
    'agendas-groups.search',
    'agendas.search',
    'allowed-connections.search',
    'ans.search',
    'appointment-time-slots.search',
    'appointments.search',
    'assignment-users-list.search',
    'automation-settings.search',
    'aux-clients.search',
    'aux-definitions.search',
    'auxiliaries.list-search.search',
    'auxiliaries.list.search',
    'auxiliaries.search',
    'boards.available-boards.search',
    'boards.board-resources.search',
    'broker-mapper.search',
    'broker.search',
    'case-attachments.search',
    'case-descriptions.search',
    'case-session-duration.search',
    'cases-2.case-view.search',
    'cases-2.case-visible.search',
    'cases-2.search',
    'cases-2.sub-cases.search',
    'cases.case-view.search',
    'cases.case-visible.search',
    'cases.sub-cases.search',
    'channel-hub.search',
    'classification-group-relationships.search',
    'classification-template-relations.search',
    'classifications.search',
    'client-notifications.search',
    'comments.search',
    'custom-lists.active-group.search',
    'custom-lists.search',
    'emails.search',
    'event-logs.search',
    'event-logs.search-by-case.search',
    'flow.search',
    'folio-configurations.search',
    'generate-csv.search',
    'geolocation.search',
    'global-configurations.search',
    'group-lists.search',
    'group.search',
    'helps-attachments.search',
    'helps.search',
    'imports-dashboard.search',
    'interactions.associate-interaction-to-caso.search',
    'interactions.candidate-cases.search',
    'interactions.search',
    'literals.search',
    'mail-accounts.search',
    'one-script.search',
    'report-executions.search',
    'reports.search',
    'roles.search',
    's3-files.search',
    'schemas.rules.search',
    'schemas.search',
    'secrets-vault.search',
    'shift-management.search',
    'states.search',
    'template-attachments.search',
    'templates.search',
    'transition-rules.search',
    'transitions.search',
    'upload-s3-files.scan-file.search',
    'user-group-relations.search',
    'user-notifications.search',
    'users.search-by-name.search',
    'workspaces.search',
    'ws-rest-endpoints.search',
    'ws-rest-flows.search',
    'ws-rest-functions.search',
    'ws-rest-steps.search',
];

const clientSpecificRequiredFilters = [
    allowedFilter('clients.documento', ['eq', 'like', 'ilike']),
    allowedFilter('documento', ['eq', 'like', 'ilike']),
    allowedFilter('email', 'ilike'),
    allowedFilter('id', 'like'),
    allowedFilter('nombres', ['like', 'ilike']),
    allowedFilter('apellido1', ['like', 'ilike']),
    allowedFilter('apellido2', ['like', 'ilike']),
    allowedFilter('nombre_empresa', ['like', 'ilike']),
    allowedFilter('email_alterno', 'ilike'),
    allowedFilter('telefono', 'ilike'),
    // Gemelos cualificados de los anteriores: la ejecucion masiva prefija por el join a
    // `aux_clients`, y un criterio no deja de ser especifico por llevar el nombre de tabla.
    allowedFilter('clients.email', 'ilike'),
    allowedFilter('clients.id', 'like'),
    allowedFilter('clients.nombres', ['like', 'ilike']),
    allowedFilter('clients.apellido1', ['like', 'ilike']),
    allowedFilter('clients.apellido2', ['like', 'ilike']),
    allowedFilter('clients.nombre_empresa', ['like', 'ilike']),
    allowedFilter('clients.email_alterno', 'ilike'),
    allowedFilter('clients.telefono', 'ilike'),
    /*
     * Un predicado concreto sobre el auxiliar del cliente tambien acota la busqueda: el grupo
     * exige valor no vacio (`valueHasSearchSignal`), asi que no sirve para volcar la tabla, y es
     * el unico criterio disponible cuando la ejecucion masiva filtra por datos del auxiliar.
     */
    allowedFilter('aux_clients.data', 'jsonContains'),
];

export const searchPolicies = [
    {
        endpointKey: 'clients.search',
        advancedPermission: advancedPermissionForEndpointKey('clients.search', 'clients', 'ClientsSearchAdvanced'),
        baseFilter: [{ field: 'status', operator: 'eq', value: 1, type: 'AND' }],
        baseRelationships: [],
        allowedFilters: [
            ...frontendAllowedFiltersByEndpointKey['clients.search'],
            { field: 'documento', operators: ['eq', 'like', 'ilike'] },
            { field: 'nombres', operators: ['like', 'ilike'] },
            { field: 'apellido1', operators: ['like', 'ilike'] },
            { field: 'apellido2', operators: ['like', 'ilike'] },
            { field: 'nombre_empresa', operators: ['like', 'ilike'] },
        ],
        requiredFilterGroups: [
            {
                name: 'client_specific_search_criteria',
                filters: clientSpecificRequiredFilters,
            },
        ],
        allowedRelationships: frontendAllowedRelationshipsByEndpointKey['clients.search'],
        allowedCapabilities: createDefaultCapabilities(),
        allowedCustomQueryFields: [],
        /*
         * KTSS-000: Gobernanza explícita sobre tablas secundarias unidas en modo restringido.
         * El acceso al join y filtros de `aux_clients` está condicionado a que el usuario cuente
         * con permiso de lectura de auxiliares de clientes (`AuxClientRead` o `AuxClientsSearchAdvanced`),
         * evitando que usuarios con acceso base únicamente a `clients.search` sondeen datos auxiliares.
         */
        requiredTablePermissions: {
            aux_clients: [
                { role: 'administrador', module_id: 'aux-clients', name: 'AuxClientRead' },
                { role: 'search', module_id: 'aux-clients', name: 'AuxClientsSearchAdvanced' },
            ],
        },
    },
    {
        endpointKey: 'cases.search',
        advancedPermission: advancedPermissionForEndpointKey('cases.search', 'cases', 'CasesSearchAdvanced'),
        baseFilter: [],
        baseRelationships: [],
        allowedFilters: policyAllowedFilterOverrides['cases.search'],
        allowedRelationships: [],
        allowedCapabilities: createDefaultCapabilities(),
        allowedCustomQueryFields: [],
    },
    {
        endpointKey: 'users.search',
        advancedPermission: advancedPermissionForEndpointKey('users.search', 'users', 'UsersSearchAdvanced'),
        baseFilter: [{ field: 'usuarios.deleted_at', operator: 'null', value: 'null', type: 'AND' }],
        baseRelationships: [],
        allowedFilters: [
            ...frontendAllowedFiltersByEndpointKey['users.search'].filter(({ field }) => field !== 'id'),
            { field: 'id', operators: ['eq', 'in'] },
            { field: 'login', operators: ['eq', 'like', 'ilike'] },
            { field: 'email', operators: ['eq', 'like', 'ilike'] },
            { field: 'is_active', operators: ['eq'] },
            { field: 'rol_id', operators: ['eq'] },
            { field: 'deleted_by', operators: ['null'] },
            { field: 'nombres', operators: ['ilike'] },
            { field: 'apellido1', operators: ['ilike'] },
            { field: 'apellido2', operators: ['ilike'] },
        ],
        allowedRelationships: [],
        allowedCapabilities: createDefaultCapabilities(),
        allowedCustomQueryFields: [],
    },
    {
        endpointKey: 'boards.search',
        advancedPermission: advancedPermissionForEndpointKey('boards.search', 'boards', 'BoardsSearchAdvanced'),
        baseFilter: [],
        baseRelationships: [],
        allowedFilters: [
            { field: 'id', operators: ['eq'] },
            { field: 'name', operators: ['eq', 'like', 'ilike'] },
            { field: 'is_active', operators: ['eq'] },
            { field: 'boards.deleted_at', operators: ['null'] },
            { field: 'boards.name', operators: ['ilike'] },
            { field: 'boards.description', operators: ['ilike'] },
            { field: 'boards.primary_entity', operators: ['ilike'] },
            { field: 'boards.is_active', operators: ['eq'] },
            { field: 'boards.created_at', operators: ['between'] },
            { field: 'boards.updated_at', operators: ['between'] },
            { field: 'access_users_ids', operators: ['in'] },
            { field: 'access_groups_ids', operators: ['in'] },
        ],
        allowedRelationships: [],
        allowedCapabilities: createDefaultCapabilities(),
        allowedCustomQueryFields: [],
    },
    {
        endpointKey: 'banners.search',
        advancedPermission: advancedPermissionForEndpointKey('banners.search', 'banners', 'BannersSearchAdvanced'),
        baseFilter: [],
        baseRelationships: [],
        allowedFilters: frontendAllowedFiltersByEndpointKey['banners.search'],
        allowedRelationships: [],
        allowedCapabilities: createDefaultCapabilities(),
        allowedCustomQueryFields: [],
    },
    ...defaultSearchEndpointKeys.map(createDefaultSearchPolicy),
];

export const getSearchPolicy = (endpointKey, policies = searchPolicies) => {
    const policy = policies.find((candidate) => candidate.endpointKey === endpointKey);
    if (!policy) {
        throw new Error(`Search policy not found for endpoint: ${endpointKey}`);
    }
    return policy;
};

export const getSearchPermissionDefinitions = (policies = searchPolicies) =>
    policies.map(({ endpointKey, advancedPermission }) => ({
        module_id: advancedPermission.module_id,
        name: advancedPermission.name,
        description: `Use advanced search filters on ${endpointKey}`,
        granted: false,
    }));
