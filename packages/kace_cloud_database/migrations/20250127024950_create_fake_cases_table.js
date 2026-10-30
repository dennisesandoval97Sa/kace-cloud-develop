/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    return knex.schema.createTable('fake_cases', function (table) {
        table.string('id', 36).notNullable().primary();
        table.string('cliente_id', 36);
        table.string('transicion_id', 36);
        table.string('responsable_id', 36);
        table.string('clasificacion_id', 36);
        table.string('descripcion_caso_id', 36);
        table.string('cambio_estado_comentario_id', 36);
        table.string('caso_clonado_id', 36);
        table.bigInteger('mail_item_id');
        table.bigInteger('canal_id');
        table.string('grupo_id', 36);
        table.timestamp('fecha_resolucion');
        table.string('antiguedad', 100);
        table.smallint('ans_posicion');
        table.integer('antiguedad_dias');
        table.integer('antiguedad_horas');
        table.integer('antiguedad_minutos');
        table.string('motivo_baja', 50);
        table.smallint('alto_impacto');
        table.string('vista', 100);
        table.timestamp('created_at');
        table.timestamp('updated_at');
        table.string('created_by', 36);
        table.string('updated_by', 36);
        table.timestamp('deleted_at');
        table.string('deleted_by', 36);
        table.timestamp('expired_at');
        table.string('remaining_time', 255);
        table.boolean('cambio_clasificacion');
        table.string('cloned_by', 36);
        table.timestamp('cloned_at');
        table.string('reopen_by', 36);
        table.timestamp('reopen_at');
        table.timestamp('closed_at');
        table.string('closed_by', 36);
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    return knex.schema.dropTableIfExists('fake_cases');
}
