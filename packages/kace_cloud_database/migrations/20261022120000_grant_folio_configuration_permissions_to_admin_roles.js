/**
 * KACE-009. Los permisos `FolioConfigurations*` se agregaron a utils/RolePermisionList.js,
 * que es semilla y solo alcanza a tenants nuevos: en los existentes el administrador
 * recibiría 403 en todo el servicio folio-configurations.
 *
 * Mismo criterio que 20261013120000_grant_broker_permissions_to_admin_roles: se conceden
 * (`granted: true`) solo a los roles que tienen concedido `access-admin:Access`, y solo si
 * el rol aún no guarda esa entrada: un valor ya guardado (p. ej. denegado desde la UI de
 * roles) se respeta. El resto de roles no se toca; al cargarlos, los permisos faltantes se
 * rellenan con `granted: false`.
 */

const FOLIO_PERMISSIONS = Object.freeze([
    {
        name: 'FolioConfigurationsCreate',
        module_id: 'folio-configurations',
        description: 'Crear configuración de folio',
    },
    {
        name: 'FolioConfigurationsUpdate',
        module_id: 'folio-configurations',
        description: 'Actualizar configuración de folio',
    },
    {
        name: 'FolioConfigurationsDelete',
        module_id: 'folio-configurations',
        description: 'Eliminar configuración de folio',
    },
    { name: 'FolioConfigurationsRead', module_id: 'folio-configurations', description: 'Ver configuraciones de folio' },
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
        const missing = FOLIO_PERMISSIONS.filter((permission) => !stored.has(permissionKey(permission))).map(
            (permission) => ({ ...permission, granted: true })
        );

        if (missing.length === 0) {
            continue;
        }

        await knex('roles')
            .where({ id: role.id })
            .update({ permisos: JSON.stringify({ ...permissions, administrador: [...administrador, ...missing] }) });
    }
}

/**
 * Sin rollback: un permiso concedido por `up()` no se distingue de uno concedido desde
 * la UI de roles, así que retirarlo podría revocar en silencio un acceso que el
 * administrador del tenant sí decidió.
 *
 * @returns { Promise<void> }
 */
export async function down() {}
