/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('mailboxes_accounts', function (table) {
        table.string('id', 36).primary();
        table.string('description', 120);
        table.string('type', 20);
        table.string('host', 255);
        table.integer('port', 50);
        table.string('protocol', 50);
        table.string('encryption', 50);
        table.string('username', 255);
        table.string('password', 1000);
        table.string('from_address', 1500);
        table.string('from_name', 250);
        table.string('tenant_id', 1000);
        table.string('client_id', 1000);
        table.text('client_secret');
        table.string('code', 1000);
        table.text('refresh_token');
        table.integer('mails_download_limit');
        table.string('login_endpoint', 255);
        table.string('graph_scope', 255);
        table.timestamp('start_syncing_from');
        table.timestamp('last_synchronization');
        table.json('folders');
        table.text('access_token');
        table.string('email_account', 1500);
        table.boolean('vault');
        table.json('vault_data');
        table.integer('status');
        table.timestamp('created_at');
        table.timestamp('updated_at');
        table.timestamp('deleted_at');
        table.string('created_by', 36);
        table.string('updated_by', 36);
        table.string('deleted_by', 36);
    });
}

export function down(knex) {
    return knex.schema.dropTable('mailboxes_accounts');
}
