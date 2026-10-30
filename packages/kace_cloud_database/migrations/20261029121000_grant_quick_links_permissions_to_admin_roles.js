/**
 * ONB-101. Agrega los permisos QuickLinks a roles administradores
 * existentes, sin modificar permisos previamente configurados.
 *
 * Los permisos para tenants nuevos se agregan por separado en
 * utils/RolePermisionList.js.
 */

const QUICK_LINKS_PERMISSIONS = Object.freeze([
    { name: 'QuickLinksRead', module_id: 'quick_links', description: 'Ver enlaces rápidos' },
    { name: 'QuickLinksCreate', module_id: 'quick_links', description: 'Crear enlace rápido' },
    { name: 'QuickLinksDelete', module_id: 'quick_links', description: 'Eliminar enlace rápido' },
]);

const permissionKey = (permission) => `${permission?.module_id}:${permission?.name}`;

const parsePermissions = (permisos) => {
    if (typeof permisos === 'string') {
        try {
            return JSON.parse(permisos);
        } catch {
            return null;
        }
    }

    return permisos && typeof permisos === 'object' ? permisos : null;
};

const hasAdministratorAccess = (administrador) =>
    administrador.some(
        (permission) =>
            permission?.module_id === 'access-admin' && permission?.name === 'Access' && permission?.granted === true
    );

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    const roles = await knex('roles').select('id', 'permisos');

    for (const role of roles) {
        const permissions = parsePermissions(role.permisos);
        const administrador = permissions?.administrador;

        if (!Array.isArray(administrador) || !hasAdministratorAccess(administrador)) {
            continue;
        }

        const stored = new Set(administrador.map(permissionKey));

        const missing = QUICK_LINKS_PERMISSIONS.filter((permission) => !stored.has(permissionKey(permission))).map(
            (permission) => ({ ...permission, granted: true })
        );

        if (missing.length === 0) {
            continue;
        }

        await knex('roles')
            .where({ id: role.id })
            .update({
                permisos: JSON.stringify({
                    ...permissions,
                    administrador: [...administrador, ...missing],
                }),
            });
    }
}

/**
 * Sin rollback: no se eliminan permisos porque podrían haber
 * sido configurados manualmente por el administrador.
 *
 * @returns { Promise<void> }
 */
export async function down() {}
