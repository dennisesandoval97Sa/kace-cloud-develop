import { Helper } from '@kace/core/src/shared/index.js';
import { findDisallowedCapabilities } from './capabilityValidator.js';
import {
    findDisallowedFilters,
    findMissingBaseFilters,
    findMissingRequiredFilterGroups,
    flattenFilters,
} from './filterMatcher.js';
import { findDisallowedRelationships, findMissingBaseRelationships } from './relationshipMatcher.js';
import { SearchAuditLogger } from './SearchAuditLogger.js';
import { SearchAuthorizationError } from './SearchAuthorizationError.js';
import { getSearchPolicy, searchPolicies } from './SearchPolicyRegistry.js';

const CANONICAL_SEARCH_QUERY_FIELDS = new Set([
    'filter',
    'limit',
    'offset',
    'order',
    'relationship',
    'select',
    'distinct',
    'group_by',
    'having',
]);

export class SearchAuthorizationService {
    constructor({ policies = searchPolicies, auditLogger = new SearchAuditLogger() } = {}) {
        this.policies = policies;
        this.auditLogger = auditLogger;
    }

    authorize({ endpointKey, user, query }) {
        const policy = getSearchPolicy(endpointKey, this.policies);
        const userId = this.#userId(user);

        if (this.#hasPermission(user, policy.advancedPermission)) {
            this.auditLogger.logAuthorized({ endpointKey, userId, mode: 'advanced' });
            return query;
        }

        this.#assertNormalUserQueryIsAllowed(policy, query || {}, user, userId);
        this.auditLogger.logAuthorized({ endpointKey, userId, mode: 'restricted' });
        return query;
    }

    #userId(user) {
        return user?.id?.value ?? user?.id ?? null;
    }

    #hasPermission(user, permission) {
        if (!user || !permission) return false;
        if (permission.role && permission.role !== 'search' && typeof user.hasPermission === 'function') {
            return this.#permissionHelperReturnedTrue(() =>
                user.hasPermission(permission.role, permission.module_id, permission.name)
            );
        }
        if (typeof user.hasSearchPermission === 'function') {
            return this.#permissionHelperReturnedTrue(() =>
                user.hasSearchPermission(permission.module_id, permission.name)
            );
        }
        if (typeof user.hasPermission === 'function') {
            return this.#permissionHelperReturnedTrue(() =>
                user.hasPermission(permission.role || 'search', permission.module_id, permission.name)
            );
        }
        return false;
    }

    #permissionHelperReturnedTrue(callback) {
        try {
            return callback() === true;
        } catch {
            Helper.logInfo('Search authorization permission check failed closed');
            return false;
        }
    }

    #assertNormalUserQueryIsAllowed(policy, query, user, userId) {
        const disallowedCustomQueryFields = this.#findDisallowedCustomQueryFields(policy, query);
        if (disallowedCustomQueryFields.length > 0) {
            this.#deny(policy.endpointKey, 'disallowed_custom_query_fields', { disallowedCustomQueryFields }, userId);
        }

        const missingBaseFilters = findMissingBaseFilters(policy.baseFilter, query.filter || []);
        if (missingBaseFilters.length > 0) {
            this.#deny(policy.endpointKey, 'missing_base_filters', { missingBaseFilters }, userId);
        }

        const disallowedFilters = findDisallowedFilters(
            policy.baseFilter,
            query.filter || [],
            policy.allowedFilters || []
        );
        if (disallowedFilters.length > 0) {
            this.#deny(policy.endpointKey, 'disallowed_filters', { disallowedFilters }, userId);
        }

        const missingRequiredFilterGroups = findMissingRequiredFilterGroups(
            policy.requiredFilterGroups || [],
            query.filter || []
        );
        if (missingRequiredFilterGroups.length > 0) {
            this.#deny(policy.endpointKey, 'missing_required_filter_groups', { missingRequiredFilterGroups }, userId);
        }

        const missingBaseRelationships = findMissingBaseRelationships(
            policy.baseRelationships,
            query.relationship || []
        );
        if (missingBaseRelationships.length > 0) {
            this.#deny(policy.endpointKey, 'missing_base_relationships', { missingBaseRelationships }, userId);
        }

        const disallowedRelationships = findDisallowedRelationships(
            policy.baseRelationships,
            query.relationship || [],
            policy.allowedRelationships || []
        );
        if (disallowedRelationships.length > 0) {
            this.#deny(policy.endpointKey, 'disallowed_relationships', { disallowedRelationships }, userId);
        }

        this.#assertRequiredTablePermissionsAreMet(policy, query, user, userId);

        const disallowedCapabilities = findDisallowedCapabilities(query, policy.allowedCapabilities || {});
        if (disallowedCapabilities.length > 0) {
            this.#deny(policy.endpointKey, 'disallowed_capabilities', { disallowedCapabilities }, userId);
        }
    }

    #assertRequiredTablePermissionsAreMet(policy, query, user, userId) {
        const tablePermissions = policy.requiredTablePermissions;
        if (!tablePermissions) return;

        for (const [table, permissions] of Object.entries(tablePermissions)) {
            const list = Array.isArray(permissions) ? permissions : [permissions];
            if (list.some((permission) => this.#hasPermission(user, permission))) continue;

            const hasRelationship = query.relationship?.some((rel) => rel?.table === table);
            const hasFilter = flattenFilters(query.filter).some(
                (filter) => typeof filter?.field === 'string' && filter.field.startsWith(`${table}.`)
            );

            if (hasRelationship || hasFilter) {
                this.#deny(
                    policy.endpointKey,
                    hasRelationship ? 'disallowed_relationships' : 'disallowed_filters',
                    { table, reason: 'missing_table_permission' },
                    userId
                );
            }
        }
    }

    #findDisallowedCustomQueryFields(policy, query) {
        const allowedCustomQueryFields = new Set(policy.allowedCustomQueryFields || []);

        return Object.keys(query || {}).filter(
            (field) => !CANONICAL_SEARCH_QUERY_FIELDS.has(field) && !allowedCustomQueryFields.has(field)
        );
    }

    #deny(endpointKey, reason, details, userId) {
        this.auditLogger.logDenied({ endpointKey, userId, reason, details });
        throw new SearchAuthorizationError(endpointKey, reason, details);
    }
}
