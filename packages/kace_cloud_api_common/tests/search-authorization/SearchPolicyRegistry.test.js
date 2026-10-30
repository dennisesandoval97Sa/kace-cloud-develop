import {
    createAdvancedPermission,
    getSearchPermissionDefinitions,
    getSearchPolicy,
    searchPolicies,
} from '../../src/search-authorization/SearchPolicyRegistry.js';
import { findDisallowedFilters, findMissingBaseFilters } from '../../src/search-authorization/filterMatcher.js';
import { ListPermissions } from '@kace/core/src/role/domain/ListPermissions.js';
import { SearchPermissionsCatalog } from '@kace/core/src/role/domain/SearchPermissionsCatalog.js';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

const loadInventoryEndpointKeys = () =>
    JSON.parse(execFileSync('pnpm', ['--silent', 'search-auth:inventory'], { cwd: repoRoot, encoding: 'utf8' })).map(
        ({ endpointKey }) => endpointKey
    );

const defaultCapabilities = {
    pagination: true,
    order: true,
    relationship: true,
    select: false,
    distinct: false,
    group_by: false,
    having: false,
};

describe('SearchPolicyRegistry', () => {
    it('creates search advanced permission descriptors', () => {
        expect(createAdvancedPermission('cases', 'CasesSearchAdvanced')).toEqual({
            role: 'search',
            module_id: 'cases',
            name: 'CasesSearchAdvanced',
        });
    });

    it('registers the initial sensitive endpoint policies', () => {
        expect(searchPolicies.map(({ endpointKey }) => endpointKey)).toEqual(
            expect.arrayContaining(['clients.search', 'cases.search', 'users.search', 'boards.search'])
        );
    });

    it('registers exactly one policy for every inventoried search endpoint', () => {
        const inventoryEndpointKeys = loadInventoryEndpointKeys().sort();
        const policyEndpointKeys = searchPolicies.map(({ endpointKey }) => endpointKey).sort();

        expect(policyEndpointKeys).toEqual(inventoryEndpointKeys);
        expect(new Set(policyEndpointKeys).size).toBe(policyEndpointKeys.length);
    });

    it('keeps cases-2 authorization aligned with the canonical cases endpoints', () => {
        const aliases = {
            'cases-2.case-view.search': 'cases.case-view.search',
            'cases-2.case-visible.search': 'cases.case-visible.search',
            'cases-2.search': 'cases.search',
            'cases-2.sub-cases.search': 'cases.sub-cases.search',
        };

        for (const [aliasEndpointKey, canonicalEndpointKey] of Object.entries(aliases)) {
            const aliasPolicy = getSearchPolicy(aliasEndpointKey);
            const canonicalPolicy = getSearchPolicy(canonicalEndpointKey);

            expect(aliasPolicy.advancedPermission).toEqual(canonicalPolicy.advancedPermission);
            expect(aliasPolicy.allowedFilters).toEqual(canonicalPolicy.allowedFilters);
            expect(aliasPolicy.allowedRelationships).toEqual(canonicalPolicy.allowedRelationships);
            expect(aliasPolicy.allowedCustomQueryFields).toEqual(canonicalPolicy.allowedCustomQueryFields);
        }
    });

    it('keeps non-frontend-inventoried endpoints locked down by default', () => {
        expect(getSearchPolicy('action-batch-executions.process-queue.search')).toMatchObject({
            baseFilter: [],
            baseRelationships: [],
            allowedFilters: [],
            allowedRelationships: [],
            allowedCapabilities: defaultCapabilities,
            allowedCustomQueryFields: [],
        });
    });

    it('uses common conservative capabilities for non-specific endpoint policies', () => {
        const specificEndpointKeys = new Set([
            'clients.search',
            'cases.search',
            'users.search',
            'boards.search',
            'banners.search',
            'case-session-duration.search',
            'reports.search',
        ]);

        for (const policy of searchPolicies.filter(({ endpointKey }) => !specificEndpointKeys.has(endpointKey))) {
            expect(policy.baseFilter).toEqual([]);
            expect(policy.baseRelationships).toEqual([]);
            expect(policy.allowedCapabilities).toEqual(defaultCapabilities);
        }
    });

    it('registers inventoried frontend filter allowlists on matching default endpoints', () => {
        expect(getSearchPolicy('agendas.search').allowedFilters).toEqual(
            expect.arrayContaining([{ field: 'deleted_at', operators: ['null'] }])
        );
        expect(getSearchPolicy('actions.search').allowedFilters).toEqual(
            expect.arrayContaining([
                { field: 'actions.deleted_at', operators: ['null'] },
                { field: 'description', operators: ['ilike'] },
                { field: 'id', operators: ['eq', 'in'] },
                { field: 'is_active', operators: ['eq'] },
            ])
        );
        expect(getSearchPolicy('action-batch-executions.process-queue.search').allowedFilters).toEqual([]);
    });

    it('lets the classification form search and hydrate its folio configuration select', () => {
        // nombre ilike: search box; status eq: active only; id eq: hydrating the saved value.
        expect(getSearchPolicy('folio-configurations.search').allowedFilters).toEqual(
            expect.arrayContaining([
                { field: 'id', operators: ['eq'] },
                { field: 'nombre', operators: ['ilike'] },
                { field: 'status', operators: ['eq'] },
            ])
        );
    });

    it('allows the existing interactions search path to filter by the current review owner', () => {
        expect(getSearchPolicy('interactions.search').allowedFilters).toEqual(
            expect.arrayContaining([{ field: 'start_review_by', operators: ['eq'] }])
        );
    });

    it('allows only the canonical frontend exclusion operators for System Inbox Workspace searches', () => {
        expect(getSearchPolicy('workspaces.search').allowedFilters).toEqual([
            { field: 'deleted_at', operators: ['null'] },
            { field: 'id', operators: ['neq'] },
            { field: 'is_active', operators: ['eq'] },
            { field: 'workspaces.deleted_at', operators: ['null'] },
        ]);
        expect(getSearchPolicy('interactions.search').allowedFilters).toEqual([
            { field: 'deleted_at', operators: ['null'] },
            { field: 'in_review', operators: ['eq'] },
            { field: 'is_closed', operators: ['eq'] },
            { field: 'start_review_by', operators: ['eq'] },
            { field: 'subject', operators: ['ilike'] },
            { field: 'workspace_id', operators: ['eq', 'neq', 'null'] },
        ]);
    });

    it('allows the imports-dashboard control panel filters as submitted by the frontend', () => {
        expect(getSearchPolicy('imports-dashboard.search').allowedFilters).toEqual([
            { field: 's3_import_files.created_at', operators: ['between'] },
            { field: 's3_import_files.error_details', operators: ['ilike'] },
            { field: 's3_import_files.file_path', operators: ['ilike'] },
            { field: 's3_import_files.last_updated_at', operators: ['between'] },
            { field: 's3_import_files.processed_records', operators: ['eq'] },
            { field: 's3_import_files.status', operators: ['ilike'] },
            { field: 's3_import_files.total_records', operators: ['eq'] },
            { field: 's3_import_files.upload_attempts', operators: ['eq'] },
        ]);
    });

    it('does not allow the frontend to submit created_by on imports-dashboard (per-user scoping is enforced server-side)', () => {
        const createdByFilters = getSearchPolicy('imports-dashboard.search').allowedFilters.filter(
            ({ field }) => field === 's3_import_files.created_by'
        );

        expect(createdByFilters).toEqual([]);
    });

    it('registers the frontend banners base search policy explicitly', () => {
        expect(getSearchPolicy('banners.search')).toMatchObject({
            baseFilter: [],
            allowedFilters: expect.arrayContaining([
                { field: 'banners.deleted_at', operators: ['null'] },
                { field: 'status', operators: ['eq'] },
                { field: 'fecha_inicio', operators: ['lte'] },
                { field: 'fecha_fin', operators: ['gte'] },
                { field: 'deleted_at', operators: ['null'] },
            ]),
        });
    });

    it('allows the DataTableV2 filters emitted by the migrated admin tables', () => {
        const expectedFiltersByEndpoint = {
            'allowed-connections.search': [
                { field: 'allowed_connections.deleted_at', operators: ['null'] },
                { field: 'allowed_connections.description', operators: ['ilike'] },
                { field: 'allowed_connections.connection', operators: ['ilike'] },
                { field: 'allowed_connections.is_active', operators: ['eq'] },
                { field: 'allowed_connections.created_by', operators: ['eq'] },
                { field: 'allowed_connections.updated_by', operators: ['eq'] },
                { field: 'allowed_connections.created_at', operators: ['between'] },
                { field: 'allowed_connections.updated_at', operators: ['between'] },
            ],
            'broker.search': [
                { field: 'broker_adapters.deleted_at', operators: ['null'] },
                { field: 'broker_adapters.name', operators: ['ilike'] },
                { field: 'broker_adapters.created_at', operators: ['between'] },
                { field: 'broker_adapters.updated_at', operators: ['between'] },
            ],
            'broker-mapper.search': [
                { field: 'broker_message_mappers.deleted_at', operators: ['null'] },
                { field: 'broker_message_mappers.name', operators: ['ilike'] },
                { field: 'broker_message_mappers.created_at', operators: ['between'] },
                { field: 'broker_message_mappers.updated_at', operators: ['between'] },
            ],
            'automation-settings.search': [
                { field: 'automation_settings.deleted_at', operators: ['null'] },
                { field: 'automation_settings.description', operators: ['ilike'] },
                { field: 'automation_settings.frequency', operators: ['ilike'] },
                { field: 'automation_settings.start_date', operators: ['between'] },
                { field: 'automation_settings.end_date', operators: ['between'] },
                { field: 'automation_settings.created_at', operators: ['between'] },
                { field: 'automation_settings.updated_at', operators: ['between'] },
            ],
            'ans.search': [
                { field: 'ans.deleted_at', operators: ['null'] },
                { field: 'ans.id', operators: ['eq'] },
                { field: 'ans.nombre', operators: ['ilike'] },
                { field: 'ans.intermedio', operators: ['eq'] },
                { field: 'ans.vencido', operators: ['eq'] },
                { field: 'ans.color_ans_inicial', operators: ['ilike'] },
                { field: 'ans.color_ans_intermedio', operators: ['ilike'] },
                { field: 'ans.color_ans_final', operators: ['ilike'] },
                { field: 'ans.status', operators: ['eq', 'neq'] },
                { field: 'ans.created_at', operators: ['between'] },
                { field: 'ans.updated_at', operators: ['between'] },
                { field: 'ans.created_by', operators: ['eq'] },
                { field: 'ans.updated_by', operators: ['eq'] },
            ],
            'agendas.search': [
                { field: 'agendas.deleted_at', operators: ['null'] },
                { field: 'agendas.description', operators: ['ilike'] },
                { field: 'agendas.daily_limit', operators: ['eq'] },
                { field: 'agendas.is_for_weekend', operators: ['eq'] },
                { field: 'agendas.is_active', operators: ['eq'] },
                { field: 'agendas.created_by', operators: ['eq'] },
                { field: 'agendas.updated_by', operators: ['eq'] },
                { field: 'agendas.created_at', operators: ['between'] },
                { field: 'agendas.updated_at', operators: ['between'] },
            ],
            'appointment-time-slots.search': [
                { field: 'appointment_time_slots.deleted_at', operators: ['null'] },
                { field: 'appointment_time_slots.description', operators: ['ilike'] },
                { field: 'appointment_time_slots.start_time', operators: ['eq'] },
                { field: 'appointment_time_slots.end_time', operators: ['eq'] },
                { field: 'appointment_time_slots.max_appointments', operators: ['eq'] },
                { field: 'appointment_time_slots.is_active', operators: ['eq'] },
                { field: 'appointment_time_slots.created_by', operators: ['eq'] },
                { field: 'appointment_time_slots.updated_by', operators: ['eq'] },
                { field: 'appointment_time_slots.created_at', operators: ['between'] },
                { field: 'appointment_time_slots.updated_at', operators: ['between'] },
            ],
            'helps.search': [
                { field: 'helps.deleted_at', operators: ['null'] },
                { field: 'helps.titulo', operators: ['ilike'] },
                { field: 'helps.descripcion', operators: ['ilike'] },
                { field: 'helps.color', operators: ['ilike'] },
                { field: 'helps.is_active', operators: ['eq'] },
                { field: 'helps.created_by', operators: ['eq'] },
                { field: 'helps.updated_by', operators: ['eq'] },
                { field: 'helps.created_at', operators: ['between'] },
                { field: 'helps.updated_at', operators: ['between'] },
            ],
            'generate-csv.search': [
                { field: 'csv_export_views.deleted_at', operators: ['null'] },
                { field: 'csv_export_views.description', operators: ['ilike'] },
                { field: 'csv_export_views.frequency', operators: ['ilike'] },
                { field: 'csv_export_views.interval', operators: ['eq'] },
                { field: 'csv_export_views.storage_path', operators: ['ilike'] },
                { field: 'csv_export_views.last_execution_at', operators: ['between'] },
                { field: 'csv_export_views.next_execution_at', operators: ['between'] },
                { field: 'csv_export_views.is_active', operators: ['eq'] },
                { field: 'csv_export_views.created_by', operators: ['eq'] },
                { field: 'csv_export_views.updated_by', operators: ['eq'] },
                { field: 'csv_export_views.created_at', operators: ['between'] },
                { field: 'csv_export_views.updated_at', operators: ['between'] },
            ],
            'mail-accounts.search': [
                { field: 'mail_accounts.deleted_at', operators: ['null'] },
                { field: 'mail_accounts.description', operators: ['ilike'] },
                { field: 'mail_accounts.type', operators: ['ilike'] },
                { field: 'mail_accounts.host', operators: ['ilike'] },
                { field: 'mail_accounts.port', operators: ['eq'] },
                { field: 'mail_accounts.protocol', operators: ['ilike'] },
                { field: 'mail_accounts.is_active', operators: ['eq', 'neq'] },
                { field: 'mail_accounts.created_by', operators: ['eq'] },
                { field: 'mail_accounts.updated_by', operators: ['eq'] },
                { field: 'mail_accounts.created_at', operators: ['between'] },
                { field: 'mail_accounts.updated_at', operators: ['between'] },
            ],
            'secrets-vault.search': [
                { field: 'boveda_secretos.deleted_at', operators: ['null'] },
                { field: 'boveda_secretos.descripcion', operators: ['ilike'] },
                { field: 'boveda_secretos.referencia', operators: ['ilike'] },
                { field: 'boveda_secretos.created_at', operators: ['between'] },
                { field: 'boveda_secretos.updated_at', operators: ['between'] },
                { field: 'boveda_secretos.created_by', operators: ['eq'] },
                { field: 'boveda_secretos.updated_by', operators: ['eq'] },
            ],
        };

        for (const [endpointKey, expectedFilters] of Object.entries(expectedFiltersByEndpoint)) {
            expect(getSearchPolicy(endpointKey).allowedFilters).toEqual(expect.arrayContaining(expectedFilters));
        }
    });

    it('keeps the unqualified allowed-connections filters used by the URL validator', () => {
        expect(getSearchPolicy('allowed-connections.search').allowedFilters).toEqual(
            expect.arrayContaining([
                { field: 'connection', operators: ['eq'] },
                { field: 'is_active', operators: ['eq'] },
                { field: 'deleted_at', operators: ['null'] },
            ])
        );
    });

    it('does not expose secret-vault sensitive or nonexistent state fields to restricted searches', () => {
        const allowedFields = getSearchPolicy('secrets-vault.search').allowedFilters.map(({ field }) => field);

        for (const forbiddenField of [
            'boveda_secretos.secreto',
            'boveda_secretos.password_encryption_migrated',
            'boveda_secretos.status',
            'boveda_secretos.is_active',
        ]) {
            expect(allowedFields).not.toContain(forbiddenField);
        }
    });

    it('registers frontend relationship allowlists for base queries that join data', () => {
        expect(getSearchPolicy('appointments.search').allowedRelationships).toEqual([
            { table: 'cases', type: 'join', condition: { column: 'cases.id', refColumn: 'appointments.case_id' } },
        ]);
        expect(getSearchPolicy('aux-clients.search').allowedRelationships).toEqual([
            {
                table: 'clients',
                type: 'left',
                condition: { column: 'clients.id', refColumn: 'aux_clients.cliente_id' },
            },
        ]);
    });

    it('keeps clients and users mandatory security base filters while allowing frontend base query variants', () => {
        expect(getSearchPolicy('clients.search')).toMatchObject({
            baseFilter: [{ field: 'status', operator: 'eq', value: 1, type: 'AND' }],
            requiredFilterGroups: [
                {
                    name: 'client_specific_search_criteria',
                    filters: expect.arrayContaining([
                        { field: 'documento', operators: ['eq', 'like', 'ilike'] },
                        { field: 'email', operators: ['ilike'] },
                        { field: 'nombres', operators: ['like', 'ilike'] },
                    ]),
                },
            ],
            allowedFilters: expect.arrayContaining([
                { field: 'deleted_at', operators: ['null'] },
                { field: 'id', operators: ['like'] },
                { field: 'status', operators: ['eq'] },
            ]),
        });
        expect(getSearchPolicy('cases.search')).toMatchObject({
            baseFilter: [],
            allowedFilters: expect.arrayContaining([
                { field: 'cases.deleted_at', operators: ['null'] },
                { field: 'cases.reference', operators: ['eq'] },
                { field: 'parent_id', operators: ['notNull', 'null'] },
            ]),
        });
        expect(getSearchPolicy('users.search')).toMatchObject({
            baseFilter: [{ field: 'usuarios.deleted_at', operator: 'null', value: 'null', type: 'AND' }],
            allowedFilters: expect.arrayContaining([
                { field: 'deleted_at', operators: ['null'] },
                { field: 'id', operators: ['eq', 'in'] },
                { field: 'status', operators: ['eq'] },
            ]),
        });
        expect(getSearchPolicy('boards.search')).toMatchObject({
            allowedFilters: expect.arrayContaining([
                { field: 'boards.deleted_at', operators: ['null'] },
                { field: 'boards.name', operators: ['ilike'] },
                { field: 'boards.description', operators: ['ilike'] },
                { field: 'boards.primary_entity', operators: ['ilike'] },
                { field: 'boards.is_active', operators: ['eq'] },
                { field: 'boards.created_at', operators: ['between'] },
                { field: 'boards.updated_at', operators: ['between'] },
                { field: 'access_users_ids', operators: ['in'] },
                { field: 'access_groups_ids', operators: ['in'] },
            ]),
        });
    });

    it('merges users.search id operators into one allowlist entry', () => {
        const userIdFilters = getSearchPolicy('users.search').allowedFilters.filter(({ field }) => field === 'id');

        expect(userIdFilters).toHaveLength(1);
        expect(userIdFilters[0].operators).toEqual(expect.arrayContaining(['eq', 'in']));
        expect(userIdFilters[0].operators).toHaveLength(2);
    });

    it('allows ilike search on nombres/apellido1/apellido2 for users.search (rule builder responsable search)', () => {
        const allowedFilters = getSearchPolicy('users.search').allowedFilters;

        expect(allowedFilters).toEqual(
            expect.arrayContaining([
                { field: 'nombres', operators: ['ilike'] },
                { field: 'apellido1', operators: ['ilike'] },
                { field: 'apellido2', operators: ['ilike'] },
            ])
        );
    });

    it('authorizes the three AND-only name searches the rule builder issues for cases.responsable_id', () => {
        const policy = getSearchPolicy('users.search');

        // Mirrors the payload InputValueCustom sends per field: mandatory base filter + one ilike name filter.
        for (const searchField of ['nombres', 'apellido1', 'apellido2']) {
            const submittedFilters = [
                ...policy.baseFilter,
                { field: searchField, operator: 'ilike', value: 'perez', type: 'AND' },
            ];

            expect(findMissingBaseFilters(policy.baseFilter, submittedFilters)).toEqual([]);
            expect(findDisallowedFilters(policy.baseFilter, submittedFilters, policy.allowedFilters)).toEqual([]);
        }
    });

    it('still rejects an unlisted name column for users.search', () => {
        const policy = getSearchPolicy('users.search');
        const submittedFilters = [
            ...policy.baseFilter,
            { field: 'segundo_nombre', operator: 'ilike', value: 'perez', type: 'AND' },
        ];

        expect(findDisallowedFilters(policy.baseFilter, submittedFilters, policy.allowedFilters)).toEqual([
            { field: 'segundo_nombre', operator: 'ilike', value: 'perez', type: 'AND' },
        ]);
    });

    it('registers explicit custom top-level query field allowlists', () => {
        expect(getSearchPolicy('case-session-duration.search').allowedCustomQueryFields).toEqual([
            'userId',
            'caseId',
            'page',
            'pageSize',
        ]);
        expect(getSearchPolicy('reports.search').allowedCustomQueryFields).toEqual(['name']);
        expect(getSearchPolicy('users.search-by-name.search').allowedCustomQueryFields).toEqual(['name']);
        expect(getSearchPolicy('action-batch-executions.process-queue.search').allowedCustomQueryFields).toEqual([]);
    });

    it('returns a policy by endpoint key', () => {
        expect(getSearchPolicy('clients.search').advancedPermission).toEqual({
            role: 'search',
            module_id: 'clients',
            name: 'ClientsSearchAdvanced',
        });
    });

    it('builds role permission definitions from policies', () => {
        expect(getSearchPermissionDefinitions()).toEqual(
            expect.arrayContaining([
                {
                    module_id: 'cases',
                    name: 'CasesSearchAdvanced',
                    description: 'Use advanced search filters on cases.search',
                    granted: false,
                },
            ])
        );
    });

    it('verifies that all permissions referenced in requiredTablePermissions exist in ListPermissions or SearchPermissionsCatalog', () => {
        const listPermissions = new ListPermissions();
        const searchDefinitions = SearchPermissionsCatalog.definitions();

        for (const policy of searchPolicies) {
            if (!policy.requiredTablePermissions) continue;

            for (const [table, permissions] of Object.entries(policy.requiredTablePermissions)) {
                const list = Array.isArray(permissions) ? permissions : [permissions];
                for (const perm of list) {
                    if (perm.role === 'search') {
                        const existsInSearch = searchDefinitions.some(
                            (def) => def.module_id === perm.module_id && def.name === perm.name
                        );
                        expect(existsInSearch).toBe(true);
                    } else {
                        const rolePermissions = listPermissions.permissions[perm.role] || [];
                        const existsInRole = rolePermissions.some(
                            (p) => p.module_id === perm.module_id && p.name === perm.name
                        );
                        expect(existsInRole).toBe(true);
                    }
                }
            }
        }
    });

    it('verifies that all fields emitted by DataTableEntityFilter for massive execution exist in clients.search allowlist with default operators', () => {
        const clientSchemaColumns = [
            { column_name: 'id', data_type: 'string' },
            { column_name: 'tipo_cliente', data_type: 'string' },
            { column_name: 'tipo_documento', data_type: 'string' },
            { column_name: 'documento', data_type: 'string' },
            { column_name: 'nombres', data_type: 'string' },
            { column_name: 'apellido1', data_type: 'string' },
            { column_name: 'apellido2', data_type: 'string' },
            { column_name: 'nombre_empresa', data_type: 'string' },
            { column_name: 'sexo', data_type: 'string' },
            { column_name: 'estado_civil', data_type: 'string' },
            { column_name: 'fecha_nacimiento', data_type: 'date' },
            { column_name: 'email', data_type: 'string' },
            { column_name: 'email_alterno', data_type: 'string' },
            { column_name: 'telefono', data_type: 'string' },
            { column_name: 'telefono_alterno', data_type: 'string' },
            { column_name: 'campos_extra1', data_type: 'string' },
            { column_name: 'campos_extra2', data_type: 'string' },
            { column_name: 'campos_extra3', data_type: 'string' },
            { column_name: 'status', data_type: 'integer' },
            { column_name: 'padre_id', data_type: 'string' },
            { column_name: 'habeas_data', data_type: 'string' },
            { column_name: 'created_at', data_type: 'timestamp' },
            { column_name: 'updated_at', data_type: 'timestamp' },
            { column_name: 'created_by', data_type: 'string' },
            { column_name: 'deleted_by', data_type: 'string' },
            { column_name: 'updated_by', data_type: 'string' },
            { column_name: 'deleted_at', data_type: 'timestamp' },
        ];

        const excludeColumns = [
            'id',
            'created_by',
            'deleted_by',
            'updated_by',
            'created_at',
            'deleted_at',
            'updated_at',
            'status',
        ];

        const getDefaultOperator = (dataType) => {
            switch (dataType.toLowerCase()) {
                case 'number':
                case 'integer':
                case 'bigint':
                case 'numeric':
                    return 'eq';
                case 'date':
                case 'timestamp':
                    return 'between';
                case 'boolean':
                    return 'is';
                default:
                    return 'ilike';
            }
        };

        const emittedFields = clientSchemaColumns
            .filter((col) => !excludeColumns.includes(col.column_name))
            .map((col) => ({
                field: `clients.${col.column_name}`,
                expectedOperator: getDefaultOperator(col.data_type),
            }));

        const policy = getSearchPolicy('clients.search');
        const allowedFilters = policy.allowedFilters;

        for (const { field, expectedOperator } of emittedFields) {
            const match = allowedFilters.find((f) => f.field === field);
            expect(match).toBeDefined();
            const supportedOperators = Array.isArray(match.operators) ? match.operators : [match.operator];
            expect(supportedOperators).toContain(expectedOperator);
        }
    });
});
