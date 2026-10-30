import { v4 as uuidv4 } from 'uuid';

const WORKSPACE_INBOX_ID = 'dbcc5b5a-61bb-4b5a-95d0-9f6222749e54';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    const tableName = 'workspaces';

    await knex(tableName).insert({
        id: WORKSPACE_INBOX_ID,
        description: 'INBOX',
        is_active: true,
        created_at: '2025-12-01 00:00:00',
        updated_at: '2025-12-01 00:00:00',
        deleted_at: null,
        created_by: uuidv4(),
        updated_by: null,
        deleted_by: null,
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    const tableName = 'workspaces';
    await knex(tableName).where('id', WORKSPACE_INBOX_ID).del();
}
