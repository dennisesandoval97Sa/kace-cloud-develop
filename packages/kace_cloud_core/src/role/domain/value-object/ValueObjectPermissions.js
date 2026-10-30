import { ListPermissions } from '../ListPermissions';
import { Helper, InvalidArgumentError } from '../../../shared/index.js';
import { resolveInheritedGranted } from '../DerivedPermissionDefaults.js';

const ADMINISTRATOR_ROLE = 'administrador';
const SEARCH_ROLE = 'search';
const ADMIN_ACCESS_MODULE_ID = 'access-admin';
const ACCESS_PERMISSION_NAME = 'Access';

const permissionKey = (permission) => `${permission.module_id}:${permission.name}`;

export const hasAdministratorAccess = (permissions) =>
    Boolean(
        permissions?.[ADMINISTRATOR_ROLE]?.some(
            (permission) =>
                permission.module_id === ADMIN_ACCESS_MODULE_ID &&
                permission.name === ACCESS_PERMISSION_NAME &&
                permission.granted === true
        )
    );

const applyMissingPermissionDefault = (role, permission, adminSearchDefaultsGranted, storedPermissions) => {
    const inheritedGranted = resolveInheritedGranted(role, permission, storedPermissions);
    if (inheritedGranted !== undefined) {
        return { ...permission, granted: inheritedGranted };
    }
    return role === SEARCH_ROLE && adminSearchDefaultsGranted ? { ...permission, granted: true } : permission;
};

export const formatPermissionsWithAdminSearchDefaults = (permissions, referencePermissions) => {
    const formattedPermissions = {};
    const adminSearchDefaultsGranted = hasAdministratorAccess(permissions);

    for (const [role, refPermissions] of Object.entries(referencePermissions)) {
        const receivedPermissions = permissions[role] || [];

        const receivedPermissionsMap = new Map();
        receivedPermissions.forEach((perm) => {
            const key = permissionKey(perm);
            if (!receivedPermissionsMap.has(key)) {
                receivedPermissionsMap.set(key, perm);
            }
        });

        formattedPermissions[role] = refPermissions.map((refPerm) => {
            const refPermPrimitives = refPerm.toPrimitives();
            const receivedPerm = receivedPermissionsMap.get(permissionKey(refPermPrimitives));

            return receivedPerm
                ? { ...refPermPrimitives, granted: receivedPerm.granted }
                : applyMissingPermissionDefault(role, refPermPrimitives, adminSearchDefaultsGranted, permissions);
        });
    }

    return {
        ...formattedPermissions,
        auxiliaries: permissions.auxiliaries ?? formattedPermissions.auxiliaries ?? [],
    };
};

export const backfillPermissionsWithAdminSearchDefaults = (permissions, referencePermissions) => {
    const adminSearchDefaultsGranted = hasAdministratorAccess(permissions);
    const updatedPermissions = { ...permissions };

    for (const [role, rolePermissions] of Object.entries(referencePermissions)) {
        const existingPermissions = updatedPermissions[role] || [];
        const existingPermissionKeys = new Set(existingPermissions.map(permissionKey));
        const missingPermissions = rolePermissions
            .filter((permission) => !existingPermissionKeys.has(permissionKey(permission)))
            .map((permission) =>
                applyMissingPermissionDefault(role, permission, adminSearchDefaultsGranted, permissions)
            );

        updatedPermissions[role] = [...existingPermissions, ...missingPermissions];
    }

    return updatedPermissions;
};

export class ValueObjectPermissions {
    static #_listPermissions;
    static get LIST_PERMISSIONS() {
        if (!ValueObjectPermissions.#_listPermissions) {
            ValueObjectPermissions.#_listPermissions = new ListPermissions();
        }
        return ValueObjectPermissions.#_listPermissions;
    }
    /** @type {Object} is initialized in the constructor */
    #value;
    /** @type {ListPermissions} is initialized in the constructor */
    #listPermissions;
    constructor(permissions, nullable = false) {
        this.field = 'permisos';
        if (!permissions && !nullable) {
            Helper.logError(`${this.field}: The value cannot be null`);
            throw new Error(`${this.field}: The value cannot be null`);
        }
        if (!permissions && nullable) {
            return;
        }

        this.#listPermissions = ValueObjectPermissions.LIST_PERMISSIONS;
        this.#value = permissions;
        this.#ensureValueIsValid();
    }

    #ensureValueIsValid() {
        if (typeof this.#value !== 'object' || this.#value === null) {
            Helper.logError('Value must be an object');
            throw new InvalidArgumentError('Value must be an object');
        }

        Object.entries(this.#value).forEach(([key, permissions]) => {
            if (!Array.isArray(permissions)) {
                Helper.logError('Each permission value must be an array');
                throw new InvalidArgumentError('Each permission value must be an array');
            }

            permissions.forEach((permission) => {
                if (!this.#listPermissions.isValidPermissions(permission, key)) {
                    Helper.logError(`Invalid permission: ${permission.name}`);
                    throw new InvalidArgumentError(`Invalid permission: ${permission.name}`);
                }
            });
        });
    }

    get value() {
        if (!this.#value) {
            return null;
        }

        return JSON.stringify(formatPermissionsWithAdminSearchDefaults(this.#value, this.#listPermissions.permissions));
    }

    /**
     * Method to validate if a specific permission exists in a role and module.
     * @param {string} role - The role (e.g., "admin", "agent").
     * @param {string} moduleId - The module ID (e.g., "ans").
     * @param {string} permissionName - The permission name (e.g., "AnsCreate").
     * @returns {boolean} - Returns true if the permission exists and is granted, false otherwise.
     */
    hasPermission(role, moduleId, permissionName) {
        if (!this.#value[role]) {
            throw new InvalidArgumentError(`ValueObjectPermissions: Role '${role}' not found`);
        }

        const permission = this.#findPermission(role, moduleId, permissionName);
        if (permission) {
            return Boolean(permission.granted);
        }

        return resolveInheritedGranted(role, { module_id: moduleId, name: permissionName }, this.#value) === true;
    }

    hasSearchPermission(moduleId, permissionName) {
        const permission = this.#findPermission(SEARCH_ROLE, moduleId, permissionName);

        if (permission) {
            return permission.granted === true;
        }

        return hasAdministratorAccess(this.#value);
    }

    #findPermission(role, moduleId, permissionName) {
        return this.#value[role]?.find((p) => p.name === permissionName && p.module_id === moduleId);
    }
}
