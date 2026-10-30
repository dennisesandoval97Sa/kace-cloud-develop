const INVALID_MODULE_ID = '"ws-hook-rest-flows';
const VALID_MODULE_ID = 'ws-hook-rest-flows';

const normalizePermissionModuleIds = (permissions, fromModuleId, toModuleId) => {
    const parsedPermissions = typeof permissions === 'string' ? JSON.parse(permissions) : permissions;

    if (!parsedPermissions || typeof parsedPermissions !== 'object') {
        return { permissions: parsedPermissions, changed: false };
    }

    let changed = false;
    const normalizedPermissions = {};

    for (const [role, rolePermissions] of Object.entries(parsedPermissions)) {
        if (!Array.isArray(rolePermissions)) {
            normalizedPermissions[role] = rolePermissions;
            continue;
        }

        normalizedPermissions[role] = rolePermissions.map((permission) => {
            if (permission?.module_id !== fromModuleId) {
                return permission;
            }

            changed = true;
            return { ...permission, module_id: toModuleId };
        });
    }

    return { permissions: normalizedPermissions, changed };
};

const updateRolePermissions = async (knex, fromModuleId, toModuleId) => {
    const roles = await knex('roles').select('id', 'permisos');

    for (const role of roles) {
        const { permissions, changed } = normalizePermissionModuleIds(role.permisos, fromModuleId, toModuleId);

        if (changed) {
            await knex('roles').where({ id: role.id }).update({ permisos: permissions });
        }
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await updateRolePermissions(knex, INVALID_MODULE_ID, VALID_MODULE_ID);
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await updateRolePermissions(knex, VALID_MODULE_ID, INVALID_MODULE_ID);
}
