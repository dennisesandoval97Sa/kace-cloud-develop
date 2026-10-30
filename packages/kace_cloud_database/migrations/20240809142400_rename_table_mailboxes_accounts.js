/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.renameTable('mailboxes_accounts', 'mail_accounts');
}

export function down(knex) {
    return knex.schema.renameTable('mail_accounts', 'mailboxes_accounts');
}
