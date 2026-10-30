export function up(knex) {
    return knex.schema
        .alterTable('plantillas', (table) => {
            table.timestamp('deleted_at').alter().defaultTo(null);
        })
        .alterTable('flujos', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
            table.timestamp('updated_at').alter().defaultTo(null);
        })
        .alterTable('transiciones', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
            table.timestamp('updated_at').alter().defaultTo(null);
        })
        .alterTable('grupos', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
            table.timestamp('updated_at').alter().defaultTo(null);
        })
        .alterTable('roles', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
            table.timestamp('updated_at').alter().defaultTo(null);
        })
        .alterTable('descripciones_casos', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
            table.timestamp('updated_at').alter().defaultTo(null);
        })
        .alterTable('descripciones_casos', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
            table.timestamp('updated_at').alter().defaultTo(null);
        })
        .alterTable('app_config', (table) => {
            table.smallint('status').alter().defaultTo(null);
            table.timestamp('created_at').alter().defaultTo(null);
            table.timestamp('updated_at').alter().defaultTo(null);
        })
        .alterTable('global_rules', (table) => {
            // SONAR-EXC: Esta funcion y la que esta inmediatamente anterior son similares pero cumplen funciones diferentes (no es una funcion duplicada)
            table.smallint('status').alter().defaultTo(null);
            table.timestamp('created_at').alter().defaultTo(null);
            table.timestamp('updated_at').alter().defaultTo(null);
        })
        .alterTable('rel_usuarios_grupos_history', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
            table.timestamp('updated_at').alter().defaultTo(null);
        })
        .alterTable('boveda_secretos', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
            table.timestamp('updated_at').alter().defaultTo(null);
        })
        .alterTable('history_action_model_updates', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_actions', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_allowed_connections', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_ans', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_aux_casos', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_aux_clientes', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_banners', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_boveda_secretos', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_case_attachments', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_clasificaciones', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_client_notifications', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_clientes', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_comentarios', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_descripciones_casos', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_estados', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_flujos', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_global_configurations', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_grupos', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_helps_attachments', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_helps', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_lista_grupos', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_lista_usuarios', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_literales', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_mail_accounts', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_one-script', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_plantillas', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_policies', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_roles', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_s3_files', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_shift_management', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_template_attachments', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_transiciones', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_user_notifications', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_usuarios', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_ws_rest_endpoints', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        })
        .alterTable('history_ws_rest_flows', (table) => {
            table.timestamp('created_at').alter().defaultTo(null);
        });
}

export function down(knex) {
    return knex.schema
        .alterTable('plantillas', (table) => {
            table.timestamp('deleted_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('flujos', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
            table.timestamp('updated_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('transiciones', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
            table.timestamp('updated_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('grupos', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
            table.timestamp('updated_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('roles', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
            table.timestamp('updated_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('descripciones_casos', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
            table.timestamp('updated_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('descripciones_casos', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
            table.timestamp('updated_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('app_config', (table) => {
            table.smallint('status').alter().defaultTo(1);
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
            table.timestamp('updated_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('global_rules', (table) => {
            // SONAR-EXC: Esta funcion y la que esta inmediatamente anterior son similares pero cumplen funciones diferentes (no es una funcion duplicada)
            table.smallint('status').alter().defaultTo(1);
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
            table.timestamp('updated_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('rel_usuarios_grupos_history', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
            table.timestamp('updated_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('boveda_secretos', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
            table.timestamp('updated_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_action_model_updates', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_actions', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_allowed_connections', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_ans', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_aux_casos', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_aux_clientes', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_banners', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_boveda_secretos', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_case_attachments', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_clasificaciones', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_client_notifications', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_clientes', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_comentarios', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_descripciones_casos', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_estados', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_flujos', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_global_configurations', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_grupos', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_helps_attachments', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_helps', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_lista_grupos', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_lista_usuarios', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_literales', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_mail_accounts', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_one-script', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_plantillas', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_policies', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_roles', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_s3_files', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_shift_management', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_template_attachments', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_transiciones', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_user_notifications', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_usuarios', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_ws_rest_endpoints', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        })
        .alterTable('history_ws_rest_flows', (table) => {
            table.timestamp('created_at').alter().defaultTo(knex.fn.now());
        });
}
