/**
 * Central read/write routing policy (single source of truth).
 *
 * priority: true  => reads AND writes go to the primary (writer).
 * priority: false => reads go to the replica, writes go to the primary.
 *
 * Default (service absent here) => "primary" (fail-safe).
 *
 * serviceKey MUST match the id passed to KApiStack.setDefaultOptions(id)
 * (e.g. "cases-count" for kace_cloud_api_case_count).
 */
export const SERVICE_DB_ROUTING = {
    // --- Non-priority: reads served from the replica, writes to the primary ---
    'cases-count': { priority: false }, // Oleada 3 pilot
    'cases-count-by-group': { priority: false }, // Fase 2 — count reads to replica
    'cases-count-by-responsable': { priority: false }, // Fase 2 — count reads to replica
    reports: { priority: false }, // Oleada 4 (read-only reporting)
    // Oleada 5
    ans: { priority: false },
    classifications: { priority: false },
    'classifications-levels': { priority: false },
    'classifications-groups-relationships': { priority: false },
    'classifications-groups-relationships-batch': { priority: false },
    'classifications-groups-relationships-batch-delete': { priority: false },
    'classification-template-relations': { priority: false },
    'user-cases-assignment': { priority: false },
    'user-group-relationships': { priority: false },
    'users-notifications': { priority: false },
    users: { priority: false },
    cases: { priority: false }, // Fase 0 — list/count read-only reads to replica
    boards: { priority: false }, // Fase 2 (2026-06-24) — board reads to replica
    'case-available-states': { priority: false }, // Oleada 6a (read-only available-states)
    'case-reclassification-precheck': { priority: false }, // MSKT-1392 (read-only reclassification precheck; subcase relationship reads stay on writer)
    'states-distinct': { priority: false }, // Oleada 6b (distinct states count, read-only)
    'global-configuration-get': { priority: false }, // Oleada 6b (read-only global config get)
    clients_doc_types: { priority: false }, // Oleada 6b (client doc types, read-only)
    clients_contacts: { priority: false }, // Oleada 6b (client contacts search, read-only)
    'imports-dashboard': { priority: false }, // Oleada 6b (imports dashboard reads, read-only)
    literals: { priority: false }, // Oleada 7 Tier B (literals CRUD — reads to replica, writes markWrite)
    'group-lists': { priority: false }, // Oleada 7 Tier B (group-lists CRUD — reads to replica, writes markWrite)
    'automation-settings': { priority: false }, // Oleada 7 Tier B (automation-settings CRUD — reads to replica, writes markWrite)
    'allowed-connections': { priority: false }, // Oleada 7 Tier B (allowed-connections CRUD — reads to replica, writes markWrite)
    banners: { priority: false }, // Oleada 7 Tier B (banners CRUD — reads to replica; delete now saves history)
    helps_attachments: { priority: false }, // Oleada 7 Tier B (helps attachments CRUD — reads to replica; delete now saves history)
    helps: { priority: false }, // Oleada 7 Tier B (helps CRUD — reads to replica; delete now saves history)
    customlists: { priority: false }, // Oleada 7 Tier B (custom-lists CRUD — reads to replica, writes markWrite)
    geolocation: { priority: false }, // Oleada 7 Tier B (geolocation CRUD — reads to replica, writes markWrite)
    schemas: { priority: false }, // Oleada 7 Tier B (schemas CRUD — reads to replica, writes markWrite/saveHistory)
    'aux-definitions': { priority: false }, // Oleada 7 Tier B (aux-definitions reads to replica; DDL stays on writer)
    states: { priority: false }, // Oleada 8 (states CRUD — reads to replica; delete now saves history)
    transitions: { priority: false }, // Oleada 8 (transitions — search to replica; find kept on writer for cache/write-path)
    'transition-rules': { priority: false }, // Oleada 8 (transition-rules CRUD — reads to replica, writes markWrite)
    'folio-configurations': { priority: false }, // folio-configurations CRUD — reads to replica, writes markWrite
    templates: { priority: false }, // Oleada 8 (templates CRUD — reads to replica; delete now saves history)
    'template-attachments': { priority: false }, // Oleada 8 (template-attachments CRUD — reads to replica, writes markWrite)
    groups: { priority: false }, // Oleada 9 (groups CRUD — find/search/count to replica; worker/cleaner stay on writer)
    roles: { priority: false }, // Oleada 9 (roles CRUD — find/search/count to replica, writes markWrite/saveHistory)
    'assignment-users-list': { priority: false }, // Oleada 9 (user-lists CRUD — find/search/count to replica, writes markWrite)
    'client-notifications': { priority: false }, // Oleada 10 (client-notifications CRUD — reads to replica, writes markWrite/saveHistory)
    'mail-accounts': { priority: false }, // Oleada 10 (mail-accounts CRUD — reads to replica, writes markWrite/saveHistory; worker/workflow stay on writer)
    comments: { priority: false }, // Oleada 11 (comments CRUD — reads to replica, writes markWrite/saveHistory)
    'comments-batch': { priority: false }, // Batch create (duplicate-id find to replica; transactional inserts markWrite)
    interactions: { priority: false }, // Oleada 11 Tier C (interactions CRUD + associate — reads to replica; associate save/webhook use markWrite)
    'interactions-batch': { priority: false }, // Batch create (sólo escrituras: la unicidad de email y los inserts van al writer dentro de la transacción)
    emails: { priority: false }, // Oleada 11 (emails CRUD — reads to replica, direct writes markWrite; webhook stays on writer)
    'report-executions': { priority: false }, // Oleada 11 (report-executions — reads to replica, writes markWrite; reports worker stays on writer)
    agendas: { priority: false }, // Oleada 12 (agendas CRUD — findAll/search/count to replica; find + delete-guard count stay on writer)
    'agendas-groups': { priority: false }, // Oleada 12 (agenda-group pivot — search/count to replica; find idempotency + writes markWrite)
    appointments: { priority: false }, // Oleada 12 Tier C (appointments — findAll/search/countByCase to replica; availability guards stay on writer)
    'appointment-time-slots': { priority: false }, // Oleada 12 Tier C (time slots — findAll/search/count to replica; overlap/limit guards stay on writer)
    'shift-management': { priority: false }, // Oleada 12 (shift management CRUD — find/search/count to replica, writes markWrite/saveHistory)
    'case-attachments': { priority: false }, // Oleada 13 (case-attachments satellite — search/count to replica; find + cases reads stay on writer)
    'case-descriptions': { priority: false }, // Oleada 13 (case-descriptions satellite — search to replica; find + cases reads stay on writer)
    'case-session-duration': { priority: false }, // Oleada 13 Tier C (session durations — search/count to replica; find/duplicate guards + cases stay on writer)
    'global-configuration': { priority: false }, // Oleada 14 (global-config CRUD — find/search/findByIds to replica; writes markWrite/saveHistory)
    'schema-fields': { priority: false }, // Oleada 14 (field-list metadata — 100% read of information_schema/pg_catalog to replica)
    exports: { priority: false }, // Oleada 15 (exports — read-only export generation to replica)
    's3-files': { priority: false }, // Oleada 15 (s3-files — read-only file metadata to replica)
    cases2: { priority: false }, // Oleada 15 (cases_2 — reader-ready view/visible/default reads to replica)
    'broker-adapters': { priority: false }, // Oleada 16 (broker adapters — reads to replica, writes markWrite)
    'broker-mappers': { priority: false }, // Oleada 16 (broker mappers — reads to replica, writes markWrite)
    workspaces: { priority: false }, // Oleada 16 (workspaces CRUD — reads to replica, writes markWrite)
    one_script: { priority: false }, // Oleada 16 (one_script — read-only script metadata to replica)
    'event-logs': { priority: false }, // Oleada 16 (event-logs — read-only log reads to replica)
    'generate-csv': { priority: false }, // Oleada 16 (generate-csv — read-only export generation to replica)
    'assignment-runs': { priority: false }, // Automated assignment observability (read-only run history to replica)

    // --- Priority: reads AND writes on the primary (latency-sensitive / write-heavy / mixed) ---
    actions: { priority: true },
    'action-jobs': { priority: true }, // kace_cloud_api_action_batch_executions
    'action-update-model': { priority: true },
    auxiliaries: { priority: true },
    'aux-cases': { priority: true },
    'aux-clients': { priority: true },
    clients: { priority: true },
    // Oleada 13 — write-only actions on the cases aggregate (reuse KnexCaseRepository); deliberately
    // excluded from replica routing, registered explicitly to guard against accidental non-priority drift.
    'case-clone': { priority: true },
    'case-close': { priority: true },
    'case-re-open': { priority: true },
    'case-reclassification': { priority: true },
    'case-transitions': { priority: true }, // MSKT-1392 — revertida de Oleada 6a: el timeline se sirve desde otra Lambda que la que escribe (reclasificación/transición), sin read-your-writes entre servicios; el motivo/nodo llegaba stale desde la réplica justo tras reclasificar
    'global-configuration-set': { priority: true }, // Oleada 14 — write-only config setter (reuse KnexGlobalConfigurationRepository); find() is pre-write load
    'ws-hook-rest-flows': { priority: true },
    'ws-rest-endpoints': { priority: true },
    'ws-rest-flows': { priority: true },
    'ws-rest-functions': { priority: true },
    'ws-rest-workflow-steps': { priority: true }, // kace_cloud_api_ws_rest_steps
    // Oleada 15 — write-heavy / excluded I/O services; registered explicitly to guard against non-priority drift.
    imports: { priority: true }, // write-only INSERT; read-before-write metadata
    'imports-processor': { priority: true }, // EventBridge/cron transactional worker; read-after-write + locks
    'cases-bulk': { priority: true }, // write-only bulk actions on cases aggregate; publishes events
    tempcases: { priority: true }, // fake_cases shadow CRUD; reads are single-row/FK-guards in write-path
    tempclients: { priority: true }, // fake_clients shadow CRUD; reads are idempotency/admin single-row
    flows: { priority: true }, // flow service; search() has write-on-read auto-heal — pinned to writer
    'secrets-vaults': { priority: true }, // secrets_vault CRUD over boveda_secretos; low-traffic + sensitive
    // Oleada 16 — write-heavy / worker / auth services; registered explicitly to guard against non-priority drift.
    'ans-calculate': { priority: true }, // writes cases SLA bulk
    'case-calculate-ans': { priority: true }, // read-modify-write of a case
    group_cases_assignment: { priority: true }, // write-only case reassignment
    'auth-cognito': { priority: true }, // auth write-path
    'debug-toggle': { priority: true }, // debug flag writes + scheduler
    'dashboard-counts-refresh': { priority: true }, // REFRESH MATERIALIZED VIEW worker
    'partition-maintenance': { priority: true }, // DDL partition worker
    'event-processor': { priority: true }, // SQS/EventBridge write-heavy worker
};

/**
 * @param {string} serviceKey
 * @returns {"primary"|"replica"}
 */
export const getDbTarget = (serviceKey) => {
    const entry = SERVICE_DB_ROUTING[serviceKey];
    if (!entry) {
        return 'primary';
    }
    return entry.priority ? 'primary' : 'replica';
};

/**
 * CDK/deploy transport helper: maps a serviceKey to the Lambda env override.
 * @param {string} serviceKey
 * @returns {{ DB_TARGET: 'primary'|'replica' }}
 */
export const resolveDbTargetEnv = (serviceKey) => ({ DB_TARGET: getDbTarget(serviceKey) });
