/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return Promise.all([
        knex.schema
            .table('historial_casos', (table) => {
                table.renameColumn('caso_id', 'entity_id');
            })
            .then(() => {
                return knex.schema.renameTable('historial_casos', 'history_casos');
            }),

        createHistoryTable(knex, 'history_action_model_updates'),
        createHistoryTable(knex, 'history_actions'),
        createHistoryTable(knex, 'history_allowed_connections'),
        createHistoryTable(knex, 'history_ans'),
        createHistoryTable(knex, 'history_aux_casos'),
        createHistoryTable(knex, 'history_aux_clientes'),
        createHistoryTable(knex, 'history_banners'),
        createHistoryTable(knex, 'history_boveda_secretos'),
        createHistoryTable(knex, 'history_case_attachments'),
        createHistoryTable(knex, 'history_clasificaciones'),
        createHistoryTable(knex, 'history_client_notifications'),
        createHistoryTable(knex, 'history_clientes'),
        createHistoryTable(knex, 'history_comentarios'),
        createHistoryTable(knex, 'history_descripciones_casos'),
        createHistoryTable(knex, 'history_estados'),
        createHistoryTable(knex, 'history_flujos'),
        createHistoryTable(knex, 'history_global_configurations'),
        createHistoryTable(knex, 'history_grupos'),
        createHistoryTable(knex, 'history_helps_attachments'),
        createHistoryTable(knex, 'history_helps'),
        createHistoryTable(knex, 'history_lista_grupos'),
        createHistoryTable(knex, 'history_lista_usuarios'),
        createHistoryTable(knex, 'history_literales'),
        createHistoryTable(knex, 'history_mail_accounts'),
        createHistoryTable(knex, 'history_one-script'),
        createHistoryTable(knex, 'history_plantillas'),
        createHistoryTable(knex, 'history_policies'),
        createHistoryTable(knex, 'history_roles'),
        createHistoryTable(knex, 'history_s3_files'),
        createHistoryTable(knex, 'history_shift_management'),
        createHistoryTable(knex, 'history_template_attachments'),
        createHistoryTable(knex, 'history_transiciones'),
        createHistoryTable(knex, 'history_user_notifications'),
        createHistoryTable(knex, 'history_usuarios'),
        createHistoryTable(knex, 'history_ws_rest_endpoints'),
        createHistoryTable(knex, 'history_ws_rest_flows'),
    ]);
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema
        .dropTableIfExists('history_action_model_updates')
        .dropTableIfExists('history_actions')
        .dropTableIfExists('history_allowed_connections')
        .dropTableIfExists('history_ans')
        .dropTableIfExists('history_aux_casos')
        .dropTableIfExists('history_aux_clientes')
        .dropTableIfExists('history_banners')
        .dropTableIfExists('history_boveda_secretos')
        .dropTableIfExists('history_case_attachments')
        .dropTableIfExists('history_clasificaciones')
        .dropTableIfExists('history_client_notifications')
        .dropTableIfExists('history_clientes')
        .dropTableIfExists('history_comentarios')
        .dropTableIfExists('history_descripciones_casos')
        .dropTableIfExists('history_estados')
        .dropTableIfExists('history_flujos')
        .dropTableIfExists('history_global_configurations')
        .dropTableIfExists('history_grupos')
        .dropTableIfExists('history_helps_attachments')
        .dropTableIfExists('history_helps')
        .dropTableIfExists('history_lista_grupos')
        .dropTableIfExists('history_lista_usuarios')
        .dropTableIfExists('history_literales')
        .dropTableIfExists('history_mail_accounts')
        .dropTableIfExists('history_one-script')
        .dropTableIfExists('history_plantillas')
        .dropTableIfExists('history_policies')
        .dropTableIfExists('history_roles')
        .dropTableIfExists('history_s3_files')
        .dropTableIfExists('history_shift_management')
        .dropTableIfExists('history_template_attachments')
        .dropTableIfExists('history_transiciones')
        .dropTableIfExists('history_user_notifications')
        .dropTableIfExists('history_usuarios')
        .dropTableIfExists('history_ws_rest_endpoints')
        .dropTableIfExists('history_ws_rest_flows')
        .renameTable('history_casos', 'historial_casos')
        .then(() => {
            return knex.schema.table('historial_casos', (table) => {
                table.renameColumn('entity_id', 'caso_id');
            });
        });
}

/**
 * Crea las tablas de historial para diferentes entidades.
 * @param {import("knex").Knex} knex
 * @param {string} tableName
 * @param {string} refTable
 * @returns {Promise<void>}
 */
function createHistoryTable(knex, tableName) {
    return knex.schema.createTable(tableName, (table) => {
        table.string('id', 36).primary();
        table.string('entity_id', 36).notNullable();
        table.jsonb('changed_attributes');
        table.jsonb('new_attributes');
        table.jsonb('original_attributes');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.string('created_by', 36);
    });
}
