import { globalUserId } from './20241125105900_usuario_base.js';
import { oneScriptBaseFormId } from './20251215105901_one_script.js';

export const globalConfigurationId = '7b682c6f-97a7-4187-af3b-6495f176b737';
export const globalConfigurationIdZeroTrust = '5c6c4fa6-bb54-4001-ab94-c30b5b45e57c';

const administratorsSettings = {
    layouts: {
        application: {
            admin: {
                cases: {
                    enable_custom_view: false,
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
                },
                header: {
                    helps: true,
                    custom_logo: '',
                    search_clients: true,
                    high_impact_fields: true,
                    total_cases_by_ans: true,
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
                calendar: {
                    oneScript_calendar: '',
                },
                search_clients: {
                    sexo_bool: false,
                    email_bool: true,
                    nombres_bool: true,
                    telefono_bool: true,
                    apellido1_bool: true,
                    apellido2_bool: true,
                    documento_bool: true,
                    reference_bool: true,
                    estado_civil_bool: false,
                    email_alterno_bool: true,
                    nombre_empresa_bool: true,
                    tipo_documento_bool: true,
                    fecha_nacimiento_bool: false,
                    telefono_alterno_bool: true,
                },
            },
        },
    },
    behaviors: {
        application: {
            admin: {
                users: {
                    inactivity_time: 30,
                    oneScript_users: '',
                    users_schema_id: '',
                    warning_logout_time: 5,
                },
                groups: { groups_schema_id: '', oneScript_groups: '' },
            },
            agente: {
                casos: {
                    type_assignment: 'cola_de_trabajo',
                    max_cases_per_user: null,
                    enableAdminApplication: true,
                    semaphore_by_state_ans: false,
                    allow_new_one_script_forms: true,
                    cases_one_script_base_form: '3b7fa9dc-9694-4f9b-9d2e-097012a1d6cb',
                    account_to_send_notifications: null,
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
                    allowed_file_extensions: ['.jpeg', '.jpg', '.pdf', '.txt', '.csv', '.ppt', '.zip', '.doc', '.xls'],
                },
            },
        },
    },
    custom_fields: { application: { admin: {}, agente: { execute_ws_restflow: false } } },
};

const newUsersSettings = {
    layouts: {
        application: {
            admin: {
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
                    campos_extra1: 'extra uno',
                    campos_extra2: 'extra dis',
                    campos_extra3: 'extra tres',
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
                agent: { my_cases: true },
                cases: {
                    show_attachments: true,
                    show_description: true,
                    account_to_send_link: '',
                    template_to_send_link: '',
                    allow_client_send_attachments: true,
                },
                header: {
                    helps: true,
                    custom_logo: '',
                    search_clients: true,
                    high_impact_fields: true,
                    total_cases_by_ans: true,
                },
                clients: {
                    fields: {},
                    habeasData: true,
                    open_cases: true,
                    client_data: true,
                    close_cases: true,
                    fields_edit: {},
                    custom_form_id: '',
                    content_habeas_data: 'contenido par el habeas',
                    get_list_field_to_show: true,
                    show_aux_client_expanded: false,
                    hide_client_form: false,
                },
                calendar: { oneScript_calendar: '' },
                search_clients: {
                    sexo_bool: false,
                    email_bool: true,
                    nombres_bool: true,
                    telefono_bool: true,
                    apellido1_bool: true,
                    apellido2_bool: true,
                    documento_bool: true,
                    reference_bool: true,
                    estado_civil_bool: false,
                    email_alterno_bool: true,
                    nombre_empresa_bool: true,
                    tipo_documento_bool: true,
                    fecha_nacimiento_bool: false,
                    telefono_alterno_bool: true,
                },
            },
        },
    },
    behaviors: {
        application: {
            admin: {},
            agente: {
                casos: {
                    type_assignment: 'cola_de_trabajo',
                    enableAdminApplication: false,
                    allow_description_empty: false,
                },
                geolocation: {
                    geolocation_login_bool: true,
                    geolocation_logout_bool: true,
                    geolocation_case_creation_bool: false,
                    geolocation_client_search_bool: false,
                    geolocation_client_creation_bool: false,
                },
                validation_rules: {
                    clients: {
                        required_fields: {
                            required_sexo: false,
                            required_email: true,
                            required_nombres: false,
                            required_telefono: false,
                            required_apellido1: false,
                            required_apellido2: false,
                            required_estado_civil: false,
                            required_email_alterno: false,
                            required_nombre_empresa: false,
                            required_fecha_nacimiento: false,
                            required_telefono_alterno: false,
                        },
                    },
                },
            },
        },
    },
    custom_fields: { application: { admin: {}, agente: {} } },
};

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
    await knex('global_configurations').insert({
        id: globalConfigurationId,
        settings: administratorsSettings,
        is_active: true,
        description: 'Administrators settings',
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
        created_by: globalUserId,
        updated_by: globalUserId,
    });

    await knex('global_configurations').insert({
        id: globalConfigurationIdZeroTrust,
        settings: newUsersSettings,
        is_active: true,
        description: 'New users settings',
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
        created_by: globalUserId,
        updated_by: globalUserId,
    });
}
