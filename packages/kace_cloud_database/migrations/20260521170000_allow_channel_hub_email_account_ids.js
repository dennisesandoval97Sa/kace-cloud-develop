/**
 * Channel Hub inbound emails store the receiving account id in emails.account_id.
 * That account can now come from channel_hub_accounts instead of mail_accounts,
 * so account_id must be an unconstrained provider account reference.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    if (knex.client.config.client?.includes('sqlite')) {
        return;
    }

    await knex.raw(`
        DO $$
        DECLARE
            constraint_record record;
        BEGIN
            FOR constraint_record IN
                SELECT
                    tc.table_schema,
                    tc.constraint_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                    AND tc.table_name = kcu.table_name
                WHERE tc.constraint_type = 'FOREIGN KEY'
                    AND tc.table_schema = current_schema()
                    AND tc.table_name = 'emails'
                    AND kcu.column_name = 'account_id'
            LOOP
                EXECUTE format(
                    'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
                    constraint_record.table_schema,
                    'emails',
                    constraint_record.constraint_name
                );
            END LOOP;
        END $$;
    `);
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(_knex) {
    // Intentionally no-op: once Channel Hub inbound emails are stored, account_id
    // can reference channel_hub_accounts ids, so restoring the mail_accounts-only
    // foreign key could fail or corrupt the mixed-account model.
}
