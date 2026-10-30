import { jest } from '@jest/globals';
import { SearchAuthorizationError } from '../../src/search-authorization/SearchAuthorizationError.js';
import { SearchAuthorizationService } from '../../src/search-authorization/SearchAuthorizationService.js';
import { getSearchPolicy, searchPolicies } from '../../src/search-authorization/SearchPolicyRegistry.js';

const casesPolicy = getSearchPolicy('cases.search');
const casesBaseFilter = casesPolicy.baseFilter;

const policyWithRelationships = {
    ...casesPolicy,
    baseRelationships: [
        { table: 'clients', type: 'left', condition: { source: 'cases.cliente_id', target: 'clients.id' } },
    ],
    allowedRelationships: [
        { table: 'usuarios', type: 'left', condition: { source: 'cases.responsable_id', target: 'usuarios.id' } },
    ],
};

const userWithAdvancedPermission = {
    hasPermission: jest.fn(
        (role, moduleId, name) => role === 'search' && moduleId === 'cases' && name === 'CasesSearchAdvanced'
    ),
};

const userWithSearchPermission = {
    hasSearchPermission: jest.fn((moduleId, name) => moduleId === 'cases' && name === 'CasesSearchAdvanced'),
};

const userWithoutAdvancedPermission = {
    hasPermission: jest.fn(() => false),
};

describe('SearchAuthorizationService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('allows any SearchSchema-valid query for advanced users', () => {
        const service = new SearchAuthorizationService({ policies: searchPolicies });
        const query = { filter: [{ field: 'id', operator: 'ilike', value: '%x%', type: 'AND' }], relationship: [] };

        expect(service.authorize({ endpointKey: 'cases.search', user: userWithAdvancedPermission, query })).toBe(query);
    });

    it('allows arbitrary custom top-level query keys for advanced users', () => {
        const service = new SearchAuthorizationService({ policies: searchPolicies });
        const query = {
            filter: [{ field: 'id', operator: 'ilike', value: '%x%', type: 'AND' }],
            relationship: [],
            exportedBy: 'reviewer',
        };

        expect(service.authorize({ endpointKey: 'cases.search', user: userWithAdvancedPermission, query })).toBe(query);
    });

    it('prefers hasSearchPermission when the user exposes the helper', () => {
        const service = new SearchAuthorizationService({ policies: searchPolicies });
        const query = { filter: [{ field: 'id', operator: 'ilike', value: '%x%', type: 'AND' }], relationship: [] };

        expect(service.authorize({ endpointKey: 'cases.search', user: userWithSearchPermission, query })).toBe(query);
        expect(userWithSearchPermission.hasSearchPermission).toHaveBeenCalledWith('cases', 'CasesSearchAdvanced');
    });

    it.each([
        ['object', { granted: true }],
        ['string', 'true'],
    ])('does not grant advanced access when hasPermission returns a truthy %s', (_label, returnValue) => {
        const service = new SearchAuthorizationService({ policies: searchPolicies });
        const user = { hasPermission: jest.fn(() => returnValue) };
        const query = { filter: [{ field: 'id', operator: 'ilike', value: '%x%', type: 'AND' }], relationship: [] };

        expect(() => service.authorize({ endpointKey: 'cases.search', user, query })).toThrow(SearchAuthorizationError);
    });

    it('does not grant advanced access when hasPermission returns a Promise', () => {
        const service = new SearchAuthorizationService({ policies: searchPolicies });
        const user = { hasPermission: jest.fn(() => Promise.resolve(true)) };
        const query = { filter: [{ field: 'id', operator: 'ilike', value: '%x%', type: 'AND' }], relationship: [] };

        expect(() => service.authorize({ endpointKey: 'cases.search', user, query })).toThrow(SearchAuthorizationError);
    });

    it('fails closed to normal policy checks when hasPermission throws', () => {
        const service = new SearchAuthorizationService({ policies: searchPolicies });
        const user = {
            hasPermission: jest.fn(() => {
                throw new Error('roles missing search category');
            }),
        };
        const query = { filter: casesBaseFilter, relationship: [] };

        expect(service.authorize({ endpointKey: 'cases.search', user, query })).toBe(query);
    });

    it('rejects normal users when a custom top-level query field is not allowlisted', () => {
        const service = new SearchAuthorizationService({ policies: searchPolicies });
        const query = { name: 'case_overview', unexpected: 'not-allowed' };

        let error;
        try {
            service.authorize({ endpointKey: 'reports.search', user: userWithoutAdvancedPermission, query });
        } catch (caughtError) {
            error = caughtError;
        }

        expect(error).toBeInstanceOf(SearchAuthorizationError);
        expect(error).toMatchObject({
            reason: 'disallowed_custom_query_fields',
            details: { disallowedCustomQueryFields: ['unexpected'] },
        });
    });

    it('allows normal users to submit an empty query when the endpoint policy has no required criteria', () => {
        const service = new SearchAuthorizationService({ policies: searchPolicies });
        const query = {};

        expect(
            service.authorize({
                endpointKey: 'action-batch-executions.process-queue.search',
                user: userWithoutAdvancedPermission,
                query,
            })
        ).toBe(query);
    });

    it('allows normal users to submit the frontend default soft-delete query for default endpoints', () => {
        const service = new SearchAuthorizationService({ policies: searchPolicies });
        const query = {
            filter: [{ field: 'deleted_at', operator: 'null', value: 'null', type: 'AND' }],
            relationship: null,
            order: { field: 'created_at', direction: 'desc' },
            limit: 100,
            offset: 0,
        };

        expect(service.authorize({ endpointKey: 'agendas.search', user: userWithoutAdvancedPermission, query })).toBe(
            query
        );
    });

    it('allows normal users to filter report executions by the period initial and end dates', () => {
        const service = new SearchAuthorizationService({ policies: searchPolicies });
        const range = { from: '2025-12-30T00:00:00.000-05:00', to: '2025-12-30T23:59:59.999-05:00' };
        const query = {
            filter: [
                { field: 'created_by', operator: 'eq', value: 'user-id', type: 'AND' },
                {
                    field: 'period',
                    operator: 'jsonPathDateBetween',
                    value: JSON.stringify({ path: 'initialDate', ...range }),
                    type: 'AND',
                },
                {
                    field: 'period',
                    operator: 'jsonPathDateBetween',
                    value: JSON.stringify({ path: 'endDate', ...range }),
                    type: 'AND',
                },
            ],
        };

        expect(
            service.authorize({ endpointKey: 'report-executions.search', user: userWithoutAdvancedPermission, query })
        ).toBe(query);
    });

    it('allows normal users to submit the frontend banners base query', () => {
        const service = new SearchAuthorizationService({ policies: searchPolicies });
        const query = {
            filter: [
                { field: 'status', operator: 'eq', value: 1, type: 'AND' },
                { field: 'fecha_inicio', operator: 'lte', value: '2026-05-04T14:16:25.944Z', type: 'AND' },
                { field: 'fecha_fin', operator: 'gte', value: '2026-05-04T14:16:25.944Z', type: 'AND' },
                { field: 'deleted_at', operator: 'null', value: 'null', type: 'AND' },
            ],
            relationship: null,
            order: { field: 'created_at', direction: 'desc' },
            limit: 100,
            offset: 0,
        };

        expect(service.authorize({ endpointKey: 'banners.search', user: userWithoutAdvancedPermission, query })).toBe(
            query
        );
    });

    it('allows normal users to submit the frontend banners table base query', () => {
        const service = new SearchAuthorizationService({ policies: searchPolicies });
        const query = {
            filter: [{ field: 'banners.deleted_at', operator: 'null', value: 'null', type: 'AND' }],
            relationship: null,
            order: { field: 'banners.created_at', direction: 'desc' },
            limit: 100,
            offset: 0,
        };

        expect(service.authorize({ endpointKey: 'banners.search', user: userWithoutAdvancedPermission, query })).toBe(
            query
        );
    });

    it('allows normal users to submit the Channel Hub registration flow lookup query', () => {
        const service = new SearchAuthorizationService({ policies: searchPolicies });
        const query = {
            filter: [
                {
                    groupType: 'OR',
                    filters: [
                        { field: 'external_code', operator: 'eq', value: 'channelhub-connection', type: 'AND' },
                        { field: 'external_code', operator: 'like', value: 'channelhub-connection-%', type: 'OR' },
                        { field: 'external_code', operator: 'like', value: 'channelhub-connection_%', type: 'OR' },
                    ],
                },
                { field: 'is_primary', operator: 'eq', value: 1, type: 'AND' },
                { field: 'is_active', operator: 'eq', value: 1, type: 'AND' },
                { field: 'deleted_at', operator: 'null', value: 'null', type: 'AND' },
                { field: 'ws_rest_flows.deleted_at', operator: 'null', value: 'null', type: 'AND' },
            ],
            relationship: null,
            order: { field: 'ws_rest_flows.created_at', direction: 'desc' },
            limit: 100,
            offset: 0,
        };

        expect(
            service.authorize({ endpointKey: 'ws-rest-flows.search', user: userWithoutAdvancedPermission, query })
        ).toBe(query);
    });

    it('allows normal users to submit the frontend users table base query', () => {
        const service = new SearchAuthorizationService({ policies: searchPolicies });
        const query = {
            filter: [{ field: 'usuarios.deleted_at', operator: 'null', value: 'null', type: 'AND' }],
            relationship: null,
            order: { field: 'usuarios.created_at', direction: 'desc' },
            limit: 10,
            offset: 0,
        };

        expect(service.authorize({ endpointKey: 'users.search', user: userWithoutAdvancedPermission, query })).toBe(
            query
        );
    });

    it('allows normal users to submit the frontend users id lookup query', () => {
        const service = new SearchAuthorizationService({ policies: searchPolicies });
        const query = {
            filter: [
                { field: 'usuarios.deleted_at', operator: 'null', value: 'null', type: 'AND' },
                { field: 'id', operator: 'in', value: 'user-1,user-2', type: 'AND' },
            ],
            relationship: null,
            limit: 10,
            offset: 0,
        };

        expect(service.authorize({ endpointKey: 'users.search', user: userWithoutAdvancedPermission, query })).toBe(
            query
        );
    });

    describe.each([
        ['broker-mapper.search', 'broker_message_mappers'],
        ['broker.search', 'broker_adapters'],
    ])('%s table filters', (endpointKey, table) => {
        const dateRange = '2026-10-01T05:00:00.000Z,2026-10-07T04:59:59.999Z';

        it('allows normal users to filter by name and date ranges', () => {
            const service = new SearchAuthorizationService({ policies: searchPolicies });
            const query = {
                filter: [
                    { field: `${table}.deleted_at`, operator: 'null', value: 'null', type: 'AND' },
                    { field: `${table}.name`, operator: 'ilike', value: '%qa%', type: 'AND' },
                    { field: `${table}.created_at`, operator: 'between', value: dateRange, type: 'AND' },
                    { field: `${table}.updated_at`, operator: 'between', value: dateRange, type: 'AND' },
                ],
                relationship: null,
                order: { field: `${table}.created_at`, direction: 'desc' },
                limit: 10,
                offset: 0,
            };

            expect(service.authorize({ endpointKey, user: userWithoutAdvancedPermission, query })).toBe(query);
        });

        it.each([
            ['a non-inventoried column', { field: `${table}.queue`, operator: 'ilike', value: '%q%' }],
            ['a non-inventoried operator', { field: `${table}.name`, operator: 'eq', value: 'qa' }],
            ['an unqualified column', { field: 'name', operator: 'ilike', value: '%qa%' }],
        ])('rejects normal users when the query uses %s', (_, filter) => {
            const service = new SearchAuthorizationService({ policies: searchPolicies });
            const query = { filter: [{ ...filter, type: 'AND' }], relationship: null };

            expect(() => service.authorize({ endpointKey, user: userWithoutAdvancedPermission, query })).toThrow(
                SearchAuthorizationError
            );
        });
    });

    it('rejects normal users when a broker mappers query uses the nonexistent broker_mappers table', () => {
        const service = new SearchAuthorizationService({ policies: searchPolicies });
        const query = {
            filter: [{ field: 'broker_mappers.name', operator: 'ilike', value: '%m%', type: 'AND' }],
            relationship: null,
        };

        expect(() =>
            service.authorize({ endpointKey: 'broker-mapper.search', user: userWithoutAdvancedPermission, query })
        ).toThrow(SearchAuthorizationError);
    });

    it('rejects normal users when a banner query uses a non-inventoried field', () => {
        const service = new SearchAuthorizationService({ policies: searchPolicies });
        const query = {
            filter: [{ field: 'description', operator: 'ilike', value: 'private', type: 'AND' }],
            relationship: null,
        };

        expect(() =>
            service.authorize({ endpointKey: 'banners.search', user: userWithoutAdvancedPermission, query })
        ).toThrow(SearchAuthorizationError);
    });

    it('allows normal users to submit representative frontend base queries from the inventory', () => {
        const service = new SearchAuthorizationService({ policies: searchPolicies });
        const casesTableQuery = {
            filter: [{ field: 'cases.deleted_at', operator: 'null', value: 'null', type: 'AND' }],
            relationship: null,
            order: { field: 'cases.created_at', direction: 'desc' },
            limit: 10,
            offset: 0,
        };
        const clientDropdownQuery = {
            filter: [
                { field: 'status', operator: 'eq', value: 1, type: 'AND' },
                { field: 'deleted_at', operator: 'null', value: 'null', type: 'AND' },
                { field: 'nombres', operator: 'ilike', value: 'Ada', type: 'AND' },
            ],
            relationship: null,
            order: { field: 'created_at', direction: 'desc' },
            limit: 20,
            offset: 0,
        };
        const eventLogsQuery = {
            filter: [{ field: 'case_id', operator: 'in', value: 'case-1', type: 'AND' }],
            relationship: null,
            order: { field: 'occurred_at', direction: 'DESC' },
            limit: 200,
            offset: 0,
        };
        const appointmentQuery = {
            filter: [
                { field: 'appointments.case_id', operator: 'eq', value: 'case-1', type: 'AND' },
                { field: 'appointments.is_canceled', operator: 'eq', value: 0, type: 'AND' },
                { field: 'appointments.is_completed', operator: 'eq', value: 0, type: 'AND' },
                { field: 'appointments.deleted_at', operator: 'null', value: 'null', type: 'AND' },
            ],
            relationship: [
                { table: 'cases', type: 'join', condition: { column: 'cases.id', refColumn: 'appointments.case_id' } },
            ],
            order: { field: 'appointments.created_at', direction: 'desc' },
            limit: 100,
            offset: 0,
        };

        expect(
            service.authorize({
                endpointKey: 'cases.search',
                user: userWithoutAdvancedPermission,
                query: casesTableQuery,
            })
        ).toBe(casesTableQuery);
        expect(
            service.authorize({
                endpointKey: 'clients.search',
                user: userWithoutAdvancedPermission,
                query: clientDropdownQuery,
            })
        ).toBe(clientDropdownQuery);
        expect(
            service.authorize({
                endpointKey: 'event-logs.search',
                user: userWithoutAdvancedPermission,
                query: eventLogsQuery,
            })
        ).toBe(eventLogsQuery);
        expect(
            service.authorize({
                endpointKey: 'appointments.search',
                user: userWithoutAdvancedPermission,
                query: appointmentQuery,
            })
        ).toBe(appointmentQuery);
    });

    it('authorizes group.search with status filter for users without advanced permission (GROUP_SEARCH_FILTER & useGroupsOptions)', () => {
        const service = new SearchAuthorizationService({ policies: searchPolicies });
        const groupSearchFilterQuery = {
            filter: [
                { field: 'status', operator: 'eq', value: 1, type: 'AND' },
                { field: 'deleted_at', operator: 'null', value: 'null', type: 'AND' },
            ],
            relationship: null,
        };
        const useGroupsOptionsQuery = {
            filter: [
                { field: 'deleted_at', operator: 'null', type: 'AND', value: 'null' },
                { field: 'status', operator: 'eq', type: 'AND', value: 1 },
                { field: 'nombre', operator: 'ilike', type: 'AND', value: 'Support' },
            ],
            relationship: null,
            limit: 100,
            offset: 0,
        };

        expect(
            service.authorize({
                endpointKey: 'group.search',
                user: userWithoutAdvancedPermission,
                query: groupSearchFilterQuery,
            })
        ).toBe(groupSearchFilterQuery);

        expect(
            service.authorize({
                endpointKey: 'group.search',
                user: userWithoutAdvancedPermission,
                query: useGroupsOptionsQuery,
            })
        ).toBe(useGroupsOptionsQuery);
    });

    it('authorizes user-group-relations.search with grupos.status filter for users without advanced permission', () => {
        const service = new SearchAuthorizationService({ policies: searchPolicies });
        const userGroupQuery = {
            filter: [
                { field: 'usuario_id', operator: 'eq', value: '00000000-0000-4000-8000-000000000001', type: 'AND' },
                { field: 'grupos.status', operator: 'eq', value: 1, type: 'AND' },
            ],
            relationship: null,
            order: { field: 'grupo_id', direction: 'asc' },
        };

        expect(
            service.authorize({
                endpointKey: 'user-group-relations.search',
                user: userWithoutAdvancedPermission,
                query: userGroupQuery,
            })
        ).toBe(userGroupQuery);
    });

    it('rejects frontend soft-delete filters for default endpoints not used by the frontend inventory', () => {
        const service = new SearchAuthorizationService({ policies: searchPolicies });
        const query = {
            filter: [{ field: 'deleted_at', operator: 'null', value: 'null', type: 'AND' }],
            relationship: null,
            order: { field: 'created_at', direction: 'desc' },
            limit: 100,
            offset: 0,
        };

        expect(() =>
            service.authorize({
                endpointKey: 'action-batch-executions.process-queue.search',
                user: userWithoutAdvancedPermission,
                query,
            })
        ).toThrow(SearchAuthorizationError);
    });

    it('allows normal users to use endpoint-allowlisted custom top-level query fields', () => {
        const service = new SearchAuthorizationService({ policies: searchPolicies });
        const query = { userId: 'user-1', caseId: 'case-1', page: 2, pageSize: 25 };

        expect(
            service.authorize({
                endpointKey: 'case-session-duration.search',
                user: userWithoutAdvancedPermission,
                query,
            })
        ).toBe(query);
    });

    it('allows normal users to use canonical SearchSchema top-level query keys', () => {
        const service = new SearchAuthorizationService({ policies: searchPolicies });
        const query = {
            filter: casesBaseFilter,
            relationship: [],
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        };

        expect(service.authorize({ endpointKey: 'cases.search', user: userWithoutAdvancedPermission, query })).toBe(
            query
        );
    });

    it('allows normal users when base query and allowlists are satisfied', () => {
        const service = new SearchAuthorizationService({ policies: [policyWithRelationships] });
        const query = {
            filter: [...casesBaseFilter, { field: 'reference', operator: 'eq', value: '10', type: 'AND' }],
            relationship: [
                ...policyWithRelationships.baseRelationships,
                ...policyWithRelationships.allowedRelationships,
            ],
            order: { field: 'created_at', direction: 'desc' },
            limit: 10,
            offset: 0,
        };

        expect(service.authorize({ endpointKey: 'cases.search', user: userWithoutAdvancedPermission, query })).toBe(
            query
        );
    });

    it('rejects normal users when a filter is not in the endpoint whitelist', () => {
        const service = new SearchAuthorizationService({ policies: searchPolicies });
        const query = {
            filter: [{ field: 'reference', operator: 'between', value: '1,10', type: 'AND' }],
            relationship: [],
        };

        expect(() =>
            service.authorize({ endpointKey: 'cases.search', user: userWithoutAdvancedPermission, query })
        ).toThrow(SearchAuthorizationError);
    });

    it('rejects normal users when an OR filter uses a non-whitelisted field', () => {
        const service = new SearchAuthorizationService({ policies: searchPolicies });
        const query = {
            filter: [{ field: 'created_at', operator: 'eq', value: '2026-05-04', type: 'OR' }],
            relationship: [],
        };

        expect(() =>
            service.authorize({ endpointKey: 'cases.search', user: userWithoutAdvancedPermission, query })
        ).toThrow(SearchAuthorizationError);
    });

    it('rejects normal users when a relationship is not allowlisted', () => {
        const service = new SearchAuthorizationService({ policies: [policyWithRelationships] });
        const query = {
            filter: casesBaseFilter,
            relationship: [
                ...policyWithRelationships.baseRelationships,
                { table: 'roles', type: 'left', condition: { source: 'usuarios.rol_id', target: 'roles.id' } },
            ],
        };

        expect(() =>
            service.authorize({ endpointKey: 'cases.search', user: userWithoutAdvancedPermission, query })
        ).toThrow(SearchAuthorizationError);
    });

    it('rejects normal users when disabled capabilities are used', () => {
        const service = new SearchAuthorizationService({ policies: searchPolicies });
        const query = { filter: casesBaseFilter, relationship: [], select: ['cases.id'] };

        expect(() =>
            service.authorize({ endpointKey: 'cases.search', user: userWithoutAdvancedPermission, query })
        ).toThrow(SearchAuthorizationError);
    });

    it('throws when an endpoint has no registered policy', () => {
        const service = new SearchAuthorizationService({ policies: searchPolicies });

        expect(() =>
            service.authorize({ endpointKey: 'unknown.search', user: userWithoutAdvancedPermission, query: {} })
        ).toThrow('Search policy not found for endpoint: unknown.search');
    });

    describe('custom query field allowlists for DTO-shaped endpoints', () => {
        it('allows board-resources DTO fields for restricted users', () => {
            const service = new SearchAuthorizationService({ policies: searchPolicies });

            expect(() =>
                service.authorize({
                    endpointKey: 'boards.board-resources.search',
                    user: userWithoutAdvancedPermission,
                    query: { tableName: 'cases', orders: [], subQuery: {}, quickAnsFilter: null },
                })
            ).not.toThrow();
        });

        it('allows available-boards DTO fields for restricted users', () => {
            const service = new SearchAuthorizationService({ policies: searchPolicies });

            expect(() =>
                service.authorize({
                    endpointKey: 'boards.available-boards.search',
                    user: userWithoutAdvancedPermission,
                    query: { userId: '1', groupId: '2' },
                })
            ).not.toThrow();
        });

        it('allows auxiliaries.list DTO fields for restricted users', () => {
            const service = new SearchAuthorizationService({ policies: searchPolicies });

            expect(() =>
                service.authorize({
                    endpointKey: 'auxiliaries.list.search',
                    user: userWithoutAdvancedPermission,
                    query: { entity: 'foo', field: 'bar' },
                })
            ).not.toThrow();
        });
    });

    describe('hasSearchPermission fail-closed behavior', () => {
        it('falls back to restricted checks when hasSearchPermission returns false', () => {
            const user = { id: { value: 'u1' }, hasSearchPermission: () => false };
            const service = new SearchAuthorizationService();
            expect(() => service.authorize({ endpointKey: 'cases.search', user, query: { filter: [] } })).not.toThrow();
        });

        it('denies advanced bypass when hasSearchPermission returns a truthy non-true value', () => {
            const user = { id: { value: 'u1' }, hasSearchPermission: () => ({ granted: true }) };
            const service = new SearchAuthorizationService();
            expect(() => service.authorize({ endpointKey: 'cases.search', user, query: { sneaky: 'x' } })).toThrow();
        });

        it('denies a restricted user submitting an arbitrary top-level field on an endpoint without allowlist', () => {
            const user = { id: { value: 'u1' }, hasSearchPermission: () => false };
            const service = new SearchAuthorizationService();
            expect(() =>
                service.authorize({ endpointKey: 'cases.search', user, query: { filter: [], sneaky: 'x' } })
            ).toThrow();
        });
    });
});

describe('SearchAuthorizationService audit logging', () => {
    const createAuditLogger = () => ({
        logAuthorized: jest.fn(),
        logDenied: jest.fn(),
        logExecuted: jest.fn(),
    });

    it('audits advanced authorizations with the user id', () => {
        const auditLogger = createAuditLogger();
        const service = new SearchAuthorizationService({ policies: searchPolicies, auditLogger });
        const user = { ...userWithAdvancedPermission, id: { value: 'user-advanced' } };
        const query = { filter: [{ field: 'id', operator: 'ilike', value: '%x%', type: 'AND' }], relationship: [] };

        service.authorize({ endpointKey: 'cases.search', user, query });

        expect(auditLogger.logAuthorized).toHaveBeenCalledWith({
            endpointKey: 'cases.search',
            userId: 'user-advanced',
            mode: 'advanced',
        });
    });

    it('audits restricted authorizations when the policy is satisfied', () => {
        const auditLogger = createAuditLogger();
        const service = new SearchAuthorizationService({ policies: searchPolicies, auditLogger });
        const user = { hasPermission: jest.fn(() => false), id: 'user-normal' };
        const query = { filter: casesBaseFilter, relationship: [] };

        service.authorize({ endpointKey: 'cases.search', user, query });

        expect(auditLogger.logAuthorized).toHaveBeenCalledWith({
            endpointKey: 'cases.search',
            userId: 'user-normal',
            mode: 'restricted',
        });
        expect(auditLogger.logDenied).not.toHaveBeenCalled();
    });

    it('audits denials with the user id, reason, and details before throwing', () => {
        const auditLogger = createAuditLogger();
        const service = new SearchAuthorizationService({ policies: searchPolicies, auditLogger });
        const user = { hasPermission: jest.fn(() => false), id: { value: 'user-bypass' } };
        const query = { filter: [], relationship: [] };

        expect(() => service.authorize({ endpointKey: 'clients.search', user, query })).toThrow(
            SearchAuthorizationError
        );

        expect(auditLogger.logDenied).toHaveBeenCalledWith({
            endpointKey: 'clients.search',
            userId: 'user-bypass',
            reason: 'missing_base_filters',
            details: { missingBaseFilters: getSearchPolicy('clients.search').baseFilter },
        });
        expect(auditLogger.logAuthorized).not.toHaveBeenCalled();
    });
    describe('massive execution client preview (clients.search, restricted user)', () => {
        /*
         * La ejecucion masiva previsualiza y ejecuta con la misma consulta: base `clients` mas
         * `left join aux_clients`. Estos casos fijan que la politica admita esa forma para un
         * usuario con permiso sobre `aux-clients` (ej. `AuxClientRead` o `AuxClientsSearchAdvanced`),
         * impidiendo Broken Access Control para usuarios sin autorizacion sobre auxiliares.
         */
        const auxRelationship = [
            {
                table: 'aux_clients',
                type: 'left',
                condition: { column: 'aux_clients.cliente_id', refColumn: 'clients.id' },
            },
        ];
        const activeClientsFilter = { field: 'status', operator: 'eq', value: 1, type: 'AND' };
        const makeRealisticUser = ({
            adminPermissions = [],
            searchPermissions = [],
            userId = 'user-massive',
        } = {}) => ({
            id: { value: userId },
            hasPermission: jest.fn((role, moduleId, name) => {
                if (role === 'administrador') {
                    return adminPermissions.some((p) => p.moduleId === moduleId && p.name === name);
                }
                if (role === 'search') {
                    return searchPermissions.some((p) => p.moduleId === moduleId && p.name === name);
                }
                return false;
            }),
            hasSearchPermission: jest.fn((moduleId, name) =>
                searchPermissions.some((p) => p.moduleId === moduleId && p.name === name)
            ),
        });

        const userWithAdminAuxRead = () =>
            makeRealisticUser({
                adminPermissions: [{ moduleId: 'aux-clients', name: 'AuxClientRead' }],
            });

        const userWithSearchAuxAdvanced = () =>
            makeRealisticUser({
                searchPermissions: [{ moduleId: 'aux-clients', name: 'AuxClientsSearchAdvanced' }],
            });

        const restrictedUserWithAux = () => userWithAdminAuxRead();
        const restrictedUserWithoutAux = () => makeRealisticUser();

        const authorizeClientsSearch = (query, user = restrictedUserWithAux()) =>
            new SearchAuthorizationService({ policies: searchPolicies }).authorize({
                endpointKey: 'clients.search',
                user,
                query,
            });

        it('authorizes a qualified native client filter joined to aux_clients for user with aux permission', () => {
            const query = {
                filter: [
                    { field: 'clients.documento', operator: 'ilike', value: '1111111', type: 'AND' },
                    activeClientsFilter,
                ],
                relationship: auxRelationship,
            };

            expect(authorizeClientsSearch(query)).toBe(query);
        });

        it('authorizes a qualified native client filter using eq operator', () => {
            const query = {
                filter: [
                    { field: 'clients.documento', operator: 'eq', value: '1111111', type: 'AND' },
                    activeClientsFilter,
                ],
                relationship: auxRelationship,
            };

            expect(authorizeClientsSearch(query)).toBe(query);
        });

        it('authorizes a filter on the client auxiliary data for user with aux permission', () => {
            const query = {
                filter: [
                    {
                        field: 'aux_clients.data',
                        operator: 'jsonContains',
                        value: JSON.stringify({ ciudad: 'Medellin' }),
                        type: 'AND',
                    },
                    activeClientsFilter,
                ],
                relationship: auxRelationship,
            };

            expect(authorizeClientsSearch(query)).toBe(query);
        });

        it('authorizes an aux_clients soft-delete null filter', () => {
            const query = {
                filter: [
                    { field: 'clients.documento', operator: 'eq', value: '1111111', type: 'AND' },
                    { field: 'aux_clients.deleted_at', operator: 'null', value: 'null', type: 'AND' },
                    activeClientsFilter,
                ],
                relationship: auxRelationship,
            };

            expect(authorizeClientsSearch(query)).toBe(query);
        });

        it('denies join to aux_clients when user lacks aux-clients permission', () => {
            const query = {
                filter: [
                    { field: 'clients.documento', operator: 'eq', value: '1111111', type: 'AND' },
                    activeClientsFilter,
                ],
                relationship: auxRelationship,
            };

            expect(() => authorizeClientsSearch(query, restrictedUserWithoutAux())).toThrow(SearchAuthorizationError);
        });

        it('denies filter on aux_clients.data when user lacks aux-clients permission', () => {
            const query = {
                filter: [
                    {
                        field: 'aux_clients.data',
                        operator: 'jsonContains',
                        value: JSON.stringify({ ciudad: 'Medellin' }),
                        type: 'AND',
                    },
                    activeClientsFilter,
                ],
                relationship: [],
            };

            expect(() => authorizeClientsSearch(query, restrictedUserWithoutAux())).toThrow(SearchAuthorizationError);
        });

        it('still denies an aux_clients filter whose value carries no search signal', () => {
            const query = {
                filter: [
                    { field: 'aux_clients.data', operator: 'jsonContains', value: '', type: 'AND' },
                    activeClientsFilter,
                ],
                relationship: auxRelationship,
            };

            expect(() => authorizeClientsSearch(query)).toThrow(SearchAuthorizationError);
        });

        it('still denies a join to a table outside the allowlist', () => {
            const query = {
                filter: [
                    { field: 'clients.documento', operator: 'ilike', value: '1111111', type: 'AND' },
                    activeClientsFilter,
                ],
                relationship: [
                    { table: 'usuarios', type: 'left', condition: { column: 'usuarios.id', refColumn: 'clients.id' } },
                ],
            };

            expect(() => authorizeClientsSearch(query)).toThrow(SearchAuthorizationError);
        });

        it('still denies a qualified client filter with an operator outside its allowlist', () => {
            const query = {
                filter: [{ field: 'clients.nombres', operator: 'eq', value: 'Ana', type: 'AND' }, activeClientsFilter],
                relationship: auxRelationship,
            };

            expect(() => authorizeClientsSearch(query)).toThrow(SearchAuthorizationError);
        });

        it('authorizes aux_clients access for user with administrador/AuxClientRead even when hasSearchPermission is false', () => {
            const query = {
                filter: [
                    { field: 'clients.documento', operator: 'ilike', value: '1111111', type: 'AND' },
                    activeClientsFilter,
                ],
                relationship: auxRelationship,
            };

            const adminUser = userWithAdminAuxRead();
            expect(adminUser.hasSearchPermission('aux-clients', 'AuxClientRead')).toBe(false);
            expect(authorizeClientsSearch(query, adminUser)).toBe(query);
        });

        it('authorizes aux_clients access for user with search/AuxClientsSearchAdvanced', () => {
            const query = {
                filter: [
                    { field: 'clients.documento', operator: 'ilike', value: '1111111', type: 'AND' },
                    activeClientsFilter,
                ],
                relationship: auxRelationship,
            };

            const searchUser = userWithSearchAuxAdvanced();
            expect(authorizeClientsSearch(query, searchUser)).toBe(query);
        });

        it('authorizes queries using newly supported native filter fields', () => {
            const query = {
                filter: [
                    { field: 'clients.documento', operator: 'eq', value: '1111111', type: 'AND' },
                    { field: 'clients.tipo_cliente', operator: 'ilike', value: 'VIP', type: 'AND' },
                    { field: 'clients.tipo_documento', operator: 'ilike', value: 'CC', type: 'AND' },
                    { field: 'clients.telefono', operator: 'ilike', value: '3001234567', type: 'AND' },
                    {
                        field: 'clients.fecha_nacimiento',
                        operator: 'between',
                        value: ['1990-01-01', '2000-01-01'],
                        type: 'AND',
                    },
                    activeClientsFilter,
                ],
                relationship: auxRelationship,
            };

            expect(authorizeClientsSearch(query)).toBe(query);
        });
    });
});
