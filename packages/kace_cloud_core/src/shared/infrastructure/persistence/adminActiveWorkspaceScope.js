import { schemaQualifiedTable } from './schemaQualifiedTable.js';

/**
 * Applies the mandatory workspace predicate for the ordinary Admin interaction
 * search route. Legacy interactions without a workspace remain eligible; a
 * non-null workspace reference qualifies only when the referenced workspace is
 * active.
 *
 * The correlated EXISTS deliberately avoids adding a join to the outer query,
 * so this predicate cannot multiply interaction rows or inflate the count.
 * Workspace soft-delete fields are intentionally outside this policy.
 *
 * @param {import('knex').Knex.QueryBuilder} queryBuilder
 * @param {object} [options]
 * @param {string} [options.workspaceIdColumn='interactions.workspace_id']
 * @param {string|null} [options.schema=null]
 * @returns {import('knex').Knex.QueryBuilder}
 */
export function applyAdminActiveWorkspaceScope(
    queryBuilder,
    { workspaceIdColumn = 'interactions.workspace_id', schema = null } = {}
) {
    return queryBuilder.where(function () {
        this.whereNull(workspaceIdColumn).orWhereExists(function () {
            this.select(1)
                .from(`${schemaQualifiedTable(schema, 'workspaces')} as admin_search_workspace`)
                .whereColumn('admin_search_workspace.id', workspaceIdColumn)
                .where('admin_search_workspace.is_active', true);
        });
    });
}
