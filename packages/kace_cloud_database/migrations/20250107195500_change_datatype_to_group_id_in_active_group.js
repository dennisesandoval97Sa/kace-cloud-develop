export async function up(knex) {
    await knex.schema.alterTable('usuarios', (table) => {
        table.string('grupo_activo', 36).nullable().alter();
    });

    await knex.schema.alterTable('usuarios', (table) => {
        table.foreign('grupo_activo').references('id').inTable('grupos').onDelete('SET NULL');
    });
}

export async function down(knex) {
    await knex.schema.alterTable('usuarios', (table) => {
        table.dropForeign('grupo_activo');
    });

    await knex.schema.alterTable('usuarios', (table) => {
        table.bigInteger('grupo_activo').nullable().alter();
    });
}
