import { schemaQualifiedTable } from './schemaQualifiedTable.js';

/**
 * Restricts a writer-backed Knex query to active workspaces that belong to the
 * authenticated user's persisted active group.
 *
 * The caller must build `queryBuilder` from the writer connection. The scope is
 * intentionally derived only from `userId`, `activeGroupId`, and persisted
 * tenant data. Missing or invalid scope inputs produce no rows.
 *
 * @param {import('knex').Knex.QueryBuilder} queryBuilder
 * @param {object} scope
 * @param {string} scope.userId
 * @param {string} scope.activeGroupId
 * @param {string} [scope.workspaceIdColumn='workspaces.id'] outer query column correlated to the workspace
 * @param {string|null} [scope.schema=null]
 * @returns {import('knex').Knex.QueryBuilder}
 */
export function applyActiveGroupWorkspaceScope(
    queryBuilder,
    { userId, activeGroupId, workspaceIdColumn = 'workspaces.id', schema = null } = {}
) {
    if (!userId || !activeGroupId) {
        return queryBuilder.whereRaw('1 = 0');
    }

    return queryBuilder.whereExists(function () {
        this.select(1)
            .from(`${schemaQualifiedTable(schema, 'usuarios')} as active_scope_user`)
            .innerJoin(
                `${schemaQualifiedTable(schema, 'rel_usuarios_grupos')} as active_scope_membership`,
                'active_scope_membership.usuario_id',
                'active_scope_user.id'
            )
            .innerJoin(
                `${schemaQualifiedTable(schema, 'grupos')} as active_scope_group`,
                'active_scope_group.id',
                'active_scope_membership.grupo_id'
            )
            .innerJoin(
                `${schemaQualifiedTable(schema, 'workspaces_grupos_relations')} as active_scope_workspace_group`,
                'active_scope_workspace_group.grupo_id',
                'active_scope_group.id'
            )
            .innerJoin(
                `${schemaQualifiedTable(schema, 'workspaces')} as active_scope_workspace`,
                'active_scope_workspace.id',
                'active_scope_workspace_group.workspace_id'
            )
            .where('active_scope_user.id', userId)
            .where('active_scope_user.grupo_activo', activeGroupId)
            .where('active_scope_membership.grupo_id', activeGroupId)
            .where('active_scope_group.id', activeGroupId)
            .where('active_scope_group.status', 1)
            .whereNull('active_scope_group.deleted_at')
            .whereNull('active_scope_group.deleted_by')
            .where('active_scope_workspace.is_active', true)
            .whereNull('active_scope_workspace.deleted_at')
            .whereNull('active_scope_workspace.deleted_by')
            .whereColumn('active_scope_workspace.id', workspaceIdColumn);
    });
}
