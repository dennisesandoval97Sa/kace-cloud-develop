/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    const isSQLite = knex.client.config.client === 'sqlite3';

    if (isSQLite) {
        const foreignKeys = await knex.raw(`PRAGMA foreign_key_list(interaction_casos)`);
        const constraintExists = foreignKeys.some((fk) => fk.table === 'interactions' && fk.from === 'interaction_id');

        if (!constraintExists) {
            return knex.schema.alterTable('interaction_casos', function (table) {
                table.foreign('interaction_id').references('id').inTable('interactions');
            });
        }
    } else {
        const hasConstraint = await knex.raw(`
            SELECT COUNT(*) as count
            FROM pg_constraint
            WHERE conname = 'interaction_casos_interaction_id_foreign'
            AND conrelid = 'interaction_casos'::regclass
        `);

        const constraintExists = parseInt(hasConstraint.rows[0].count) > 0;

        if (!constraintExists) {
            return knex.schema.alterTable('interaction_casos', function (table) {
                table.foreign('interaction_id').references('id').inTable('interactions');
            });
        }
    }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    const isSQLite = knex.client.config.client === 'sqlite3';

    if (isSQLite) {
        const foreignKeys = await knex.raw(`PRAGMA foreign_key_list(interaction_casos)`);
        const constraintExists = foreignKeys.some((fk) => fk.table === 'interactions' && fk.from === 'interaction_id');

        if (constraintExists) {
            return knex.schema.alterTable('interaction_casos', function (table) {
                table.dropForeign('interaction_id');
            });
        }
    } else {
        const hasConstraint = await knex.raw(`
            SELECT COUNT(*) as count
            FROM pg_constraint
            WHERE conname = 'interaction_casos_interaction_id_foreign'
            AND conrelid = 'interaction_casos'::regclass
        `);

        if (parseInt(hasConstraint.rows[0].count) > 0) {
            return knex.schema.alterTable('interaction_casos', function (table) {
                table.dropForeign('interaction_id');
            });
        }
    }
}
