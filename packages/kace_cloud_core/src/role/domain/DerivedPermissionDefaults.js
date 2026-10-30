const key = (role, moduleId, name) => `${role}:${moduleId}:${name}`;

/**
 * Permissions that, when a role has no stored value, inherit `granted` from a source permission.
 * Target key -> source { role, module_id, name }.
 *
 * Inheritance rule:
 * - Dynamic while the target is not stored: it follows its source on every read.
 * - Frozen once the role is persisted: formatPermissionsWithAdminSearchDefaults writes the inherited
 *   value, so later changes to the source do not propagate to the target.
 * - A stored value always wins over inheritance.
 */
const DERIVED_PERMISSIONS = new Map([
    [key('administrador', 'cases', 'CasesBulkClose'), { role: 'administrador', module_id: 'cases', name: 'CaseClose' }],
    [key('administrador', 'cases', 'CasesBulkTransition'), { role: 'agente', module_id: 'cases', name: 'CasesUpdate' }],
    [
        key('administrador', 'cases', 'CasesBulkAssign'),
        { role: 'administrador', module_id: 'user-cases-assigment', name: 'UserCasesAssigmentCreate' },
    ],
]);

export const resolveInheritedGranted = (role, permission, storedPermissions) => {
    const source = DERIVED_PERMISSIONS.get(key(role, permission.module_id, permission.name));
    if (!source) return undefined;

    const stored = storedPermissions?.[source.role]?.find(
        (p) => p.module_id === source.module_id && p.name === source.name
    );
    return stored ? stored.granted === true : undefined;
};
