const RELATIONS_TABLE = 'workspaces_channel_hub_accounts_relations';
export const ONE_CHANNEL_HUB_ACCOUNT_PER_WORKSPACE_INDEX = 'workspaces_channel_hub_accounts_one_per_workspace_idx';

async function findDuplicateWorkspaceAssignments(knex) {
    return knex(RELATIONS_TABLE)
        .select('workspace_id')
        .count('* as channel_hub_account_count')
        .groupBy('workspace_id')
        .havingRaw('count(*) > 1');
}

export async function up(knex) {
    const duplicates = await findDuplicateWorkspaceAssignments(knex);

    if (duplicates.length > 0) {
        const formatted = duplicates.map((row) => `${row.workspace_id} (${row.channel_hub_account_count})`).join(', ');
        throw new Error(
            `Cannot enforce one Channel Hub account per Workspace. Clean up duplicate Channel Hub account assignments first: ${formatted}.`
        );
    }

    await knex.raw(
        `create unique index if not exists ${ONE_CHANNEL_HUB_ACCOUNT_PER_WORKSPACE_INDEX} on ${RELATIONS_TABLE} (workspace_id)`
    );
}

export async function down(knex) {
    await knex.raw(`drop index if exists ${ONE_CHANNEL_HUB_ACCOUNT_PER_WORKSPACE_INDEX}`);
}
