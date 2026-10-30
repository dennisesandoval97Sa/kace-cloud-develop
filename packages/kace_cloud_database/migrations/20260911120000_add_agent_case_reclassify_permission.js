/**
 * MSKT-1392 (F0-3c). `CaseReclassify` existía solo en el namespace
 * `administrador`. Al habilitarlo también para `agente` en
 * utils/RolePermisionList.js y en ListPermissions.js, los tenants existentes
 * quedan fuera: esos catálogos son semilla y solo alcanzan a tenants nuevos.
 *
 * Esta migración inserta el permiso en el namespace `agente` de los roles ya
 * creados **siempre con `granted: false`**: nadie gana la capacidad de
 * reclasificar por efecto de la migración; queda visible y asignable por rol
 * desde la UI de roles. El namespace `administrador` no se toca.
 */

const PERMISSION = Object.freeze({
    name: 'CaseReclassify',
    granted: false,
    module_id: 'cases',
    description: 'Reclasificar caso',
});

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

const updateRoles = async (knex, mutate) => {
    const roles = await knex('roles').select('id', 'permisos');

    for (const role of roles) {
        const permissions = parsePermissions(role.permisos);

        if (!permissions || !Array.isArray(permissions.agente)) {
            continue;
        }

        const agente = mutate(permissions.agente);

        if (agente === permissions.agente) {
            continue;
        }

        await knex('roles')
            .where({ id: role.id })
            .update({ permisos: JSON.stringify({ ...permissions, agente }) });
    }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await updateRoles(knex, (agente) =>
        agente.some((permission) => permission?.name === PERMISSION.name) ? agente : [...agente, { ...PERMISSION }]
    );
}

/**
 * Solo retira la entrada que esta misma migración pudo haber creado: si sigue en
 * `granted: false` (el estado en que `up()` la deja), se elimina. Si algún administrador la
 * otorgó desde la UI de roles después de la migración, `granted` ya es `true` y la entrada se
 * conserva — un rollback no debe revocar en silencio una decisión de negocio que él mismo no
 * tomó, y volver a aplicar `up()` no la recuperaría (reinserta con `granted: false`).
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await updateRoles(knex, (agente) => {
        const filtered = agente.filter(
            (permission) => !(permission?.name === PERMISSION.name && permission?.granted !== true)
        );
        return filtered.length === agente.length ? agente : filtered;
    });
}
