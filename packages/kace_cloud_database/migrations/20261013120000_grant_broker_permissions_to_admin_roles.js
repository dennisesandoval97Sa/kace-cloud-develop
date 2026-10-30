/**
 * KTSS-3580. Los permisos `BrokerAdapters*` / `BrokerMappers*` se agregaron a
 * utils/RolePermisionList.js, que es semilla y solo alcanza a tenants nuevos.
 *
 * En los roles ya creados se conceden (`granted: true`) solo a los que tienen
 * concedido `access-admin:Access` — el mismo criterio que `hasAdministratorAccess`
 * en @kace/core —, y solo si el rol aún no guarda esa entrada: un valor ya
 * guardado (p. ej. denegado desde la UI de roles) se respeta. El resto de roles
 * no se toca; al cargarlos, los permisos faltantes se rellenan con `granted: false`.
 */

const BROKER_PERMISSIONS = Object.freeze([
    { name: 'BrokerAdaptersCreate', module_id: 'broker_adapters', description: 'Crear adaptador' },
    { name: 'BrokerAdaptersUpdate', module_id: 'broker_adapters', description: 'Actualizar adaptador' },
    { name: 'BrokerAdaptersDelete', module_id: 'broker_adapters', description: 'Eliminar adaptador' },
    { name: 'BrokerAdaptersRead', module_id: 'broker_adapters', description: 'Ver adaptador' },
    { name: 'BrokerMappersCreate', module_id: 'broker_mappers', description: 'Crear mapa' },
    { name: 'BrokerMappersUpdate', module_id: 'broker_mappers', description: 'Actualizar mapa' },
    { name: 'BrokerMappersDelete', module_id: 'broker_mappers', description: 'Eliminar mapa' },
    { name: 'BrokerMappersRead', module_id: 'broker_mappers', description: 'Ver mapa' },
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
        const missing = BROKER_PERMISSIONS.filter((permission) => !stored.has(permissionKey(permission))).map(
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
