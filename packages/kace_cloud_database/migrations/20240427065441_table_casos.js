/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('casos', function (table) {
        table.string('id', 36).primary();
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

        table.foreign('cliente_id').references('id').inTable('clientes');
        table.foreign('transicion_id').references('id').inTable('transiciones');
        table.foreign('responsable_id').references('id').inTable('usuarios');
        table.foreign('clasificacion_id').references('id').inTable('clasificaciones');
        table.foreign('descripcion_caso_id').references('id').inTable('descripciones_casos');
        table.foreign('grupo_id').references('id').inTable('grupos');
        table.foreign('caso_clonado_id').references('id').inTable('casos');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('casos');
}
