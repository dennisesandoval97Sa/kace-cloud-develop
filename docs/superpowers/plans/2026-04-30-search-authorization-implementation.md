# Search Authorization Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce backend authorization for every `/search` endpoint so non-advanced users can only submit the endpoint's hardcoded base query plus allowlisted filters/relationships, while advanced endpoint permissions preserve administrator workflows.

**Architecture:** Add a shared search authorization module in `@kace/api-common`, backed by a hardcoded endpoint policy registry. Every `actionSearch` validates with `SearchSchema`, calls the shared authorization service with its endpoint key, then executes the original submitted query only if authorized. Role permissions gain a `search` category surfaced automatically in the existing Role Details permission UI.

**Tech Stack:** Node.js ES modules, Joi, Jest, React/Vite, Formik, existing `SearchSchema`, existing `User.hasPermission`, existing `HttpResponse.forbidden`.

---

## File Structure

### Backend shared authorization

- Create: `packages/kace_cloud_api_common/src/search-authorization/SearchAuthorizationError.js`
  - Defines a safe 403 error type with a generic public message and internal denial code.
- Create: `packages/kace_cloud_api_common/src/search-authorization/SearchPolicyRegistry.js`
  - Exports all endpoint policies and lookup helpers.
- Create: `packages/kace_cloud_api_common/src/search-authorization/SearchAuthorizationService.js`
  - Validates submitted query against policy and current user.
- Create: `packages/kace_cloud_api_common/src/search-authorization/filterMatcher.js`
  - Normalizes and compares simple/grouped filters.
- Create: `packages/kace_cloud_api_common/src/search-authorization/relationshipMatcher.js`
  - Normalizes and compares relationship objects by table/type/condition.
- Create: `packages/kace_cloud_api_common/src/search-authorization/capabilityValidator.js`
  - Rejects `select`, `distinct`, `group_by`, `having`, relationships, order, or pagination when policy disallows them.
- Modify: `packages/kace_cloud_api_common/src/index.js`
  - Export the service, registry, and error.

### Backend permissions

- Create: `packages/kace_cloud_core/src/role/domain/SearchPermissionsCatalog.js`
  - Provides canonical endpoint-level advanced search permissions.
- Modify: `packages/kace_cloud_core/src/role/domain/ListPermissions.js`
  - Adds `search` permissions category.
- Modify: `packages/kace_cloud_core/src/role/domain/value-object/ValueObjectPermissions.js`
  - Accepts/merges/validates `search` permissions.
- Modify: `packages/kace_cloud_core/src/users/domain/User.js`
  - Adds `hasSearchPermission(moduleId, permissionName)` convenience method.
- Modify: `apps/apiv1/kace_cloud_api_roles/src/schemas.mjs`
  - Allows `search` in role permission payloads.

### API endpoint migration

- Modify: every `apps/apiv1/*/src/*.{js,mjs}` file with an `actionSearch` handler.
  - Import `SearchAuthorizationService`.
  - Call it after `SearchSchema.validate(...)` succeeds and before existing searcher execution.
- Create: `scripts/search-authorization/inventory-search-handlers.mjs`
  - Inventories all search handlers and endpoint keys.
- Create: `scripts/search-authorization/check-search-authorization-coverage.mjs`
  - Fails CI/local checks when a handler lacks policy or enforcement call.

### Frontend role UI

- Modify: `apps/kace-saas/src/pages/Roles/components/RoleForm/components/RoleFormTabSearch/hooks/useRoleFormTabSerach.js`
  - Adds human label for `search` category.
- Modify: `apps/kace-saas/src/pages/Roles/components/RoleForm/utils/processRoleData.js`
  - Keeps `search` category during merge and validation.
- Modify: translation files containing `rol.form.title.*` and `modulesNames.*` if present.
  - Add `rol.form.title.search` and module labels for search permission groups.

### Tests

- Create: `packages/kace_cloud_api_common/tests/search-authorization/SearchAuthorizationService.test.js`
- Create: `packages/kace_cloud_api_common/tests/search-authorization/filterMatcher.test.js`
- Create: `packages/kace_cloud_api_common/tests/search-authorization/relationshipMatcher.test.js`
- Create: `packages/kace_cloud_api_common/tests/search-authorization/SearchPolicyRegistry.test.js`
- Create: `packages/kace_cloud_core/tests/role/SearchPermissionsCatalog.test.js`
- Modify/Create focused frontend role form tests if a test harness exists for this page.
- Create: `scripts/search-authorization/check-search-authorization-coverage.test.mjs` only if the repo already runs script tests; otherwise document and run the script directly from package scripts.

---

## Task 1: Add shared authorization error and matching helpers

**Files:**
- Create: `packages/kace_cloud_api_common/src/search-authorization/SearchAuthorizationError.js`
- Create: `packages/kace_cloud_api_common/src/search-authorization/filterMatcher.js`
- Create: `packages/kace_cloud_api_common/src/search-authorization/relationshipMatcher.js`
- Create: `packages/kace_cloud_api_common/src/search-authorization/capabilityValidator.js`
- Test: `packages/kace_cloud_api_common/tests/search-authorization/filterMatcher.test.js`
- Test: `packages/kace_cloud_api_common/tests/search-authorization/relationshipMatcher.test.js`

- [ ] **Step 1: Write failing filter matcher tests**

Create `packages/kace_cloud_api_common/tests/search-authorization/filterMatcher.test.js`:

```js
import {
    findMissingBaseFilters,
    findDisallowedFilters,
    normalizeFilter,
} from '../../src/search-authorization/filterMatcher.js';

describe('filterMatcher', () => {
    const baseFilter = [
        { field: 'status', operator: 'eq', value: 1, type: 'AND' },
        { field: 'deleted_at', operator: 'null', value: 'null', type: 'AND' },
    ];

    it('normalizes filters in a stable key order', () => {
        expect(normalizeFilter({ type: 'AND', value: 1, operator: 'eq', field: 'status' })).toEqual({
            field: 'status',
            operator: 'eq',
            type: 'AND',
            value: 1,
        });
    });

    it('detects missing mandatory base filters', () => {
        const submitted = [{ field: 'status', operator: 'eq', value: 1, type: 'AND' }];

        expect(findMissingBaseFilters(baseFilter, submitted)).toEqual([
            { field: 'deleted_at', operator: 'null', type: 'AND', value: 'null' },
        ]);
    });

    it('allows extra filters only when field and operator are allowlisted', () => {
        const submitted = [
            ...baseFilter,
            { field: 'documento', operator: 'eq', value: '123', type: 'AND' },
            { field: 'id', operator: 'ilike', value: '%abc%', type: 'AND' },
        ];
        const allowed = [{ field: 'documento', operators: ['eq'] }];

        expect(findDisallowedFilters(baseFilter, submitted, allowed)).toEqual([
            { field: 'id', operator: 'ilike', type: 'AND', value: '%abc%' },
        ]);
    });

    it('checks nested group filters recursively', () => {
        const submitted = [
            ...baseFilter,
            {
                groupType: 'OR',
                filters: [
                    { field: 'documento', operator: 'eq', value: '123', type: 'AND' },
                    { field: 'email', operator: 'ilike', value: '%x%', type: 'OR' },
                ],
            },
        ];
        const allowed = [{ field: 'documento', operators: ['eq'] }];

        expect(findDisallowedFilters(baseFilter, submitted, allowed)).toEqual([
            { field: 'email', operator: 'ilike', type: 'OR', value: '%x%' },
        ]);
    });
});
```

- [ ] **Step 2: Run filter matcher tests to verify they fail**

Run:

```bash
pnpm --filter @kace/api-common test -- --runTestsByPath tests/search-authorization/filterMatcher.test.js
```

Expected: FAIL because `filterMatcher.js` does not exist.

- [ ] **Step 3: Implement filter matcher**

Create `packages/kace_cloud_api_common/src/search-authorization/filterMatcher.js`:

```js
const sortObjectKeys = (value) => {
    if (Array.isArray(value)) return value.map(sortObjectKeys);
    if (!value || typeof value !== 'object') return value;

    return Object.keys(value)
        .sort()
        .reduce((acc, key) => {
            acc[key] = sortObjectKeys(value[key]);
            return acc;
        }, {});
};

export const normalizeFilter = (filter) => sortObjectKeys(filter);

export const filterKey = (filter) => JSON.stringify(normalizeFilter(filter));

export const flattenFilters = (filters = []) => {
    if (!Array.isArray(filters)) return [];

    return filters.flatMap((filter) => {
        if (filter?.groupType && Array.isArray(filter.filters)) {
            return flattenFilters(filter.filters);
        }
        return [normalizeFilter(filter)];
    });
};

export const findMissingBaseFilters = (baseFilters = [], submittedFilters = []) => {
    const submittedKeys = new Set(flattenFilters(submittedFilters).map(filterKey));

    return flattenFilters(baseFilters).filter((baseFilter) => !submittedKeys.has(filterKey(baseFilter)));
};

export const findDisallowedFilters = (baseFilters = [], submittedFilters = [], allowedFilters = []) => {
    const baseKeys = new Set(flattenFilters(baseFilters).map(filterKey));
    const allowedByField = new Map(allowedFilters.map(({ field, operators }) => [field, new Set(operators)]));

    return flattenFilters(submittedFilters).filter((filter) => {
        if (baseKeys.has(filterKey(filter))) return false;
        const allowedOperators = allowedByField.get(filter.field);
        return !allowedOperators || !allowedOperators.has(filter.operator);
    });
};
```

- [ ] **Step 4: Write failing relationship matcher tests**

Create `packages/kace_cloud_api_common/tests/search-authorization/relationshipMatcher.test.js`:

```js
import {
    findDisallowedRelationships,
    findMissingBaseRelationships,
    normalizeRelationship,
} from '../../src/search-authorization/relationshipMatcher.js';

describe('relationshipMatcher', () => {
    const baseRelationships = [
        {
            table: 'clients',
            type: 'left',
            condition: { source: 'cases.cliente_id', target: 'clients.id' },
        },
    ];

    it('normalizes relationship condition key order', () => {
        expect(
            normalizeRelationship({
                type: 'left',
                condition: { target: 'clients.id', source: 'cases.cliente_id' },
                table: 'clients',
            })
        ).toEqual({
            condition: { source: 'cases.cliente_id', target: 'clients.id' },
            table: 'clients',
            type: 'left',
        });
    });

    it('detects missing base relationships', () => {
        expect(findMissingBaseRelationships(baseRelationships, [])).toEqual(baseRelationships);
    });

    it('allows only explicitly allowlisted extra relationships', () => {
        const allowedRelationships = [
            {
                table: 'usuarios',
                type: 'left',
                condition: { source: 'cases.responsable_id', target: 'usuarios.id' },
            },
        ];
        const submitted = [
            ...baseRelationships,
            ...allowedRelationships,
            {
                table: 'roles',
                type: 'left',
                condition: { source: 'usuarios.rol_id', target: 'roles.id' },
            },
        ];

        expect(findDisallowedRelationships(baseRelationships, submitted, allowedRelationships)).toEqual([
            {
                condition: { source: 'usuarios.rol_id', target: 'roles.id' },
                table: 'roles',
                type: 'left',
            },
        ]);
    });
});
```

- [ ] **Step 5: Implement relationship matcher**

Create `packages/kace_cloud_api_common/src/search-authorization/relationshipMatcher.js`:

```js
const sortObjectKeys = (value) => {
    if (Array.isArray(value)) return value.map(sortObjectKeys);
    if (!value || typeof value !== 'object') return value;

    return Object.keys(value)
        .sort()
        .reduce((acc, key) => {
            acc[key] = sortObjectKeys(value[key]);
            return acc;
        }, {});
};

export const normalizeRelationship = (relationship) => sortObjectKeys(relationship);

export const relationshipKey = (relationship) => JSON.stringify(normalizeRelationship(relationship));

export const findMissingBaseRelationships = (baseRelationships = [], submittedRelationships = []) => {
    const submittedKeys = new Set((submittedRelationships || []).map((relationship) => relationshipKey(relationship)));

    return (baseRelationships || [])
        .map(normalizeRelationship)
        .filter((relationship) => !submittedKeys.has(relationshipKey(relationship)));
};

export const findDisallowedRelationships = (
    baseRelationships = [],
    submittedRelationships = [],
    allowedRelationships = []
) => {
    const baseKeys = new Set((baseRelationships || []).map((relationship) => relationshipKey(relationship)));
    const allowedKeys = new Set((allowedRelationships || []).map((relationship) => relationshipKey(relationship)));

    return (submittedRelationships || [])
        .map(normalizeRelationship)
        .filter((relationship) => !baseKeys.has(relationshipKey(relationship)) && !allowedKeys.has(relationshipKey(relationship)));
};
```

- [ ] **Step 6: Implement authorization error and capability validator**

Create `packages/kace_cloud_api_common/src/search-authorization/SearchAuthorizationError.js`:

```js
export class SearchAuthorizationError extends Error {
    constructor(endpointKey, reason, details = {}) {
        super('Search query is not allowed for this role.');
        this.name = 'SearchAuthorizationError';
        this.statusCode = 403;
        this.endpointKey = endpointKey;
        this.reason = reason;
        this.details = details;
    }
}
```

Create `packages/kace_cloud_api_common/src/search-authorization/capabilityValidator.js`:

```js
const DEFAULT_CAPABILITIES = {
    pagination: true,
    order: true,
    relationship: true,
    select: false,
    distinct: false,
    group_by: false,
    having: false,
};

const hasValue = (value) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && value !== false;
};

export const resolveCapabilities = (capabilities = {}) => ({ ...DEFAULT_CAPABILITIES, ...capabilities });

export const findDisallowedCapabilities = (query = {}, capabilities = {}) => {
    const resolved = resolveCapabilities(capabilities);
    const checks = [
        ['relationship', query.relationship],
        ['select', query.select],
        ['distinct', query.distinct],
        ['group_by', query.group_by],
        ['having', query.having],
        ['order', query.order],
    ];

    if (!resolved.pagination && (hasValue(query.limit) || hasValue(query.offset))) {
        checks.push(['pagination', { limit: query.limit, offset: query.offset }]);
    }

    return checks.filter(([capability, value]) => hasValue(value) && !resolved[capability]).map(([capability]) => capability);
};
```

- [ ] **Step 7: Run helper tests**

Run:

```bash
pnpm --filter @kace/api-common test -- --runTestsByPath tests/search-authorization/filterMatcher.test.js tests/search-authorization/relationshipMatcher.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit helper layer**

```bash
git add packages/kace_cloud_api_common/src/search-authorization/SearchAuthorizationError.js \
  packages/kace_cloud_api_common/src/search-authorization/filterMatcher.js \
  packages/kace_cloud_api_common/src/search-authorization/relationshipMatcher.js \
  packages/kace_cloud_api_common/src/search-authorization/capabilityValidator.js \
  packages/kace_cloud_api_common/tests/search-authorization/filterMatcher.test.js \
  packages/kace_cloud_api_common/tests/search-authorization/relationshipMatcher.test.js
git commit -m "feat: add search authorization matchers"
```

---

## Task 2: Add policy registry and authorization service

**Files:**
- Create: `packages/kace_cloud_api_common/src/search-authorization/SearchPolicyRegistry.js`
- Create: `packages/kace_cloud_api_common/src/search-authorization/SearchAuthorizationService.js`
- Modify: `packages/kace_cloud_api_common/src/index.js`
- Test: `packages/kace_cloud_api_common/tests/search-authorization/SearchAuthorizationService.test.js`
- Test: `packages/kace_cloud_api_common/tests/search-authorization/SearchPolicyRegistry.test.js`

- [ ] **Step 1: Write failing authorization service tests**

Create `packages/kace_cloud_api_common/tests/search-authorization/SearchAuthorizationService.test.js`:

```js
import { SearchAuthorizationService } from '../../src/search-authorization/SearchAuthorizationService.js';
import { SearchAuthorizationError } from '../../src/search-authorization/SearchAuthorizationError.js';

const baseFilter = [{ field: 'status', operator: 'eq', value: 1, type: 'AND' }];
const baseRelationships = [
    { table: 'clients', type: 'left', condition: { source: 'cases.cliente_id', target: 'clients.id' } },
];
const policy = {
    endpointKey: 'cases.search',
    advancedPermission: { role: 'search', module_id: 'cases', name: 'CasesSearchAdvanced' },
    baseFilter,
    baseRelationships,
    allowedFilters: [{ field: 'reference', operators: ['eq', 'like'] }],
    allowedRelationships: [
        { table: 'usuarios', type: 'left', condition: { source: 'cases.responsable_id', target: 'usuarios.id' } },
    ],
    allowedCapabilities: { order: true, pagination: true, relationship: true, select: false },
};

const userWithAdvancedPermission = {
    hasPermission: jest.fn((role, moduleId, name) => role === 'search' && moduleId === 'cases' && name === 'CasesSearchAdvanced'),
};

const userWithoutAdvancedPermission = {
    hasPermission: jest.fn(() => false),
};

describe('SearchAuthorizationService', () => {
    it('allows any SearchSchema-valid query for advanced users', () => {
        const service = new SearchAuthorizationService({ policies: [policy] });
        const query = { filter: [{ field: 'id', operator: 'ilike', value: '%x%', type: 'AND' }], relationship: [] };

        expect(service.authorize({ endpointKey: 'cases.search', user: userWithAdvancedPermission, query })).toBe(query);
    });

    it('allows normal users when base query and allowlists are satisfied', () => {
        const service = new SearchAuthorizationService({ policies: [policy] });
        const query = {
            filter: [...baseFilter, { field: 'reference', operator: 'eq', value: '10', type: 'AND' }],
            relationship: [...baseRelationships, ...policy.allowedRelationships],
            order: { field: 'created_at', direction: 'desc' },
            limit: 10,
            offset: 0,
        };

        expect(service.authorize({ endpointKey: 'cases.search', user: userWithoutAdvancedPermission, query })).toBe(query);
    });

    it('rejects normal users when the base filter is missing', () => {
        const service = new SearchAuthorizationService({ policies: [policy] });
        const query = { filter: [{ field: 'reference', operator: 'eq', value: '10', type: 'AND' }], relationship: baseRelationships };

        expect(() => service.authorize({ endpointKey: 'cases.search', user: userWithoutAdvancedPermission, query })).toThrow(
            SearchAuthorizationError
        );
    });

    it('rejects normal users when a relationship is not allowlisted', () => {
        const service = new SearchAuthorizationService({ policies: [policy] });
        const query = {
            filter: baseFilter,
            relationship: [
                ...baseRelationships,
                { table: 'roles', type: 'left', condition: { source: 'usuarios.rol_id', target: 'roles.id' } },
            ],
        };

        expect(() => service.authorize({ endpointKey: 'cases.search', user: userWithoutAdvancedPermission, query })).toThrow(
            SearchAuthorizationError
        );
    });

    it('rejects normal users when disabled capabilities are used', () => {
        const service = new SearchAuthorizationService({ policies: [policy] });
        const query = { filter: baseFilter, relationship: baseRelationships, select: ['cases.id'] };

        expect(() => service.authorize({ endpointKey: 'cases.search', user: userWithoutAdvancedPermission, query })).toThrow(
            SearchAuthorizationError
        );
    });
});
```

- [ ] **Step 2: Implement policy registry**

Create `packages/kace_cloud_api_common/src/search-authorization/SearchPolicyRegistry.js`:

```js
export const createAdvancedPermission = (moduleId, name) => ({
    role: 'search',
    module_id: moduleId,
    name,
});

export const searchPolicies = [
    {
        endpointKey: 'clients.search',
        advancedPermission: createAdvancedPermission('clients', 'ClientsSearchAdvanced'),
        baseFilter: [{ field: 'status', operator: 'eq', value: 1, type: 'AND' }],
        baseRelationships: [],
        allowedFilters: [
            { field: 'documento', operators: ['eq', 'like', 'ilike'] },
            { field: 'nombres', operators: ['like', 'ilike'] },
            { field: 'apellido1', operators: ['like', 'ilike'] },
            { field: 'apellido2', operators: ['like', 'ilike'] },
            { field: 'nombre_empresa', operators: ['like', 'ilike'] },
        ],
        allowedRelationships: [],
        allowedCapabilities: { pagination: true, order: true, relationship: true, select: false, distinct: false, group_by: false, having: false },
    },
    {
        endpointKey: 'cases.search',
        advancedPermission: createAdvancedPermission('cases', 'CasesSearchAdvanced'),
        baseFilter: [{ field: 'deleted_by', operator: 'null', value: 'null', type: 'AND' }],
        baseRelationships: [],
        allowedFilters: [
            { field: 'id', operators: ['eq'] },
            { field: 'reference', operators: ['eq', 'like', 'ilike'] },
            { field: 'cliente_id', operators: ['eq'] },
            { field: 'responsable_id', operators: ['eq'] },
            { field: 'grupo_id', operators: ['eq'] },
            { field: 'estado_actual_id', operators: ['eq'] },
        ],
        allowedRelationships: [],
        allowedCapabilities: { pagination: true, order: true, relationship: true, select: false, distinct: false, group_by: false, having: false },
    },
    {
        endpointKey: 'users.search',
        advancedPermission: createAdvancedPermission('users', 'UsersSearchAdvanced'),
        baseFilter: [{ field: 'deleted_by', operator: 'null', value: 'null', type: 'AND' }],
        baseRelationships: [],
        allowedFilters: [
            { field: 'id', operators: ['eq'] },
            { field: 'login', operators: ['eq', 'like', 'ilike'] },
            { field: 'email', operators: ['eq', 'like', 'ilike'] },
            { field: 'is_active', operators: ['eq'] },
            { field: 'rol_id', operators: ['eq'] },
        ],
        allowedRelationships: [],
        allowedCapabilities: { pagination: true, order: true, relationship: true, select: false, distinct: false, group_by: false, having: false },
    },
    {
        endpointKey: 'boards.search',
        advancedPermission: createAdvancedPermission('boards', 'BoardsSearchAdvanced'),
        baseFilter: [],
        baseRelationships: [],
        allowedFilters: [
            { field: 'id', operators: ['eq'] },
            { field: 'name', operators: ['eq', 'like', 'ilike'] },
            { field: 'is_active', operators: ['eq'] },
        ],
        allowedRelationships: [],
        allowedCapabilities: { pagination: true, order: true, relationship: true, select: false, distinct: false, group_by: false, having: false },
    },
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
```

This initial registry seeds the first sensitive endpoints. A later migration task expands it to all handlers before coverage checks are enabled.

- [ ] **Step 3: Implement authorization service**

Create `packages/kace_cloud_api_common/src/search-authorization/SearchAuthorizationService.js`:

```js
import { Helper } from '@kace/core/src/shared/index.js';
import { findDisallowedCapabilities } from './capabilityValidator.js';
import { findDisallowedFilters, findMissingBaseFilters } from './filterMatcher.js';
import { findDisallowedRelationships, findMissingBaseRelationships } from './relationshipMatcher.js';
import { SearchAuthorizationError } from './SearchAuthorizationError.js';
import { getSearchPolicy, searchPolicies } from './SearchPolicyRegistry.js';

export class SearchAuthorizationService {
    constructor({ policies = searchPolicies } = {}) {
        this.policies = policies;
    }

    authorize({ endpointKey, user, query }) {
        const policy = getSearchPolicy(endpointKey, this.policies);

        if (this.#hasAdvancedPermission(user, policy.advancedPermission)) {
            return query;
        }

        this.#assertNormalUserQueryIsAllowed(policy, query || {});
        return query;
    }

    #hasAdvancedPermission(user, permission) {
        if (!user || !permission) return false;
        if (typeof user.hasSearchPermission === 'function') {
            return user.hasSearchPermission(permission.module_id, permission.name);
        }
        return user.hasPermission(permission.role, permission.module_id, permission.name);
    }

    #assertNormalUserQueryIsAllowed(policy, query) {
        const missingBaseFilters = findMissingBaseFilters(policy.baseFilter, query.filter || []);
        if (missingBaseFilters.length > 0) {
            this.#deny(policy.endpointKey, 'missing_base_filters', { missingBaseFilters });
        }

        const disallowedFilters = findDisallowedFilters(policy.baseFilter, query.filter || [], policy.allowedFilters || []);
        if (disallowedFilters.length > 0) {
            this.#deny(policy.endpointKey, 'disallowed_filters', { disallowedFilters });
        }

        const missingBaseRelationships = findMissingBaseRelationships(policy.baseRelationships, query.relationship || []);
        if (missingBaseRelationships.length > 0) {
            this.#deny(policy.endpointKey, 'missing_base_relationships', { missingBaseRelationships });
        }

        const disallowedRelationships = findDisallowedRelationships(
            policy.baseRelationships,
            query.relationship || [],
            policy.allowedRelationships || []
        );
        if (disallowedRelationships.length > 0) {
            this.#deny(policy.endpointKey, 'disallowed_relationships', { disallowedRelationships });
        }

        const disallowedCapabilities = findDisallowedCapabilities(query, policy.allowedCapabilities || {});
        if (disallowedCapabilities.length > 0) {
            this.#deny(policy.endpointKey, 'disallowed_capabilities', { disallowedCapabilities });
        }
    }

    #deny(endpointKey, reason, details) {
        Helper.logInfo('Search authorization denied', { endpointKey, reason, details });
        throw new SearchAuthorizationError(endpointKey, reason, details);
    }
}
```

- [ ] **Step 4: Export search authorization API**

Modify `packages/kace_cloud_api_common/src/index.js`:

```js
export { SearchSchema } from './validation/schemas/SearchSchema.js';
export { TestHelper } from '../tests/helpers/TestHelper.js';
export { HttpResponse } from './http_responses/HttpResponse.js';
export { Response } from './http_responses/Response.js';
export { MethodNotAllowedError } from './errors/runtime/MethodNotAllowedError.js';
export { ResourceNotFoundError } from './errors/runtime/ResourceNotFoundError.js';
export { RuntimeError } from './errors/runtime/RuntimeError.js';
export { BaseError } from './errors/BaseError.js';
export { BaseController } from './controllers/BaseController.js';
export { ScheduleEventController } from './controllers/ScheduleEventController.js';
export { SearchAuthorizationError } from './search-authorization/SearchAuthorizationError.js';
export { SearchAuthorizationService } from './search-authorization/SearchAuthorizationService.js';
export {
    createAdvancedPermission,
    getSearchPermissionDefinitions,
    getSearchPolicy,
    searchPolicies,
} from './search-authorization/SearchPolicyRegistry.js';

// Multi-Tenant Middleware
export { TenantContextManager } from './middleware/TenantContextManager.js';
export { tenantMiddleware } from './middleware/tenantMiddleware.js';
export { withTenantContext } from './middleware/withTenantContext.js';

// Multi-Tenant Handlers
export { handler as eventbridgeOrchestratorHandler } from './handlers/eventbridge-orchestrator.mjs';
```

- [ ] **Step 5: Run authorization service tests**

Run:

```bash
pnpm --filter @kace/api-common test -- --runTestsByPath tests/search-authorization/SearchAuthorizationService.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit authorization service**

```bash
git add packages/kace_cloud_api_common/src/search-authorization/SearchAuthorizationService.js \
  packages/kace_cloud_api_common/src/search-authorization/SearchPolicyRegistry.js \
  packages/kace_cloud_api_common/src/index.js \
  packages/kace_cloud_api_common/tests/search-authorization/SearchAuthorizationService.test.js
git commit -m "feat: add search authorization service"
```

---

## Task 3: Add search permission category to backend roles

**Files:**
- Create: `packages/kace_cloud_core/src/role/domain/SearchPermissionsCatalog.js`
- Modify: `packages/kace_cloud_core/src/role/domain/ListPermissions.js`
- Modify: `packages/kace_cloud_core/src/role/domain/value-object/ValueObjectPermissions.js`
- Modify: `packages/kace_cloud_core/src/users/domain/User.js`
- Modify: `apps/apiv1/kace_cloud_api_roles/src/schemas.mjs`
- Test: `packages/kace_cloud_core/tests/role/SearchPermissionsCatalog.test.js`

- [ ] **Step 1: Write failing permission catalog tests**

Create `packages/kace_cloud_core/tests/role/SearchPermissionsCatalog.test.js`:

```js
import { ListPermissions } from '../../src/role/domain/ListPermissions.js';
import { ValueObjectPermissions } from '../../src/role/domain/value-object/ValueObjectPermissions.js';
import { User } from '../../src/users/domain/User.js';

describe('search permissions category', () => {
    it('is included in the canonical permission list', () => {
        const permissions = new ListPermissions().toPrimivites();

        expect(permissions.search.some((permission) => permission.name === 'ClientsSearchAdvanced')).toBe(true);
        expect(permissions.search.some((permission) => permission.name === 'CasesSearchAdvanced')).toBe(true);
    });

    it('validates and formats search permissions', () => {
        const valueObject = new ValueObjectPermissions({
            agente: [],
            administrador: [],
            auxiliaries: [],
            search: [{ module_id: 'clients', name: 'ClientsSearchAdvanced', description: 'Use advanced search filters on clients.search', granted: true }],
        });

        const parsed = JSON.parse(valueObject.value);
        expect(parsed.search.find((permission) => permission.name === 'ClientsSearchAdvanced').granted).toBe(true);
    });

    it('checks search permission through the user helper', () => {
        const user = new User({
            id: '11111111-1111-4111-8111-111111111111',
            login: 'admin@example.com',
            nombres: 'Admin',
            email: 'admin@example.com',
            is_active: 1,
            rol_id: '22222222-2222-4222-8222-222222222222',
            permissions: {
                agente: [],
                administrador: [],
                auxiliaries: [],
                search: [{ module_id: 'clients', name: 'ClientsSearchAdvanced', description: 'Use advanced search filters on clients.search', granted: true }],
            },
        });

        expect(user.hasSearchPermission('clients', 'ClientsSearchAdvanced')).toBe(true);
    });
});
```

- [ ] **Step 2: Implement search permissions catalog**

Create `packages/kace_cloud_core/src/role/domain/SearchPermissionsCatalog.js`:

```js
import { Permissions } from './Permissions.js';

const SEARCH_PERMISSION_DEFINITIONS = [
    ['ClientsSearchAdvanced', 'Use advanced search filters on clients search', 'clients'],
    ['CasesSearchAdvanced', 'Use advanced search filters on cases search', 'cases'],
    ['UsersSearchAdvanced', 'Use advanced search filters on users search', 'users'],
    ['BoardsSearchAdvanced', 'Use advanced search filters on boards search', 'boards'],
];

export class SearchPermissionsCatalog {
    static definitions() {
        return SEARCH_PERMISSION_DEFINITIONS.map(
            ([name, description, moduleId]) => new Permissions(name, description, false, moduleId)
        );
    }
}
```

During the all-handler migration task, append generated permissions for every endpoint to `SEARCH_PERMISSION_DEFINITIONS` using the same tuple shape.

- [ ] **Step 3: Add search category to ListPermissions**

Modify `packages/kace_cloud_core/src/role/domain/ListPermissions.js`:

```js
import { Permissions } from './Permissions';
import { AuxPermissions } from './AuxPermissions.js';
import { SearchPermissionsCatalog } from './SearchPermissionsCatalog.js';

export class ListPermissions {
    /** @type {Object} is initialized in the constructor */
    #permissions;
    constructor() {
        this.#permissions = {
            agente: [
                // keep existing agente permissions unchanged
            ],
            administrador: [
                // keep existing administrador permissions unchanged
            ],
            auxiliaries: [],
            search: SearchPermissionsCatalog.definitions(),
        };
    }

    get permissions() {
        return this.#permissions;
    }

    isValidPermissions(permission, key) {
        const permissions = this.#permissions[key];
        if (!permissions) return false;

        if (key === 'auxiliaries') {
            return new AuxPermissions().isValidPermissions(permission);
        }

        return permissions.some((validPermission) => {
            const valid = validPermission.toPrimitives ? validPermission.toPrimitives() : validPermission;
            return valid.name === permission.name && valid.module_id === permission.module_id;
        });
    }

    toPrimivites() {
        return Object.entries(this.#permissions).reduce((acc, [key, permissions]) => {
            acc[key] = permissions.map((permission) => (permission.toPrimitives ? permission.toPrimitives() : permission));
            return acc;
        }, {});
    }
}
```

Keep all current permission entries in place. Only add the import and `search` category, and preserve existing helper method bodies if they already match these semantics.

- [ ] **Step 4: Update ValueObjectPermissions merge behavior**

Modify `packages/kace_cloud_core/src/role/domain/value-object/ValueObjectPermissions.js` so the formatted result includes all canonical categories, including `search`:

```js
const formattedPermissions = {};
const referencePermissions = this.#listPermissions.permissions;

for (const [role, refPermissions] of Object.entries(referencePermissions)) {
    const receivedPermissions = this.#value[role] || [];
    const receivedPermissionsMap = new Map();

    receivedPermissions.forEach((perm) => {
        const key = `${perm.module_id}:${perm.name}`;
        if (!receivedPermissionsMap.has(key)) {
            receivedPermissionsMap.set(key, perm);
        }
    });

    formattedPermissions[role] = refPermissions.map((refPerm) => {
        const primitive = refPerm.toPrimitives ? refPerm.toPrimitives() : refPerm;
        const key = `${primitive.module_id}:${primitive.name}`;
        const receivedPerm = receivedPermissionsMap.get(key);

        return receivedPerm ? { ...primitive, granted: receivedPerm.granted } : primitive;
    });
}

return JSON.stringify({
    ...formattedPermissions,
    auxiliaries: this.#value.auxiliaries ?? formattedPermissions.auxiliaries ?? [],
});
```

- [ ] **Step 5: Add user search permission helper**

Modify `packages/kace_cloud_core/src/users/domain/User.js`:

```js
hasSearchPermission(moduleId, permissionName) {
    return this.hasPermission('search', moduleId, permissionName);
}
```

Place it next to `hasPermission`.

- [ ] **Step 6: Allow search category in role API schema**

Modify `apps/apiv1/kace_cloud_api_roles/src/schemas.mjs` so the `permisos` key validation includes `'search'`:

```js
const permisos = Joi.object()
    .pattern(
        Joi.string().valid('agente', 'administrador', 'auxiliaries', 'search'),
        Joi.array().items(
            Joi.object({
                module_id: Joi.string().required(),
                name: Joi.string().required(),
                description: Joi.string().required(),
                granted: Joi.boolean().required(),
            })
        )
    )
    .required();
```

Keep any existing schema fields not shown here.

- [ ] **Step 7: Run role tests**

Run:

```bash
pnpm --filter @kace/core tests -- --runTestsByPath tests/role/SearchPermissionsCatalog.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit backend permission changes**

```bash
git add packages/kace_cloud_core/src/role/domain/SearchPermissionsCatalog.js \
  packages/kace_cloud_core/src/role/domain/ListPermissions.js \
  packages/kace_cloud_core/src/role/domain/value-object/ValueObjectPermissions.js \
  packages/kace_cloud_core/src/users/domain/User.js \
  apps/apiv1/kace_cloud_api_roles/src/schemas.mjs \
  packages/kace_cloud_core/tests/role/SearchPermissionsCatalog.test.js
git commit -m "feat: add search permissions category"
```

---

## Task 4: Update Role Details UI for the search permissions category

**Files:**
- Modify: `apps/kace-saas/src/pages/Roles/components/RoleForm/components/RoleFormTabSearch/hooks/useRoleFormTabSerach.js`
- Modify: `apps/kace-saas/src/pages/Roles/components/RoleForm/utils/processRoleData.js`
- Modify: translation files under `apps/kace-saas/src/**/locales*` or equivalent once located by `grep -R "rol.form.title.agent" apps/kace-saas/src`.

- [ ] **Step 1: Update processing utility for search permissions**

Modify `apps/kace-saas/src/pages/Roles/components/RoleForm/utils/processRoleData.js`:

```js
export const permissionsListProcessed = (permissions) => {
    try {
        if (!permissions || typeof permissions !== 'object') {
            return { agent: {}, admin: {}, aux: {}, search: {} };
        }

        const agentPermissions = groupAndSortPermissionsByModule(permissions?.agente || []);
        const adminPermissions = groupAndSortPermissionsByModule(permissions?.administrador || []);
        const auxPermissions = groupAndSortPermissionsByModule(permissions?.auxiliaries || []);
        const searchPermissions = groupAndSortPermissionsByModule(permissions?.search || []);

        return {
            agent: agentPermissions,
            admin: adminPermissions,
            aux: auxPermissions,
            search: searchPermissions,
        };
    } catch {
        return { agent: {}, admin: {}, aux: {}, search: {} };
    }
};

export const validatePesmisions = (permissions) => {
    try {
        const validateAdmin = permissions.administrador.some((item) => item.granted);
        const validateAgente = permissions.agente.some((item) => item.granted);
        const validateAuxiliries = permissions.auxiliaries.some((item) => item.granted);
        const validateSearch = permissions.search?.some((item) => item.granted) ?? false;
        return validateAdmin || validateAgente || validateAuxiliries || validateSearch;
    } catch {
        return false;
    }
};
```

Keep `mergeGrantedStatus` generic; it already loops over all keys in `targetData`.

- [ ] **Step 2: Add search label to dynamic RoleFormTabSearch tabs**

Modify `apps/kace-saas/src/pages/Roles/components/RoleForm/components/RoleFormTabSearch/hooks/useRoleFormTabSerach.js`:

```js
const ROLE_LABELS = {
    agente: 'agent',
    administrador: 'admin',
    auxiliaries: 'auxiliaries',
    search: 'searchPermissions',
};
```

The existing `availableRoles` logic will include the `search` key automatically when returned by the permissions API.

- [ ] **Step 3: Add translations**

Find translation files:

```bash
grep -R "rol.form.title.agent" -n apps/kace-saas/src
```

In each file found, add:

```json
{
  "rol": {
    "form": {
      "title": {
        "searchPermissions": "Search permissions"
      }
    }
  }
}
```

Preserve each file's existing structure and language. If Spanish files exist, use `Permisos de búsqueda`.

- [ ] **Step 4: Run frontend validation**

Run:

```bash
pnpm --filter kace-sass lint
pnpm --filter kace-sass test -- --runInBand RoleForm
```

Expected: lint passes; if no RoleForm tests exist, Vitest reports no matching tests or runs existing matching tests.

- [ ] **Step 5: Commit UI changes**

```bash
git add apps/kace-saas/src/pages/Roles/components/RoleForm/components/RoleFormTabSearch/hooks/useRoleFormTabSerach.js \
  apps/kace-saas/src/pages/Roles/components/RoleForm/utils/processRoleData.js \
  apps/kace-saas/src
git commit -m "feat: show search permissions in role form"
```

---

## Task 5: Add inventory and coverage scripts

**Files:**
- Create: `scripts/search-authorization/inventory-search-handlers.mjs`
- Create: `scripts/search-authorization/check-search-authorization-coverage.mjs`
- Modify: `package.json`

- [ ] **Step 1: Create inventory script**

Create `scripts/search-authorization/inventory-search-handlers.mjs`:

```js
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const API_ROOT = path.join(ROOT, 'apps', 'apiv1');

const walk = (dir) => {
    const entries = readdirSync(dir, { withFileTypes: true });
    return entries.flatMap((entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === 'lib') return [];
            return walk(fullPath);
        }
        if (!entry.name.endsWith('.js') && !entry.name.endsWith('.mjs')) return [];
        return [fullPath];
    });
};

const toEndpointKey = (filePath) => {
    const relative = path.relative(API_ROOT, filePath);
    const [serviceName, ...rest] = relative.split(path.sep);
    const controllerName = rest.join('/').replace(/^src\//, '').replace(/\.(mjs|js)$/, '');
    return `${serviceName.replace(/^kace_cloud_api_/, '').replace(/_/g, '-')}.${controllerName.replace(/\//g, '.')}.search`;
};

const files = statSync(API_ROOT).isDirectory() ? walk(API_ROOT) : [];
const handlers = files
    .map((filePath) => ({ filePath, source: readFileSync(filePath, 'utf8') }))
    .filter(({ source }) => /async\s+actionSearch\s*\(/.test(source) || /actionSearch\s*\(/.test(source))
    .map(({ filePath }) => ({
        endpointKey: toEndpointKey(filePath),
        file: path.relative(ROOT, filePath),
    }))
    .sort((a, b) => a.endpointKey.localeCompare(b.endpointKey));

console.log(JSON.stringify(handlers, null, 2));
```

- [ ] **Step 2: Create coverage script**

Create `scripts/search-authorization/check-search-authorization-coverage.mjs`:

```js
import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';

const inventory = spawnSync(process.execPath, ['scripts/search-authorization/inventory-search-handlers.mjs'], {
    encoding: 'utf8',
});

if (inventory.status !== 0) {
    console.error(inventory.stderr);
    process.exit(inventory.status);
}

const handlers = JSON.parse(inventory.stdout);
const registrySource = readFileSync('packages/kace_cloud_api_common/src/search-authorization/SearchPolicyRegistry.js', 'utf8');

const missingPolicies = [];
const missingEnforcement = [];

for (const handler of handlers) {
    if (!registrySource.includes(`endpointKey: '${handler.endpointKey}'`) && !registrySource.includes(`endpointKey: "${handler.endpointKey}"`)) {
        missingPolicies.push(handler.endpointKey);
    }

    const source = readFileSync(handler.file, 'utf8');
    if (!source.includes('SearchAuthorizationService') || !source.includes(handler.endpointKey)) {
        missingEnforcement.push(`${handler.endpointKey} (${handler.file})`);
    }
}

if (missingPolicies.length > 0 || missingEnforcement.length > 0) {
    if (missingPolicies.length > 0) {
        console.error('Missing search policies:');
        missingPolicies.forEach((item) => console.error(`- ${item}`));
    }
    if (missingEnforcement.length > 0) {
        console.error('Missing search enforcement calls:');
        missingEnforcement.forEach((item) => console.error(`- ${item}`));
    }
    process.exit(1);
}

console.log(`Search authorization coverage OK for ${handlers.length} handlers.`);
```

- [ ] **Step 3: Add root package scripts**

Modify root `package.json` scripts:

```json
{
  "scripts": {
    "search-auth:inventory": "node scripts/search-authorization/inventory-search-handlers.mjs",
    "search-auth:check": "node scripts/search-authorization/check-search-authorization-coverage.mjs"
  }
}
```

Keep existing scripts and insert these keys in the `scripts` object.

- [ ] **Step 4: Run inventory script**

Run:

```bash
pnpm search-auth:inventory > /tmp/kace-search-handlers.json
node -e "const h=require('/tmp/kace-search-handlers.json'); console.log(h.length); console.log(h.slice(0,5))"
```

Expected: prints the number of discovered handlers and the first five endpoint keys. Based on exploration, expect roughly 246 handlers.

- [ ] **Step 5: Commit scripts**

```bash
git add scripts/search-authorization/inventory-search-handlers.mjs \
  scripts/search-authorization/check-search-authorization-coverage.mjs \
  package.json
git commit -m "chore: add search authorization coverage scripts"
```

---

## Task 6: Expand policy registry to every search handler

**Files:**
- Modify: `packages/kace_cloud_api_common/src/search-authorization/SearchPolicyRegistry.js`
- Modify: `packages/kace_cloud_core/src/role/domain/SearchPermissionsCatalog.js`

- [ ] **Step 1: Generate handler inventory**

Run:

```bash
pnpm search-auth:inventory > /tmp/kace-search-handlers.json
node -e "const h=require('/tmp/kace-search-handlers.json'); console.log(h.map(x => x.endpointKey).join('\n'))" > /tmp/kace-search-endpoint-keys.txt
```

Expected: `/tmp/kace-search-endpoint-keys.txt` contains one endpoint key per handler.

- [ ] **Step 2: Add one policy per endpoint key**

For every endpoint key in `/tmp/kace-search-endpoint-keys.txt`, add an entry to `searchPolicies` in `packages/kace_cloud_api_common/src/search-authorization/SearchPolicyRegistry.js`.

Use this exact policy pattern for each endpoint, replacing module/name/endpoint details:

```js
{
    endpointKey: '<endpoint-key-from-inventory>',
    advancedPermission: createAdvancedPermission('<module-id>', '<PascalModuleName>SearchAdvanced'),
    baseFilter: [],
    baseRelationships: [],
    allowedFilters: [],
    allowedRelationships: [],
    allowedCapabilities: { pagination: true, order: true, relationship: true, select: false, distinct: false, group_by: false, having: false },
}
```

Then immediately tighten the base query and allowlists for endpoints that expose sensitive data or already have known required filters. At minimum in this task, use these concrete entries for the four priority endpoint keys when present in inventory:

```js
{
    endpointKey: 'clients.Controller.search',
    advancedPermission: createAdvancedPermission('clients', 'ClientsSearchAdvanced'),
    baseFilter: [{ field: 'status', operator: 'eq', value: 1, type: 'AND' }],
    baseRelationships: [],
    allowedFilters: [
        { field: 'documento', operators: ['eq', 'like', 'ilike'] },
        { field: 'nombres', operators: ['like', 'ilike'] },
        { field: 'apellido1', operators: ['like', 'ilike'] },
        { field: 'apellido2', operators: ['like', 'ilike'] },
        { field: 'nombre_empresa', operators: ['like', 'ilike'] },
    ],
    allowedRelationships: [],
    allowedCapabilities: { pagination: true, order: true, relationship: true, select: false, distinct: false, group_by: false, having: false },
}
```

```js
{
    endpointKey: 'cases.controller.search',
    advancedPermission: createAdvancedPermission('cases', 'CasesSearchAdvanced'),
    baseFilter: [{ field: 'deleted_by', operator: 'null', value: 'null', type: 'AND' }],
    baseRelationships: [],
    allowedFilters: [
        { field: 'id', operators: ['eq'] },
        { field: 'reference', operators: ['eq', 'like', 'ilike'] },
        { field: 'cliente_id', operators: ['eq'] },
        { field: 'responsable_id', operators: ['eq'] },
        { field: 'grupo_id', operators: ['eq'] },
        { field: 'estado_actual_id', operators: ['eq'] },
    ],
    allowedRelationships: [],
    allowedCapabilities: { pagination: true, order: true, relationship: true, select: false, distinct: false, group_by: false, having: false },
}
```

If the inventory key casing differs, use the exact inventory key and keep the policy contents above.

- [ ] **Step 3: Add matching advanced permissions for every policy**

Update `packages/kace_cloud_core/src/role/domain/SearchPermissionsCatalog.js` so each policy's `advancedPermission.name` appears once in `SEARCH_PERMISSION_DEFINITIONS`.

Use this naming rule:

```txt
<PascalCase module id>SearchAdvanced
```

Examples:

```js
['ClientsSearchAdvanced', 'Use advanced search filters on clients search', 'clients'],
['CasesSearchAdvanced', 'Use advanced search filters on cases search', 'cases'],
['UsersSearchAdvanced', 'Use advanced search filters on users search', 'users'],
['BoardsSearchAdvanced', 'Use advanced search filters on boards search', 'boards'],
```

- [ ] **Step 4: Run registry tests and coverage script before handler migration**

Run:

```bash
pnpm --filter @kace/api-common test -- --runTestsByPath tests/search-authorization/SearchAuthorizationService.test.js
pnpm search-auth:check
```

Expected: service tests PASS. Coverage script FAILS only with missing enforcement calls, not missing policies.

- [ ] **Step 5: Commit full policy registry**

```bash
git add packages/kace_cloud_api_common/src/search-authorization/SearchPolicyRegistry.js \
  packages/kace_cloud_core/src/role/domain/SearchPermissionsCatalog.js
git commit -m "feat: register search policies for all handlers"
```

---

## Task 7: Migrate all search handlers to call the authorization service

**Files:**
- Modify: every `apps/apiv1/*/src/*.{js,mjs}` file reported by `pnpm search-auth:inventory`.

- [ ] **Step 1: Add the standard import to each handler file**

For each handler file, add `SearchAuthorizationService` and `SearchAuthorizationError` to existing `@kace/api-common` imports. Example:

```js
import { HttpResponse, BaseController, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
```

If the file already imports `SearchSchema` from `@kace/api-common/src/validation/schemas/SearchSchema`, leave that import unchanged.

- [ ] **Step 2: Add standard authorization helper to each controller class**

Inside each controller class with `actionSearch`, add this private method:

```js
#authorizeSearch(endpointKey, query) {
    return new SearchAuthorizationService().authorize({
        endpointKey,
        user: this.user,
        query,
    });
}
```

If the controller file exports multiple controller classes, add the helper to each class that owns an `actionSearch` method.

- [ ] **Step 3: Call authorization after `SearchSchema.validate` succeeds**

In every `actionSearch`, immediately after Joi validation succeeds and before searcher/repository execution, add:

```js
const authorizedQuery = this.#authorizeSearch('<endpoint-key-from-inventory>', value);
```

Then pass `authorizedQuery` to the existing searcher instead of `value` or the pre-authorization DTO. If the handler transforms filters first, authorize the transformed DTO that will be executed:

```js
const modifiedData = {
    ...value,
    filter: this.#transformerFilter(value.filter),
};

const authorizedQuery = this.#authorizeSearch('clients.Controller.search', modifiedData);
const response = await new ClientSearcher(/* existing deps */).execute(authorizedQuery, this.user.grupo_activo);
```

- [ ] **Step 4: Return 403 for authorization denials**

In each `catch` block for `actionSearch`, add this branch before the generic internal server error response:

```js
if (error instanceof SearchAuthorizationError) {
    return HttpResponse.forbidden({
        message: error.message,
        event: this.event,
    });
}
```

If the controller uses `this.#event` instead of `this.event`, use its existing event property.

- [ ] **Step 5: Run coverage after migration**

Run:

```bash
pnpm search-auth:check
```

Expected: PASS with `Search authorization coverage OK for <count> handlers.`

- [ ] **Step 6: Run representative API tests**

Run:

```bash
pnpm --filter @kace/api-common test -- --runTestsByPath tests/search-authorization/SearchAuthorizationService.test.js
pnpm --filter @kace/core tests -- --runTestsByPath tests/clients/ClienstIntegration.test.js tests/boards/BoardResourcesIntegration.test.js
```

Expected: PASS. If an integration test fails because it submits queries that do not include new base filters, update that test query to include the endpoint base query or grant the test user the corresponding search advanced permission.

- [ ] **Step 7: Commit handler migration**

```bash
git add apps/apiv1 packages/kace_cloud_api_common/src/search-authorization/SearchPolicyRegistry.js
git commit -m "feat: enforce search authorization on api handlers"
```

---

## Task 8: Add focused integration coverage for vulnerable behavior

**Files:**
- Modify: `packages/kace_cloud_core/tests/clients/ClienstIntegration.test.js` or create API-common-level service tests if API E2E harness is expensive.
- Create: `packages/kace_cloud_api_common/tests/search-authorization/vulnerabilityRegression.test.js`

- [ ] **Step 1: Add service-level regression tests for the reported client bypass**

Create `packages/kace_cloud_api_common/tests/search-authorization/vulnerabilityRegression.test.js`:

```js
import { SearchAuthorizationService } from '../../src/search-authorization/SearchAuthorizationService.js';

const clientsPolicy = {
    endpointKey: 'clients.Controller.search',
    advancedPermission: { role: 'search', module_id: 'clients', name: 'ClientsSearchAdvanced' },
    baseFilter: [{ field: 'status', operator: 'eq', value: 1, type: 'AND' }],
    baseRelationships: [],
    allowedFilters: [{ field: 'documento', operators: ['eq'] }],
    allowedRelationships: [],
    allowedCapabilities: { pagination: true, order: true, relationship: true, select: false, distinct: false, group_by: false, having: false },
};

const normalUser = { hasPermission: jest.fn(() => false) };
const advancedUser = { hasPermission: jest.fn(() => true) };

describe('search authorization vulnerability regression', () => {
    it('rejects a normal client search when the base filter is removed', () => {
        const service = new SearchAuthorizationService({ policies: [clientsPolicy] });
        const manipulatedQuery = {
            filter: [{ field: 'documento', operator: 'eq', value: '11111111A', type: 'AND' }],
            relationship: [],
            limit: 100,
            offset: 0,
        };

        expect(() =>
            service.authorize({ endpointKey: 'clients.Controller.search', user: normalUser, query: manipulatedQuery })
        ).toThrow('Search query is not allowed for this role.');
    });

    it('rejects a normal client search when a non-allowlisted id filter is added', () => {
        const service = new SearchAuthorizationService({ policies: [clientsPolicy] });
        const manipulatedQuery = {
            filter: [
                { field: 'status', operator: 'eq', value: 1, type: 'AND' },
                { field: 'id', operator: 'ilike', value: '%', type: 'AND' },
            ],
            relationship: [],
            limit: 100,
            offset: 0,
        };

        expect(() =>
            service.authorize({ endpointKey: 'clients.Controller.search', user: normalUser, query: manipulatedQuery })
        ).toThrow('Search query is not allowed for this role.');
    });

    it('allows an advanced client search to use custom filters', () => {
        const service = new SearchAuthorizationService({ policies: [clientsPolicy] });
        const advancedQuery = {
            filter: [{ field: 'id', operator: 'ilike', value: '%', type: 'AND' }],
            relationship: [],
            limit: 100,
            offset: 0,
        };

        expect(service.authorize({ endpointKey: 'clients.Controller.search', user: advancedUser, query: advancedQuery })).toBe(
            advancedQuery
        );
    });
});
```

- [ ] **Step 2: Run regression test**

Run:

```bash
pnpm --filter @kace/api-common test -- --runTestsByPath tests/search-authorization/vulnerabilityRegression.test.js
```

Expected: PASS.

- [ ] **Step 3: Commit regression coverage**

```bash
git add packages/kace_cloud_api_common/tests/search-authorization/vulnerabilityRegression.test.js
git commit -m "test: cover search filter bypass regression"
```

---

## Task 9: Final verification and documentation update

**Files:**
- Modify: `docs/superpowers/specs/2026-04-30-search-authorization-design.md` only if implementation reveals a deliberate design adjustment.
- Create or modify: `docs/architecture/search-authorization.md` if the project uses architecture docs for shipped behavior.

- [ ] **Step 1: Run formatting**

Run:

```bash
pnpm prettier
```

Expected: staged files are formatted by the existing root script if files are staged; otherwise run package-level `format:check` commands below.

- [ ] **Step 2: Run backend tests**

Run:

```bash
pnpm --filter @kace/api-common test -- --runTestsByPath tests/search-authorization/SearchAuthorizationService.test.js tests/search-authorization/filterMatcher.test.js tests/search-authorization/relationshipMatcher.test.js tests/search-authorization/vulnerabilityRegression.test.js
pnpm --filter @kace/core tests -- --runTestsByPath tests/role/SearchPermissionsCatalog.test.js
pnpm search-auth:check
```

Expected: all PASS.

- [ ] **Step 3: Run frontend checks**

Run:

```bash
pnpm --filter kace-sass lint
pnpm --filter kace-sass test -- --runInBand RoleForm
```

Expected: lint passes. RoleForm tests pass if matching tests exist.

- [ ] **Step 4: Document follow-up tasks**

Create `docs/architecture/search-authorization.md`:

```md
# Search Authorization

Every `/search` endpoint must call `SearchAuthorizationService` after `SearchSchema` validation and before executing searchers or repositories.

Normal users must submit the endpoint's hardcoded base filters and base relationships, plus only allowlisted extra filters and relationships.

Users with the endpoint's `*SearchAdvanced` permission in the `search` role permission category may send any valid `SearchSchema` query.

Follow-up controls:

- Add audit logging for denied and unusually broad search attempts.
- Add rate limiting for repeated search requests.
```

- [ ] **Step 5: Commit docs and final verification state**

```bash
git add docs/architecture/search-authorization.md docs/superpowers/specs/2026-04-30-search-authorization-design.md
git commit -m "docs: describe search authorization enforcement"
```

---

## Self-Review Notes

- Spec coverage:
  - Shared service and policy registry: Tasks 1–2.
  - Role `search` category and UI: Tasks 3–4.
  - All-handler rollout: Tasks 5–7.
  - Error handling: Task 7.
  - Tests and coverage: Tasks 1, 2, 3, 5, 8, 9.
  - Audit/rate limiting follow-up: Task 9 docs.
- The only implementation-dependent values are the endpoint inventory and per-endpoint policy arrays. The plan resolves those through a required generated inventory plus coverage script, and it does not allow merge completion until every handler has policy and enforcement coverage.
- Use frequent commits at task boundaries to keep the big migration reviewable.
