import { CLIENT_CHAR_LIMIT_KEYS, INITIAL_VALUES_GLOBAL_SETUP, fieldLabels } from "./data/constants";
import { parseCharLimitKey } from "@kace/core/src/global-config/domain/settings/clientFieldCharLimits.js";

const LEGACY_ORDER_TYPE_MAP = {
    asc: "ASC",
    desc: "DESC",
    asc_nulls_first: "ASC NULLS FIRST",
    desc_nulls_last: "DESC NULLS LAST",
};

const normalizeHeadersLabels = (headersLabels) => {
    if (Array.isArray(headersLabels)) return headersLabels;
    if (headersLabels && typeof headersLabels === "object") {
        return Object.entries(headersLabels).map(([key, label]) => ({ key, label }));
    }
    return [];
};

const buildWorkQueueSortingRules = (casos = {}) => {
    const existingRules = Array.isArray(casos.work_queue_sorting_rules) ? casos.work_queue_sorting_rules : [];
    if (existingRules.length > 0) return existingRules;

    if (!casos.assign_strategy || !casos.cast_type || !casos.order_type) return [];

    return [
        {
            id: `legacy-${casos.assign_strategy}-${casos.cast_type}-${casos.order_type}`,
            assign_strategy: casos.assign_strategy,
            cast_type: casos.cast_type,
            order_type: LEGACY_ORDER_TYPE_MAP[casos.order_type] || casos.order_type,
        },
    ];
};

export const isReopenWindowUnlimited = (value) => value === 0 || value === "0";

const pickClientCharLimits = (source) => Object.fromEntries(CLIENT_CHAR_LIMIT_KEYS.map((key) => [key, source?.[key]]));

export const getGeneralSetupErrorLabel = (key, t) => {
    const { field, bound } = parseCharLimitKey(key) ?? {};

    if (!fieldLabels.includes(field)) {
        return t(`generalSetup.form.labels.${key}`, key);
    }

    return `${t(`generalSetup.form.labels.${field}`)} (${t(`generalSetup.form.labels.${bound}`)})`;
};

const blockKeys = (keys) => (event) => {
    if (keys.includes(event.key)) {
        event.preventDefault();
    }
};

const blockPastedText = (pattern) => (event) => {
    if (pattern.test(event.clipboardData.getData("text"))) {
        event.preventDefault();
    }
};

export const blockNumericSignKeys = blockKeys(["-", "e", "E", "+"]);
export const blockNumericSignPaste = blockPastedText(/[-eE+]/);
export const blockNumericSignAndDecimalKeys = blockKeys(["-", "e", "E", "+", "."]);
export const blockNumericSignAndDecimalPaste = blockPastedText(/[-eE+.]/);

export const mergeFormDataWithDefaults = (data) => {
    if (!data) {
        return { ...INITIAL_VALUES_GLOBAL_SETUP };
    }
    const result = { ...INITIAL_VALUES_GLOBAL_SETUP };
    Object.keys(data).forEach((key) => {
        const isNullable = data[key] === null || data[key] === undefined;
        const valueType = typeof INITIAL_VALUES_GLOBAL_SETUP[key];
        const defaultValue = valueType === "boolean" ? false : valueType === "number" ? 0 : "";
        if (isNullable) {
            result[key] = defaultValue;
            return;
        }
        result[key] = valueType === "boolean" ? !!data[key] : data[key];
    });
    return result;
};

export const handleCreateObject = (values) => {
    return {
        layouts: {
            application: {
                agente: {
                    header: {
                        custom_logo: values.custom_logo,
                        high_impact_fields: values.high_impact_fields,
                        helps: values.helps,
                        total_cases_by_ans: values.total_cases_by_ans,
                        my_agenda: values.my_agenda,
                    },
                    clients: {
                        show_aux_client_expanded: values.show_aux_client_expanded,
                        hide_client_form: values.hide_client_form,
                        client_data: values.client_data,
                        habeasData: values.habeasData,
                        content_habeas_data: values.content_habeas_data,
                        open_cases: values.open_cases,
                        close_cases: values.close_cases,
                        custom_form_id: values.custom_form_id,
                        get_list_field_to_show: values.get_list_field_to_show,
                        show_update_button: values.show_update_button,
                        fields: {
                            field_tipo_documento: values.field_tipo_documento,
                            field_documento: values.field_documento,
                            field_nombres: values.field_nombres,
                            field_apellido1: values.field_apellido1,
                            field_apellido2: values.field_apellido2,
                            field_nombre_empresa: values.field_nombre_empresa,
                            field_sexo: values.field_sexo,
                            field_estado_civil: values.field_estado_civil,
                            field_fecha_nacimiento: values.field_fecha_nacimiento,
                            field_email: values.field_email,
                            field_email_alterno: values.field_email_alterno,
                            field_telefono: values.field_telefono,
                            field_telefono_alterno: values.field_telefono_alterno,
                            field_campos_extra1: values.field_campos_extra1,
                            field_campos_extra2: values.field_campos_extra2,
                            field_campos_extra3: values.field_campos_extra3,
                        },
                        fields_edit: {
                            field_tipo_documento_edit: values.field_tipo_documento_edit,
                            field_documento_edit: values.field_documento_edit,
                            field_nombres_edit: values.field_nombres_edit,
                            field_apellido1_edit: values.field_apellido1_edit,
                            field_apellido2_edit: values.field_apellido2_edit,
                            field_nombre_empresa_edit: values.field_nombre_empresa_edit,
                            field_sexo_edit: values.field_sexo_edit,
                            field_estado_civil_edit: values.field_estado_civil_edit,
                            field_fecha_nacimiento_edit: values.field_fecha_nacimiento_edit,
                            field_email_edit: values.field_email_edit,
                            field_email_alterno_edit: values.field_email_alterno_edit,
                            field_telefono_edit: values.field_telefono_edit,
                            field_telefono_alterno_edit: values.field_telefono_alterno_edit,
                            field_campos_extra1_edit: values.field_campos_extra1_edit,
                            field_campos_extra2_edit: values.field_campos_extra2_edit,
                            field_campos_extra3_edit: values.field_campos_extra3_edit,
                        },
                        fields_copy: {
                            field_tipo_documento_copy: values.field_tipo_documento_copy,
                            field_documento_copy: values.field_documento_copy,
                            field_nombres_copy: values.field_nombres_copy,
                            field_apellido1_copy: values.field_apellido1_copy,
                            field_apellido2_copy: values.field_apellido2_copy,
                            field_nombre_empresa_copy: values.field_nombre_empresa_copy,
                            field_sexo_copy: values.field_sexo_copy,
                            field_estado_civil_copy: values.field_estado_civil_copy,
                            field_fecha_nacimiento_copy: values.field_fecha_nacimiento_copy,
                            field_email_copy: values.field_email_copy,
                            field_email_alterno_copy: values.field_email_alterno_copy,
                            field_telefono_copy: values.field_telefono_copy,
                            field_telefono_alterno_copy: values.field_telefono_alterno_copy,
                            field_campos_extra1_copy: values.field_campos_extra1_copy,
                            field_campos_extra2_copy: values.field_campos_extra2_copy,
                            field_campos_extra3_copy: values.field_campos_extra3_copy,
                        },
                        fields_required: {
                            field_tipo_documento_required: values.field_tipo_documento_required,
                            field_documento_required: values.field_documento_required,
                            field_nombres_required: values.field_nombres_required,
                            field_apellido1_required: values.field_apellido1_required,
                            field_apellido2_required: values.field_apellido2_required,
                            field_nombre_empresa_required: values.field_nombre_empresa_required,
                            field_sexo_required: values.field_sexo_required,
                            field_estado_civil_required: values.field_estado_civil_required,
                            field_fecha_nacimiento_required: values.field_fecha_nacimiento_required,
                            field_email_required: values.field_email_required,
                            field_email_alterno_required: values.field_email_alterno_required,
                            field_telefono_required: values.field_telefono_required,
                            field_telefono_alterno_required: values.field_telefono_alterno_required,
                            field_campos_extra1_required: values.field_campos_extra1_required,
                            field_campos_extra2_required: values.field_campos_extra2_required,
                            field_campos_extra3_required: values.field_campos_extra3_required,
                        },
                        fields_max_min: pickClientCharLimits(values),
                    },
                    agent: {
                        my_cases: values.my_cases,
                        show_my_assigned_cases: values.show_my_assigned_cases,
                        show_my_created_cases: values.show_my_created_cases,
                        enable_custom_view: values.enable_custom_view,
                        show_boards: values.show_boards,
                        show_interactions: values.show_interactions,
                        show_agent_interactions: values.show_agent_interactions,
                        show_case: values.show_case,
                        show_client: values.show_client,
                        show_transitions: values.show_transitions,
                        show_subcase: values.show_subcase,
                        show_client_data: values.show_client_data,
                        cases_agent_refresh_min: values.cases_agent_refresh_min ?? "1",
                    },
                    cases: {
                        labelCases: values.labelCases,
                        show_description: values.show_description,
                        show_attachments: values.show_attachments,
                        allow_client_send_attachments: values.allow_client_send_attachments,
                        show_sheduler: values.show_sheduler,
                        show_history: values.show_history,
                        show_event_log: values.show_event_log,
                        allowed_event_types: values.allowed_event_types || [],
                        account_to_send_link: values.account_to_send_link,
                        case_client_form: values.case_client_form,
                        template_to_send_link: values.template_to_send_link,
                        express_cases: values?.express_cases || [],
                        show_comment_tab: values?.show_comment_tab,
                        show_subcases_button: values?.show_subcases_button,
                        show_cases_button: values?.show_cases_button,
                        show_save_client_button: values?.show_save_client_button,
                        show_new_client_button: values?.show_new_client_button,
                        show_time_counter: values?.show_time_counter,
                        show_notifications: values?.show_notifications,
                        notifications_one_script_form: values?.show_notifications
                            ? values?.notifications_one_script_form || ""
                            : "",
                        refresh_tab_case: !!values.refresh_tab_case,
                        refresh_tab_customer: !!values.refresh_tab_customer,
                        refresh_tab_transitions: !!values.refresh_tab_transitions,
                        refresh_tab_subcases: !!values.refresh_tab_subcases,
                        refresh_tab_comments: !!values.refresh_tab_comments,
                        refresh_tab_agenda: !!values.refresh_tab_agenda,
                        refresh_tab_logs: !!values.refresh_tab_logs,
                        refresh_tab_interactions: !!values.refresh_tab_interactions,
                        refresh_tab_notifications: !!values.refresh_tab_notifications,
                        show_columns_dropdown: values.show_columns_dropdown ?? true,
                        show_time_description_prefixes: values.show_time_description_prefixes ?? true,
                        headers_labels: values.headers_labels ?? [],
                    },
                    search_clients: {
                        tipo_documento_bool: values.tipo_documento_bool,
                        documento_bool: values.documento_bool,
                        nombres_bool: values.nombres_bool,
                        apellido1_bool: values.apellido1_bool,
                        apellido2_bool: values.apellido2_bool,
                        nombre_empresa_bool: values.nombre_empresa_bool,
                        sexo_bool: values.sexo_bool,
                        estado_civil_bool: values.estado_civil_bool,
                        fecha_nacimiento_bool: values.fecha_nacimiento_bool,
                        email_bool: values.email_bool,
                        email_alterno_bool: values.email_alterno_bool,
                        telefono_bool: values.telefono_bool,
                        telefono_alterno_bool: values.telefono_alterno_bool,
                        campos_extra1_bool: values.campos_extra1_bool,
                        campos_extra2_bool: values.campos_extra2_bool,
                        campos_extra3_bool: values.campos_extra3_bool,
                        reference_bool: values.reference_bool,
                    },
                    calendar: {
                        oneScript_calendar: values.oneScript_calendar,
                    },
                    interactions: {
                        enable_view_interaction: values.enable_view_interaction,
                    },
                },
                admin: {
                    classifications: {
                        label_1: values.label_1,
                        label_2: values.label_2,
                        label_3: values.label_3,
                        label_4: values.label_4,
                        label_5: values.label_5,
                        label_6: values.label_6,
                        label_7: values.label_7,
                        label_8: values.label_8,
                        label_9: values.label_9,
                        label_10: values.label_10,
                    },
                    clients: {
                        tipo_documento: values.tipo_documento,
                        documento: values.documento,
                        nombres: values.nombres,
                        apellido1: values.apellido1,
                        apellido2: values.apellido2,
                        nombre_empresa: values.nombre_empresa,
                        sexo: values.sexo,
                        estado_civil: values.estado_civil,
                        fecha_nacimiento: values.fecha_nacimiento,
                        email: values.email,
                        email_alterno: values.email_alterno,
                        telefono: values.telefono,
                        telefono_alterno: values.telefono_alterno,
                        campos_extra1: values.campos_extra1,
                        campos_extra2: values.campos_extra2,
                        campos_extra3: values.campos_extra3,
                        habeas_data: values.habeas_data,
                        reference: values.reference,
                    },
                    cases: {
                        enable_custom_view: values.enable_admin_custom_view,
                        custom_view_name: values.admin_custom_view_name,
                        cases_admin_refresh_min: values.cases_admin_refresh_min ?? "1",
                        visible_columns: values.admin_visible_columns ?? [],
                    },
                },
            },
        },
        behaviors: {
            application: {
                agente: {
                    casos: {
                        allow_description_empty: values.allow_description_empty,
                        case_require_state_change: values.case_require_state_change,
                        lock_case_description_edit: values.lock_case_description_edit,
                        allow_case_reclassification: values.allow_case_reclassification,
                        account_to_send_notifications: values.account_to_send_notifications,
                        type_assignment: values.type_assignment,
                        assignLastResponsibleIgnoreDefault: values.assignLastResponsibleIgnoreDefault,
                        ...(values.case_stale_check != null ? { case_stale_check: values.case_stale_check } : {}),
                        work_queue_sorting_rules: values.work_queue_sorting_rules || [],
                        max_cases_per_user: values.max_cases_per_user || null,
                        activeUsers_filter_bool: values.activeUsers_filter_bool,
                        activeUsers_filter_integration_bool: values.activeUsers_filter_integration_bool,
                        assignment_active_session_limit: values.assignment_active_session_limit,
                        due_date_for_ans_calculation: values.due_date_for_ans_calculation,
                        case_enable_subcases: values.case_enable_subcases,
                        agent_filter_subcases_only: values.agent_filter_subcases_only,
                        close_tab_on_case_created: values.close_tab_on_case_created,
                        return_to_board_on_case_saved: values.return_to_board_on_case_saved,
                        allow_close_case_without_subcases: values.allow_close_case_without_subcases,
                        allow_new_one_script_forms: values.allow_new_one_script_forms,
                        cases_one_script_base_form: values.cases_one_script_base_form,
                        semaphore_by_state_ans: values.semaphore_by_state_ans,
                        ans_display_mode: values.ans_display_mode,
                        advanced_cases_search: values.advanced_cases_search,
                        advanced_cases_search_one_script_form: values.advanced_cases_search_one_script_form,
                        reassignFilterActiveUsers: values.reassignFilterActiveUsers,
                        reassignIncludeDefaultAssignees: values.reassignIncludeDefaultAssignees,
                        add_folio_to_external_code: values.add_folio_to_external_code,
                        folio_length: values.folio_length,
                        reopen_cases_only_last_days: Number(values.reopen_cases_only_last_days),
                    },
                    geolocation: {
                        geolocation_login_bool: values.geolocation_login_bool,
                        geolocation_client_search_bool: values.geolocation_client_search_bool,
                        geolocation_case_creation_bool: values.geolocation_case_creation_bool,
                        geolocation_case_update_bool: values.geolocation_case_update_bool,
                        geolocation_client_creation_bool: values.geolocation_client_creation_bool,
                        geolocation_client_update_bool: values.geolocation_client_update_bool,
                        geolocation_logout_bool: values.geolocation_logout_bool,
                        geolocation_current_location_bool: values.geolocation_current_location_bool,
                        max_map_markers: values.max_map_markers,
                    },
                    files_extensions: {
                        allowed_file_extensions: values.allowed_file_extensions || [],
                        maximun_size_allowed: values.maximun_size_allowed,
                        quantity_files_allowed: values.quantity_files_allowed,
                    },
                    ...(values._channel_hub
                        ? {
                              channel_hub: values._channel_hub,
                          }
                        : {}),
                    onescript: {
                        onescript_cache_ttl_ms: values.onescript_cache_ttl_ms,
                    },
                },
                admin: {
                    users: {
                        inactivity_time: values.inactivity_time,
                        warning_logout_time: values.warning_logout_time,
                        active_session_limit: values.active_session_limit,
                        group_membership_check_interval: values.group_membership_check_interval,
                        users_schema_id: values.users_schema_id,
                        oneScript_users: values.oneScript_users,
                    },
                    groups: {
                        groups_schema_id: values.groups_schema_id,
                        oneScript_groups: values.oneScript_groups,
                    },
                    menus: {
                        hidden_menus: values.hidden_menus || [],
                    },
                    reports: {
                        report_filter_days: values.report_filter_days ?? 1,
                    },
                },
            },
        },
        custom_fields: {
            application: {
                agente: {
                    execute_ws_restflow: !!values.execute_ws_restflow,
                    flow_id: values.flow_id,
                },
            },
        },
    };
};

export const transformDataToFormValues = (data, description, is_active) => {
    const { layouts, behaviors, custom_fields } = data;
    const queueSortingRules = buildWorkQueueSortingRules(behaviors?.application?.agente?.casos);

    return {
        description,
        is_active,
        custom_logo: layouts.application.agente.header.custom_logo,
        high_impact_fields: layouts.application.agente.header.high_impact_fields,
        helps: layouts.application.agente.header.helps,
        total_cases_by_ans: layouts.application.agente.header.total_cases_by_ans,
        my_agenda: layouts.application.agente.header.my_agenda ?? true,
        show_aux_client_expanded: !!layouts.application.agente.clients?.show_aux_client_expanded,
        hide_client_form: !!layouts.application.agente.clients?.hide_client_form,
        client_data: layouts.application.agente.clients.client_data,
        habeasData: layouts.application.agente.clients.habeasData,
        content_habeas_data: layouts.application.agente.clients.content_habeas_data,
        open_cases: layouts.application.agente.clients.open_cases,
        close_cases: layouts.application.agente.clients.close_cases,
        show_update_button: layouts.application.agente.clients.show_update_button,
        custom_form_id: layouts.application.agente.clients.custom_form_id,
        get_list_field_to_show: layouts.application.agente.clients.get_list_field_to_show,
        my_cases: layouts.application.agente.agent.my_cases,
        show_my_assigned_cases: layouts.application.agente.agent.show_my_assigned_cases,
        show_my_created_cases: layouts.application.agente.agent.show_my_created_cases,
        _channel_hub: behaviors.application.agente?.channel_hub,
        enable_view_interaction: layouts.application.agente?.interactions?.enable_view_interaction || false,
        enable_custom_view: layouts.application.agente.agent.enable_custom_view,
        show_boards: layouts.application.agente.agent?.show_boards || false,
        show_interactions: layouts.application.agente.agent?.show_interactions || false,
        show_agent_interactions: layouts.application.agente.agent?.show_agent_interactions || false,
        show_case: layouts.application.agente.agent?.show_case || false,
        show_client: layouts.application.agente.agent?.show_client || false,
        show_transitions: layouts.application.agente.agent?.show_transitions || false,
        show_subcase: layouts.application.agente.agent?.show_subcase || false,
        show_client_data: layouts.application.agente.agent?.show_client_data ?? true,
        enable_admin_custom_view: layouts.application.admin?.cases?.enable_custom_view || false,
        admin_custom_view_name: layouts.application.admin?.cases?.custom_view_name || "",
        cases_admin_refresh_min: layouts.application.admin?.cases?.cases_admin_refresh_min ?? "1",
        admin_visible_columns: layouts.application.admin?.cases?.visible_columns ?? [],
        cases_agent_refresh_min: layouts.application.agente.agent?.cases_agent_refresh_min ?? "1",
        show_description: layouts.application.agente.cases.show_description,
        show_attachments: layouts.application.agente.cases.show_attachments,
        show_comment_tab: layouts.application.agente.cases.show_comment_tab,
        show_subcases_button: layouts.application.agente.cases.show_subcases_button,
        show_cases_button: layouts.application.agente.cases.show_cases_button,
        show_save_client_button: layouts.application.agente.cases.show_save_client_button,
        show_new_client_button: layouts.application.agente.cases.show_new_client_button,
        allow_client_send_attachments: layouts.application.agente.cases.allow_client_send_attachments,
        show_sheduler: layouts.application.agente.cases.show_sheduler,
        show_history: layouts.application.agente.cases.show_history,
        show_event_log: layouts.application.agente?.cases?.show_event_log || false,
        allowed_event_types: layouts.application.agente?.cases?.allowed_event_types || [],
        show_time_counter: layouts.application.agente?.cases?.show_time_counter ?? true,
        show_columns_dropdown: layouts.application.agente?.cases?.show_columns_dropdown ?? true,
        show_time_description_prefixes: layouts.application.agente?.cases?.show_time_description_prefixes ?? true,
        headers_labels: normalizeHeadersLabels(layouts.application.agente?.cases?.headers_labels),
        account_to_send_link: layouts.application.agente.cases.account_to_send_link,
        case_client_form: layouts.application.agente.cases.case_client_form,
        template_to_send_link: layouts.application.agente.cases.template_to_send_link,
        labelCases: layouts.application.agente.cases.labelCases,
        tipo_documento_bool: layouts.application.agente.search_clients.tipo_documento_bool,
        documento_bool: layouts.application.agente.search_clients.documento_bool,
        nombres_bool: layouts.application.agente.search_clients.nombres_bool,
        apellido1_bool: layouts.application.agente.search_clients.apellido1_bool,
        apellido2_bool: layouts.application.agente.search_clients.apellido2_bool,
        nombre_empresa_bool: layouts.application.agente.search_clients.nombre_empresa_bool,
        sexo_bool: layouts.application.agente.search_clients.sexo_bool,
        estado_civil_bool: layouts.application.agente.search_clients.estado_civil_bool,
        fecha_nacimiento_bool: layouts.application.agente.search_clients.fecha_nacimiento_bool,
        email_bool: layouts.application.agente.search_clients.email_bool,
        email_alterno_bool: layouts.application.agente.search_clients.email_alterno_bool,
        telefono_bool: layouts.application.agente.search_clients.telefono_bool,
        telefono_alterno_bool: layouts.application.agente.search_clients.telefono_alterno_bool,
        campos_extra1_bool: layouts.application.agente.search_clients.campos_extra1_bool,
        campos_extra2_bool: layouts.application.agente.search_clients.campos_extra2_bool,
        campos_extra3_bool: layouts.application.agente.search_clients.campos_extra3_bool,
        reference_bool: layouts.application.agente.search_clients.reference_bool,
        oneScript_calendar: layouts.application.agente?.calendar?.oneScript_calendar,
        label_1: layouts.application.admin.classifications.label_1,
        label_2: layouts.application.admin.classifications.label_2,
        label_3: layouts.application.admin.classifications.label_3,
        label_4: layouts.application.admin.classifications.label_4,
        label_5: layouts.application.admin.classifications.label_5,
        label_6: layouts.application.admin.classifications.label_6,
        label_7: layouts.application.admin.classifications.label_7,
        label_8: layouts.application.admin.classifications.label_8,
        label_9: layouts.application.admin.classifications.label_9,
        label_10: layouts.application.admin.classifications.label_10,
        tipo_documento: layouts.application.admin.clients.tipo_documento,
        documento: layouts.application.admin.clients.documento,
        nombres: layouts.application.admin.clients.nombres,
        apellido1: layouts.application.admin.clients.apellido1,
        apellido2: layouts.application.admin.clients.apellido2,
        nombre_empresa: layouts.application.admin.clients.nombre_empresa,
        sexo: layouts.application.admin.clients.sexo,
        estado_civil: layouts.application.admin.clients.estado_civil,
        fecha_nacimiento: layouts.application.admin.clients.fecha_nacimiento,
        email: layouts.application.admin.clients.email,
        email_alterno: layouts.application.admin.clients.email_alterno,
        telefono: layouts.application.admin.clients.telefono,
        telefono_alterno: layouts.application.admin.clients.telefono_alterno,
        campos_extra1: layouts.application.admin.clients.campos_extra1,
        campos_extra2: layouts.application.admin.clients.campos_extra2,
        campos_extra3: layouts.application.admin.clients.campos_extra3,
        reference: layouts.application.admin.clients.reference,
        habeas_data: layouts.application.admin.clients.habeas_data,
        allow_description_empty: behaviors.application.agente.casos.allow_description_empty,
        case_require_state_change: behaviors.application.agente.casos.case_require_state_change,
        lock_case_description_edit: behaviors.application.agente.casos.lock_case_description_edit,
        allow_case_reclassification: behaviors.application.agente.casos.allow_case_reclassification,
        type_assignment: behaviors.application.agente.casos.type_assignment,
        geolocation_login_bool: behaviors.application.agente.geolocation.geolocation_login_bool,
        geolocation_client_search_bool: behaviors.application.agente.geolocation.geolocation_client_search_bool,
        geolocation_case_creation_bool: behaviors.application.agente.geolocation.geolocation_case_creation_bool,
        geolocation_case_update_bool: behaviors.application.agente.geolocation.geolocation_case_update_bool,
        geolocation_client_creation_bool: behaviors.application.agente.geolocation.geolocation_client_creation_bool,
        geolocation_client_update_bool: behaviors.application.agente.geolocation.geolocation_client_update_bool,
        geolocation_logout_bool: behaviors.application.agente.geolocation.geolocation_logout_bool,
        geolocation_current_location_bool: behaviors.application.agente.geolocation.geolocation_current_location_bool,
        max_map_markers: behaviors.application.agente.geolocation.max_map_markers,
        field_tipo_documento: layouts.application.agente.clients.fields.field_tipo_documento,
        field_documento: layouts.application.agente.clients.fields.field_documento,
        field_nombres: layouts.application.agente.clients.fields.field_nombres,
        field_apellido1: layouts.application.agente.clients.fields.field_apellido1,
        field_apellido2: layouts.application.agente.clients.fields.field_apellido2,
        field_nombre_empresa: layouts.application.agente.clients.fields.field_nombre_empresa,
        field_sexo: layouts.application.agente.clients.fields.field_sexo,
        field_estado_civil: layouts.application.agente.clients.fields.field_estado_civil,
        field_fecha_nacimiento: layouts.application.agente.clients.fields.field_fecha_nacimiento,
        field_email: layouts.application.agente.clients.fields.field_email,
        field_email_alterno: layouts.application.agente.clients.fields.field_email_alterno,
        field_telefono: layouts.application.agente.clients.fields.field_telefono,
        field_telefono_alterno: layouts.application.agente.clients.fields.field_telefono_alterno,
        field_campos_extra1: layouts.application.agente.clients.fields.field_campos_extra1,
        field_campos_extra2: layouts.application.agente.clients.fields.field_campos_extra2,
        field_campos_extra3: layouts.application.agente.clients.fields.field_campos_extra3,
        field_tipo_documento_edit: layouts.application.agente.clients.fields_edit?.field_tipo_documento_edit,
        field_documento_edit: layouts.application.agente.clients.fields_edit?.field_documento_edit,
        field_nombres_edit: layouts.application.agente.clients.fields_edit?.field_nombres_edit,
        field_apellido1_edit: layouts.application.agente.clients.fields_edit?.field_apellido1_edit,
        field_apellido2_edit: layouts.application.agente.clients.fields_edit?.field_apellido2_edit,
        field_nombre_empresa_edit: layouts.application.agente.clients.fields_edit?.field_nombre_empresa_edit,
        field_sexo_edit: layouts.application.agente.clients.fields_edit?.field_sexo_edit,
        field_estado_civil_edit: layouts.application.agente.clients.fields_edit?.field_estado_civil_edit,
        field_fecha_nacimiento_edit: layouts.application.agente.clients.fields_edit?.field_fecha_nacimiento_edit,
        field_email_edit: layouts.application.agente.clients.fields_edit?.field_email_edit,
        field_email_alterno_edit: layouts.application.agente.clients.fields_edit?.field_email_alterno_edit,
        field_telefono_edit: layouts.application.agente.clients.fields_edit?.field_telefono_edit,
        field_telefono_alterno_edit: layouts.application.agente.clients.fields_edit?.field_telefono_alterno_edit,
        field_campos_extra1_edit: layouts.application.agente.clients.fields_edit?.field_campos_extra1_edit,
        field_campos_extra2_edit: layouts.application.agente.clients.fields_edit?.field_campos_extra2_edit,
        field_campos_extra3_edit: layouts.application.agente.clients.fields_edit?.field_campos_extra3_edit,
        field_tipo_documento_required:
            layouts.application.agente.clients.fields_required?.field_tipo_documento_required,
        field_documento_required: layouts.application.agente.clients.fields_required?.field_documento_required,
        field_nombres_required: layouts.application.agente.clients.fields_required?.field_nombres_required,
        field_apellido1_required: layouts.application.agente.clients.fields_required?.field_apellido1_required,
        field_apellido2_required: layouts.application.agente.clients.fields_required?.field_apellido2_required,
        field_nombre_empresa_required:
            layouts.application.agente.clients.fields_required?.field_nombre_empresa_required,
        field_sexo_required: layouts.application.agente.clients.fields_required?.field_sexo_required,
        field_estado_civil_required: layouts.application.agente.clients.fields_required?.field_estado_civil_required,
        field_fecha_nacimiento_required:
            layouts.application.agente.clients.fields_required?.field_fecha_nacimiento_required,
        field_email_required: layouts.application.agente.clients.fields_required?.field_email_required,
        field_email_alterno_required: layouts.application.agente.clients.fields_required?.field_email_alterno_required,
        field_telefono_required: layouts.application.agente.clients.fields_required?.field_telefono_required,
        field_telefono_alterno_required:
            layouts.application.agente.clients.fields_required?.field_telefono_alterno_required,
        field_campos_extra1_required: layouts.application.agente.clients.fields_required?.field_campos_extra1_required,
        field_campos_extra2_required: layouts.application.agente.clients.fields_required?.field_campos_extra2_required,
        field_campos_extra3_required: layouts.application.agente.clients.fields_required?.field_campos_extra3_required,
        field_tipo_documento_copy: layouts.application.agente.clients.fields_copy?.field_tipo_documento_copy,
        field_documento_copy: layouts.application.agente.clients.fields_copy?.field_documento_copy,
        field_nombres_copy: layouts.application.agente.clients.fields_copy?.field_nombres_copy,
        field_apellido1_copy: layouts.application.agente.clients.fields_copy?.field_apellido1_copy,
        field_apellido2_copy: layouts.application.agente.clients.fields_copy?.field_apellido2_copy,
        field_nombre_empresa_copy: layouts.application.agente.clients.fields_copy?.field_nombre_empresa_copy,
        field_sexo_copy: layouts.application.agente.clients.fields_copy?.field_sexo_copy,
        field_estado_civil_copy: layouts.application.agente.clients.fields_copy?.field_estado_civil_copy,
        field_fecha_nacimiento_copy: layouts.application.agente.clients.fields_copy?.field_fecha_nacimiento_copy,
        field_email_copy: layouts.application.agente.clients.fields_copy?.field_email_copy,
        field_email_alterno_copy: layouts.application.agente.clients.fields_copy?.field_email_alterno_copy,
        field_telefono_copy: layouts.application.agente.clients.fields_copy?.field_telefono_copy,
        field_telefono_alterno_copy: layouts.application.agente.clients.fields_copy?.field_telefono_alterno_copy,
        field_campos_extra1_copy: layouts.application.agente.clients.fields_copy?.field_campos_extra1_copy,
        field_campos_extra2_copy: layouts.application.agente.clients.fields_copy?.field_campos_extra2_copy,
        field_campos_extra3_copy: layouts.application.agente.clients.fields_copy?.field_campos_extra3_copy,
        ...pickClientCharLimits(layouts.application.agente.clients.fields_max_min),
        account_to_send_notifications: behaviors.application.agente.casos.account_to_send_notifications,
        assign_strategy: behaviors.application.agente.casos.assign_strategy,
        cast_type: behaviors.application.agente.casos.cast_type,
        order_type: behaviors.application.agente.casos.order_type,
        assignLastResponsibleIgnoreDefault:
            behaviors.application.agente.casos.assignLastResponsibleIgnoreDefault ??
            behaviors.application.agente.casos.prioritize_last_user_state_change ??
            false,
        case_stale_check:
            behaviors.application.agente.casos.case_stale_check == null
                ? null
                : Boolean(behaviors.application.agente.casos.case_stale_check),
        transition_stale_check: Boolean(behaviors.application.agente.casos.transition_stale_check),
        responsable_stale_check: Boolean(behaviors.application.agente.casos.responsable_stale_check),
        work_queue_sorting_rules: queueSortingRules,
        max_cases_per_user: behaviors.application.agente.casos.max_cases_per_user,
        activeUsers_filter_bool: behaviors.application.agente.casos.activeUsers_filter_bool,
        activeUsers_filter_integration_bool:
            behaviors.application.agente.casos.activeUsers_filter_integration_bool ?? false,
        due_date_for_ans_calculation: behaviors.application.agente.casos.due_date_for_ans_calculation,
        case_enable_subcases: behaviors.application.agente.casos.case_enable_subcases,
        agent_filter_subcases_only: behaviors.application.agente.casos.agent_filter_subcases_only,
        case_restrict_close_with_subcases: behaviors.application.agente.casos.case_restrict_close_with_subcases,
        close_tab_on_case_created: behaviors.application.agente.casos.close_tab_on_case_created || false,
        return_to_board_on_case_saved: behaviors.application.agente.casos.return_to_board_on_case_saved || false,
        execute_ws_restflow: !!custom_fields.application.agente?.execute_ws_restflow,
        allowed_file_extensions: behaviors.application.agente?.files_extensions?.allowed_file_extensions || [],
        maximun_size_allowed: behaviors.application.agente?.files_extensions?.maximun_size_allowed,
        quantity_files_allowed: behaviors.application.agente?.files_extensions?.quantity_files_allowed,
        flow_id: custom_fields.application.agente?.flow_id,
        allow_close_case_without_subcases: behaviors.application.agente.casos.allow_close_case_without_subcases,
        allow_new_one_script_forms: behaviors?.application?.agente?.casos?.allow_new_one_script_forms,
        cases_one_script_base_form: behaviors?.application?.agente?.casos?.cases_one_script_base_form ?? "",
        semaphore_by_state_ans: behaviors?.application?.agente?.casos?.semaphore_by_state_ans || false,
        ans_display_mode: behaviors?.application?.agente?.casos?.ans_display_mode || "row",
        inactivity_time: behaviors?.application?.admin?.users?.inactivity_time || 30,
        active_session_limit: behaviors?.application?.admin?.users?.active_session_limit ?? 2,
        warning_logout_time: behaviors?.application?.admin?.users?.warning_logout_time ?? 5,
        group_membership_check_interval: behaviors?.application?.admin?.users?.group_membership_check_interval ?? 0,
        express_cases: layouts.application.agente.cases.express_cases,
        advanced_cases_search: behaviors?.application?.agente?.casos?.advanced_cases_search,
        advanced_cases_search_one_script_form:
            behaviors?.application?.agente?.casos?.advanced_cases_search_one_script_form,
        reassignFilterActiveUsers: behaviors?.application?.agente?.casos?.reassignFilterActiveUsers,
        reassignIncludeDefaultAssignees: behaviors?.application?.agente?.casos?.reassignIncludeDefaultAssignees,
        assignment_active_session_limit: behaviors?.application?.agente?.casos?.assignment_active_session_limit ?? 2,
        add_folio_to_external_code: behaviors?.application?.agente?.casos?.add_folio_to_external_code || false,
        folio_length: behaviors?.application?.agente?.casos?.folio_length || null,
        reopen_cases_only_last_days: behaviors?.application?.agente?.casos?.reopen_cases_only_last_days ?? 7,
        users_schema_id: behaviors?.application?.admin?.users?.users_schema_id || "",
        oneScript_users: behaviors?.application?.admin?.users?.oneScript_users || "",
        oneScript_groups: behaviors?.application?.admin?.groups?.oneScript_groups || "",
        groups_schema_id: behaviors?.application?.admin?.groups?.groups_schema_id || "",
        onescript_cache_ttl_ms:
            behaviors?.application?.agente?.onescript?.onescript_cache_ttl_ms ??
            behaviors?.application?.agente?.onescript?.onescript_auth_cognito_cache_ttl_ms ??
            behaviors?.application?.agente?.onescript?.onescript_schemas_rules_search_cache_ttl_ms ??
            0,
        hidden_menus: behaviors?.application?.admin?.menus?.hidden_menus || [],
        report_filter_days: behaviors?.application?.admin?.reports?.report_filter_days ?? 1,
        refresh_tab_case: layouts.application.agente?.cases?.refresh_tab_case ?? false,
        refresh_tab_customer: layouts.application.agente?.cases?.refresh_tab_customer ?? false,
        refresh_tab_transitions: layouts.application.agente?.cases?.refresh_tab_transitions ?? false,
        refresh_tab_subcases: layouts.application.agente?.cases?.refresh_tab_subcases ?? false,
        refresh_tab_comments: layouts.application.agente?.cases?.refresh_tab_comments ?? false,
        refresh_tab_agenda: layouts.application.agente?.cases?.refresh_tab_agenda ?? true,
        refresh_tab_logs: layouts.application.agente?.cases?.refresh_tab_logs ?? true,
        refresh_tab_interactions: layouts.application.agente?.cases?.refresh_tab_interactions ?? false,
        refresh_tab_notifications: layouts.application.agente?.cases?.refresh_tab_notifications ?? false,
        show_notifications: layouts.application.agente?.cases?.show_notifications ?? false,
        notifications_one_script_form: layouts.application.agente?.cases?.notifications_one_script_form || "",
    };
};
