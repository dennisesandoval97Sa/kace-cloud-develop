const validLayoutsBase = () => ({
    application: {
        admin: {
            cases: {
                enable_custom_view: true,
                custom_view_name: 'view_case_details',
                cases_admin_refresh_min: '1',
                visible_columns: [],
            },
            clients: {
                sexo: 'Género',
                email: 'Correo electrónico',
                nombres: 'Nombres',
                telefono: 'Teléfono',
                apellido1: 'Primer apellido',
                apellido2: 'Segundo apellido',
                documento: 'Documento',
                reference: 'Por numero de caso',
                habeas_data: 'Habeas data',
                estado_civil: 'Estado civil',
                email_alterno: 'Correo electrónico alternativo',
                nombre_empresa: 'Nombre de la empresa',
                tipo_documento: 'Tipo de documento',
                fecha_nacimiento: 'Fecha de nacimiento',
                telefono_alterno: 'Teléfono alternativo',
            },
            classifications: {
                label_1: 'Nivel 1',
                label_2: 'Nivel 2',
                label_3: 'Nivel 3',
                label_4: 'Nivel 4',
                label_5: 'Nivel 5',
                label_6: 'Nivel 6',
                label_7: 'Nivel 7',
                label_8: 'Nivel 8',
                label_9: 'Nivel 9',
                label_10: 'Nivel 10',
            },
        },
        agente: {
            agent: {
                my_cases: true,
                show_boards: true,
                enable_custom_view: true,
                show_my_created_cases: true,
                show_my_assigned_cases: true,
            },
            cases: {
                express_cases: [],
                show_event_log: true,
                show_attachments: true,
                show_description: true,
                account_to_send_link: '',
                template_to_send_link: '',
                allow_client_send_attachments: true,
                show_notifications: false,
                notifications_one_script_form: '',
                refresh_tab_notifications: false,
            },
            header: {
                helps: true,
                custom_logo: '',
                search_clients: true,
                high_impact_fields: true,
                total_cases_by_ans: true,
                my_agenda: true,
            },
            clients: {
                fields: {
                    field_nombres: true,
                    field_documento: true,
                    field_tipo_documento: true,
                },
                habeasData: true,
                open_cases: true,
                client_data: true,
                close_cases: true,
                fields_copy: {},
                fields_edit: {
                    field_nombres_edit: true,
                    field_documento_edit: true,
                    field_tipo_documento_edit: true,
                },
                custom_form_id: '',
                fields_max_min: {},
                fields_required: {
                    field_nombres_required: true,
                    field_documento_required: true,
                    field_tipo_documento_required: true,
                },
                content_habeas_data: 'contenido par el habeas',
                get_list_field_to_show: true,
                show_aux_client_expanded: false,
                hide_client_form: false,
            },
            calendar: { oneScript_calendar: '' },
            search_clients: {
                sexo_bool: false,
                email_bool: false,
                nombres_bool: true,
                telefono_bool: false,
                apellido1_bool: false,
                apellido2_bool: false,
                documento_bool: true,
                reference_bool: true,
                estado_civil_bool: false,
                email_alterno_bool: false,
                nombre_empresa_bool: false,
                tipo_documento_bool: false,
                fecha_nacimiento_bool: false,
                telefono_alterno_bool: false,
            },
        },
    },
});

const validBehaviorsBase = () => ({
    application: {
        admin: {
            users: {
                inactivity_time: 30,
                oneScript_users: '',
                users_schema_id: '',
                warning_logout_time: 5,
                active_session_limit: 3,
            },
            groups: {
                groups_schema_id: '',
                oneScript_groups: '',
            },
        },
        agente: {
            casos: {
                order_type: 'asc',
                folio_length: 4,
                assign_strategy: 'case_ans',
                work_queue_sorting_rules: [
                    {
                        assign_strategy: 'sla_due_date',
                        order_type: 'asc',
                        cast_type: 'date',
                    },
                ],
                assignLastResponsibleIgnoreDefault: false,
                type_assignment: 'cola_de_trabajo',
                max_cases_per_user: 3,
                case_enable_subcases: true,
                semaphore_by_state_ans: false,
                activeUsers_filter_bool: true,
                activeUsers_filter_integration_bool: false,
                case_require_state_change: false,
                reassignFilterActiveUsers: false,
                reassignIncludeDefaultAssignees: false,
                add_folio_to_external_code: false,
                case_stale_check: false,
                transition_stale_check: false,
                responsable_stale_check: false,
                reopen_cases_only_last_days: 7,
                agent_filter_subcases_only: false,
                allow_new_one_script_forms: true,
                cases_one_script_base_form: '',
                account_to_send_notifications: null,
                allow_close_case_without_subcases: true,
                due_date_for_ans_calculation: false,
            },
            geolocation: {
                geolocation_login_bool: false,
                geolocation_case_creation_bool: false,
                geolocation_client_search_bool: false,
                geolocation_client_creation_bool: false,
            },
            files_extensions: {
                maximun_size_allowed: 10,
                quantity_files_allowed: 5,
                allowed_file_extensions: ['.jpeg', '.jpg', '.pdf', '.txt', '.csv'],
            },
            onescript: {
                onescript_cache_ttl_ms: 0,
            },
        },
    },
});

const validCustomFieldsBase = () => ({
    application: {
        admin: {},
        agente: {
            flow_id: '',
            execute_ws_restflow: false,
        },
    },
});

export const SETTINGS = {
    layouts: validLayoutsBase(),
    behaviors: validBehaviorsBase(),
    custom_fields: validCustomFieldsBase(),
};

export const SETTINGS_WITH_WORK_QUEUE_PARAMS = (() => {
    const settings = {
        layouts: validLayoutsBase(),
        behaviors: validBehaviorsBase(),
        custom_fields: validCustomFieldsBase(),
    };
    settings.behaviors.application.agente.casos.assign_strategy = 'case_ans';
    settings.behaviors.application.agente.casos.type_assignment = 'cola_de_trabajo';
    settings.behaviors.application.agente.casos.max_cases_per_user = 3;
    settings.behaviors.application.agente.casos.activeUsers_filter_bool = true;
    settings.behaviors.application.agente.casos.activeUsers_filter_integration_bool = false;
    settings.behaviors.application.agente.casos.assignment_active_session_limit = 2;
    settings.behaviors.application.agente.casos.account_to_send_notifications = 'fd2969a2-1476-4759-964d-68a48b60538d';
    settings.behaviors.application.agente.geolocation.geolocation_login_bool = true;
    return settings;
})();

export const SETTINGS_WITH_WORK_QUEUE_PARAMS_AUX = (() => {
    const settings = {
        layouts: validLayoutsBase(),
        behaviors: validBehaviorsBase(),
        custom_fields: validCustomFieldsBase(),
    };
    settings.behaviors.application.agente.casos.assign_strategy = 'aux_cases.form_vida_salud.vencimiento';
    settings.behaviors.application.agente.casos.type_assignment = 'cola_de_trabajo';
    settings.behaviors.application.agente.casos.max_cases_per_user = 1;
    settings.behaviors.application.agente.casos.activeUsers_filter_bool = true;
    settings.behaviors.application.agente.casos.activeUsers_filter_integration_bool = false;
    settings.behaviors.application.agente.casos.account_to_send_notifications = null;
    settings.behaviors.application.agente.geolocation.geolocation_login_bool = true;
    return settings;
})();

export const SETTINGS_UPDATED_AT_6_OCTOBER_2025 = (() => {
    const settings = {
        layouts: validLayoutsBase(),
        behaviors: validBehaviorsBase(),
        custom_fields: validCustomFieldsBase(),
    };
    settings.behaviors.application.agente.casos.assign_strategy =
        'aux_cases.form_f73b06d5-4cc5-4bcb-b26e-36d741cc7f90.fechaHoraManual';
    settings.behaviors.application.agente.casos.type_assignment = 'asignacion_equivalente';
    settings.behaviors.application.agente.casos.max_cases_per_user = 2;
    settings.behaviors.application.agente.casos.activeUsers_filter_bool = false;
    settings.behaviors.application.agente.casos.activeUsers_filter_integration_bool = false;
    settings.behaviors.application.agente.casos.case_require_state_change = false;
    settings.behaviors.application.agente.casos.account_to_send_notifications = 'fd2969a2-1476-4759-964d-68a48b60538d';
    settings.behaviors.application.agente.geolocation.geolocation_login_bool = true;
    settings.layouts.application.agente.header.helps = true;
    settings.layouts.application.agente.cases.show_event_log = true;
    return settings;
})();
