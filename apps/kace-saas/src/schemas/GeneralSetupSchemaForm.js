import Joi from "joi";
import { JoiHelper } from "@/utils/src/utils/joi.helper";
import {
    ACTIVE_SESSION_LIMIT_RANGE,
    REPORT_FILTER_DAYS_RANGE,
} from "@kace/core/src/global-config/domain/settings/behaviorNumericRanges.js";
import {
    CHAR_LIMIT_KEY_PATTERN,
    charLimitKey,
    getCharLimitIssue,
    isMaxBelowMin,
    parseCharLimitKey,
} from "@kace/core/src/global-config/domain/settings/clientFieldCharLimits.js";

const warningLogoutTimeValidator = (value, helpers) => {
    if (value === 0) {
        return 0;
    }

    if (typeof value !== "number" || Number.isNaN(value)) {
        return helpers.error("number.base");
    }

    if (!Number.isInteger(value)) {
        return helpers.error("number.integer");
    }

    if (value > 60) {
        return helpers.error("number.max", { limit: 60 });
    }

    if (value < 1) {
        return helpers.error("number.min", { limit: 1 });
    }

    const inactivityTime = helpers.state.ancestors[0]?.inactivity_time;
    const inactivityIsValid =
        typeof inactivityTime === "number" && !Number.isNaN(inactivityTime) && Number.isInteger(inactivityTime);

    if (inactivityIsValid && value >= inactivityTime) {
        return helpers.error("users.warning_logout_must_be_less_than_inactivity");
    }

    return value;
};

export const generalSetupSessionTimingShape = {
    inactivity_time: JoiHelper.integer({ min: 1, max: 480 }).required().messages({
        "any.required": "any.required",
    }),
    warning_logout_time: Joi.number().required().custom(warningLogoutTimeValidator).messages({
        "any.required": "any.required",
        "number.base": "number.base",
        "number.integer": "number.integer",
        "number.min": "number.min",
        "number.max": "number.max",
        "users.warning_logout_must_be_less_than_inactivity": "users.warning_logout_must_be_less_than_inactivity",
    }),
};

const CHAR_LIMIT_ERROR_CODES = {
    not_a_number: "number.base",
    not_integer: "number.integer",
    negative: "number.min",
};

const charLimitValidator = (value, helpers) => {
    const issue = getCharLimitIssue(value);

    if (issue) {
        return helpers.error(CHAR_LIMIT_ERROR_CODES[issue], { limit: 0 });
    }

    const { field, bound } = parseCharLimitKey(helpers.state.path.at(-1)) ?? {};

    if (bound !== "max") {
        return value;
    }

    if (isMaxBelowMin(helpers.state.ancestors[0]?.[charLimitKey(field, "min")], value)) {
        return helpers.error("generalSetup.max_must_not_be_less_than_min");
    }

    return value;
};

// English fallbacks for direct Joi use; joiFormikAdapter translates by error type
export const clientCharLimitSchema = Joi.any().custom(charLimitValidator).messages({
    "number.base": "{{#label}} must be a number",
    "number.integer": "{{#label}} must be an integer",
    "number.min": "{{#label}} must be greater than or equal to {{#limit}}",
    "generalSetup.max_must_not_be_less_than_min": "{{#label}} must not be less than its min",
});

export const reopenCasesOnlyLastDaysSchema = JoiHelper.integer({ min: 0, max: 36500 }).default(7);

export const GeneralSetupSchemaForm = Joi.object({
    description: JoiHelper.legacyText({ min: 3, max: 150 }).required(),
    is_active: JoiHelper.boolean().default(false),
    allow_description_empty: JoiHelper.boolean().default(false),
    case_require_state_change: JoiHelper.boolean().default(false),
    lock_case_description_edit: JoiHelper.boolean().default(false),
    allow_case_reclassification: JoiHelper.boolean().default(false),
    type_assignment: Joi.string().optional().default(""),
    custom_logo: JoiHelper.legacyText({ min: 3, max: 250 }).optional().default(""),
    high_impact_fields: JoiHelper.boolean().default(false),
    helps: JoiHelper.boolean().default(false),
    total_cases_by_ans: JoiHelper.boolean().default(false),
    ans_display_mode: Joi.string().valid("row", "circle").default("row"),
    my_agenda: JoiHelper.boolean().default(true),
    client_data: JoiHelper.boolean().default(false),
    habeasData: JoiHelper.boolean().default(false),
    content_habeas_data: JoiHelper.legacyText({ min: 3, max: 50 }).optional().default(""),
    open_cases: JoiHelper.boolean().default(false),
    close_cases: JoiHelper.boolean().default(false),
    show_update_button: JoiHelper.boolean().default(true),
    custom_form_id: JoiHelper.generalText({ min: 3, max: 50 }).optional().default(""),
    get_list_field_to_show: JoiHelper.boolean().default(false),
    show_my_assigned_cases: JoiHelper.boolean().default(false),
    show_my_created_cases: JoiHelper.boolean().default(false),
    enable_custom_view: JoiHelper.boolean().default(false),
    enable_admin_custom_view: JoiHelper.boolean().default(false),
    admin_custom_view_name: Joi.string().when("enable_admin_custom_view", {
        is: true,
        then: Joi.string().required(),
        otherwise: Joi.string().optional().default(""),
    }),
    admin_visible_columns: Joi.array()
        .items(
            Joi.object({
                column_name: Joi.string().required(),
                header_label: Joi.string().required(),
                cell_type: Joi.string().valid("default", "clasificacion", "estado").required(),
                separator: Joi.string().optional(),
            }),
        )
        .default([]),
    show_description: JoiHelper.boolean().default(false),
    show_attachments: JoiHelper.boolean().default(false),
    allow_client_send_attachments: JoiHelper.boolean().default(false),
    show_sheduler: JoiHelper.boolean().default(false),
    show_history: JoiHelper.boolean().default(false),
    account_to_send_link: JoiHelper.generalText({ min: 3, max: 50 }).optional().default(""),
    case_client_form: JoiHelper.generalText({ min: 3 }).optional().default(""),
    template_to_send_link: JoiHelper.generalText({ min: 3, max: 50 }).optional().default(""),
    label_1: JoiHelper.generalText({ min: 3, max: 50 }).required(),
    label_2: JoiHelper.generalText({ min: 3, max: 50 }).required(),
    label_3: JoiHelper.generalText({ min: 3, max: 50 }).required(),
    label_4: JoiHelper.generalText({ min: 3, max: 50 }).required(),
    label_5: JoiHelper.generalText({ min: 3, max: 50 }).required(),
    label_6: JoiHelper.generalText({ min: 3, max: 50 }).required(),
    label_7: JoiHelper.generalText({ min: 3, max: 50 }).required(),
    label_8: JoiHelper.generalText({ min: 3, max: 50 }).required(),
    label_9: JoiHelper.generalText({ min: 3, max: 50 }).required(),
    label_10: JoiHelper.generalText({ min: 3, max: 50 }).required(),
    tipo_documento: JoiHelper.generalText({ min: 3, max: 50 }).required(),
    documento: JoiHelper.generalText({ min: 3, max: 50 }).required(),
    nombres: JoiHelper.generalText({ min: 3, max: 50 }).required(),
    apellido1: JoiHelper.generalText({ min: 3, max: 50 }).required(),
    apellido2: JoiHelper.generalText({ min: 3, max: 50 }).required(),
    nombre_empresa: JoiHelper.generalText({ min: 3, max: 50 }).required(),
    sexo: JoiHelper.generalText({ min: 3, max: 50 }).required(),
    estado_civil: JoiHelper.generalText({ min: 3, max: 50 }).required(),
    fecha_nacimiento: JoiHelper.generalText({ min: 3, max: 50 }).required(),
    email: JoiHelper.generalText({ min: 3, max: 50 }).required(),
    email_alterno: JoiHelper.generalText({ min: 3, max: 50 }).required(),
    telefono: JoiHelper.generalText({ min: 3, max: 50 }).required(),
    telefono_alterno: JoiHelper.generalText({ min: 3, max: 50 }).required(),
    campos_extra1: JoiHelper.generalText({ min: 3, max: 50 }).optional().default(""),
    campos_extra2: JoiHelper.generalText({ min: 3, max: 50 }).optional().default(""),
    campos_extra3: JoiHelper.generalText({ min: 3, max: 50 }).optional().default(""),
    reference: JoiHelper.generalText({ min: 3, max: 50 }).required(),
    habeas_data: JoiHelper.generalText({ min: 3, max: 50 }).required(),
    tipo_documento_bool: JoiHelper.boolean().default(false),
    documento_bool: JoiHelper.boolean().default(false),
    nombres_bool: JoiHelper.boolean().default(false),
    apellido1_bool: JoiHelper.boolean().default(false),
    apellido2_bool: JoiHelper.boolean().default(false),
    nombre_empresa_bool: JoiHelper.boolean().default(false),
    sexo_bool: JoiHelper.boolean().default(false),
    estado_civil_bool: JoiHelper.boolean().default(false),
    fecha_nacimiento_bool: JoiHelper.boolean().default(false),
    email_bool: JoiHelper.boolean().default(false),
    email_alterno_bool: JoiHelper.boolean().default(false),
    telefono_bool: JoiHelper.boolean().default(false),
    telefono_alterno_bool: JoiHelper.boolean().default(false),
    campos_extra1_bool: JoiHelper.boolean().default(false),
    campos_extra2_bool: JoiHelper.boolean().default(false),
    campos_extra3_bool: JoiHelper.boolean().default(false),
    reference_bool: JoiHelper.boolean().default(false),
    geolocation_login: JoiHelper.boolean().default(false),
    geolocation_client_search: JoiHelper.boolean().default(false),
    geolocation_case_creation: JoiHelper.boolean().default(false),
    geolocation_case_update: JoiHelper.boolean().default(false),
    geolocation_client_creation: JoiHelper.boolean().default(false),
    geolocation_logout: JoiHelper.boolean().default(false),
    geolocation_current_location: JoiHelper.boolean().default(false),
    max_map_markers: JoiHelper.integer({ min: 5, max: 50 }).allow(null).default(50),
    labelCases: JoiHelper.legacyText({ min: 3, max: 50 }).optional().default(""),
    oneScript_calendar: JoiHelper.generalText({ min: 3, max: 50 }).optional().default(""),
    onescript_cache_ttl_ms: Joi.number().integer().min(0).optional().default(0),
    field_tipo_documento: JoiHelper.boolean().default(false),
    field_documento: JoiHelper.boolean().default(false),
    field_nombres: JoiHelper.boolean().default(false),
    field_apellido1: JoiHelper.boolean().default(false),
    field_apellido2: JoiHelper.boolean().default(false),
    field_nombre_empresa: JoiHelper.boolean().default(false),
    field_sexo: JoiHelper.boolean().default(false),
    field_estado_civil: JoiHelper.boolean().default(false),
    field_fecha_nacimiento: JoiHelper.boolean().default(false),
    field_email: JoiHelper.boolean().default(false),
    field_email_alterno: JoiHelper.boolean().default(false),
    field_telefono: JoiHelper.boolean().default(false),
    field_telefono_alterno: JoiHelper.boolean().default(false),
    field_campos_extra1: JoiHelper.boolean().default(false),
    field_campos_extra2: JoiHelper.boolean().default(false),
    field_campos_extra3: JoiHelper.boolean().default(false),
    field_tipo_documento_edit: JoiHelper.boolean().default(false),
    field_documento_edit: JoiHelper.boolean().default(false),
    field_nombres_edit: JoiHelper.boolean().default(false),
    field_apellido1_edit: JoiHelper.boolean().default(false),
    field_apellido2_edit: JoiHelper.boolean().default(false),
    field_nombre_empresa_edit: JoiHelper.boolean().default(false),
    field_sexo_edit: JoiHelper.boolean().default(false),
    field_estado_civil_edit: JoiHelper.boolean().default(false),
    field_fecha_nacimiento_edit: JoiHelper.boolean().default(false),
    field_email_edit: JoiHelper.boolean().default(false),
    field_email_alterno_edit: JoiHelper.boolean().default(false),
    field_telefono_edit: JoiHelper.boolean().default(false),
    field_telefono_alterno_edit: JoiHelper.boolean().default(false),
    field_campos_extra1_edit: JoiHelper.boolean().default(false),
    field_campos_extra2_edit: JoiHelper.boolean().default(false),
    field_campos_extra3_edit: JoiHelper.boolean().default(false),
    due_date_for_ans_calculation: JoiHelper.boolean().default(false),
    case_enable_subcases: JoiHelper.boolean().default(false),
    allow_close_case_without_subcases: JoiHelper.boolean().default(false),
    semaphore_by_state_ans: JoiHelper.boolean().default(false),
    allow_new_one_script_forms: JoiHelper.boolean().default(false),
    cases_one_script_base_form: JoiHelper.legacyText().when("allow_new_one_script_forms", {
        is: true,
        then: JoiHelper.legacyText().required(),
        otherwise: JoiHelper.legacyText().optional().default(""),
    }),
    case_restrict_close_with_subcases: JoiHelper.boolean().default(false),
    execute_ws_restflow: JoiHelper.boolean().default(false),
    flow_id: JoiHelper.uuid().optional().default(""),
    max_cases_per_user: JoiHelper.integer().allow(null).optional().default(null),
    activeUsers_filter_bool: JoiHelper.boolean().default(false),
    activeUsers_filter_integration_bool: JoiHelper.boolean().default(false),
    add_folio_to_external_code: JoiHelper.boolean().default(false),
    folio_length: JoiHelper.integer().min(1).max(100).allow(null).optional().default(null),
    reopen_cases_only_last_days: reopenCasesOnlyLastDaysSchema,
    assignLastResponsibleIgnoreDefault: JoiHelper.boolean().default(false),
    case_stale_check: JoiHelper.boolean().allow(null),
    transition_stale_check: JoiHelper.boolean().optional(),
    responsable_stale_check: JoiHelper.boolean().optional(),
    work_queue_sorting_rules: Joi.array()
        .items(
            Joi.object({
                id: Joi.alternatives().try(Joi.string(), Joi.number()).optional(),
                assign_strategy: Joi.string().required(),
                cast_type: Joi.string().valid("int", "date", "epoch", "other").required(),
                order_type: Joi.string()
                    .valid(
                        "ASC",
                        "DESC",
                        "ASC NULLS FIRST",
                        "DESC NULLS LAST",
                        "asc",
                        "desc",
                        "asc_nulls_first",
                        "desc_nulls_last",
                    )
                    .required(),
            }),
        )
        .optional()
        .default([]),
    agent_filter_subcases_only: JoiHelper.boolean().default(false),
    close_tab_on_case_created: JoiHelper.boolean().default(false),
    return_to_board_on_case_saved: JoiHelper.boolean().default(false),
    show_comment_tab: JoiHelper.boolean().default(false),
    show_subcases_button: JoiHelper.boolean().default(false),
    show_cases_button: JoiHelper.boolean().default(false),
    show_interactions: JoiHelper.boolean().default(false),
    show_agent_interactions: JoiHelper.boolean().default(false),
    show_save_client_button: JoiHelper.boolean().default(false),
    show_new_client_button: JoiHelper.boolean().default(false),
    show_aux_client_expanded: JoiHelper.boolean().default(false),
    hide_client_form: JoiHelper.boolean().default(false),
    show_case: JoiHelper.boolean().default(false),
    show_client: JoiHelper.boolean().default(false),
    show_transitions: JoiHelper.boolean().default(false),
    show_subcase: JoiHelper.boolean().default(false),
    show_event_log: JoiHelper.boolean().default(false),
    show_notifications: JoiHelper.boolean().default(false),
    notifications_one_script_form: JoiHelper.legacyText().when("show_notifications", {
        is: true,
        then: JoiHelper.legacyText().required(),
        otherwise: JoiHelper.legacyText().optional().default(""),
    }),
    hidden_menus: Joi.array().items(Joi.string()).optional().default([]),
    show_time_counter: JoiHelper.boolean().default(true),
    group_membership_check_interval: JoiHelper.integer().min(0).allow(null).optional().default(0),
    /*
     * Optional with a default so the schema stays composable for partial payloads.
     * The form always supplies a value (INITIAL_VALUES_GLOBAL_SETUP / transformDataToFormValues),
     * and the domain rejects an out-of-range value on save, so `.default(2)` only matters
     * for direct schema validation, never for the Formik adapter path.
     */
    active_session_limit: JoiHelper.integer(ACTIVE_SESSION_LIMIT_RANGE).default(2),
    assignment_active_session_limit: JoiHelper.integer(ACTIVE_SESSION_LIMIT_RANGE).default(2),
    refresh_tab_case: JoiHelper.boolean().default(false),
    refresh_tab_customer: JoiHelper.boolean().default(false),
    refresh_tab_transitions: JoiHelper.boolean().default(false),
    refresh_tab_subcases: JoiHelper.boolean().default(false),
    refresh_tab_comments: JoiHelper.boolean().default(false),
    refresh_tab_agenda: JoiHelper.boolean().default(true),
    refresh_tab_logs: JoiHelper.boolean().default(true),
    refresh_tab_interactions: JoiHelper.boolean().default(false),
    refresh_tab_notifications: JoiHelper.boolean().default(false),
    report_filter_days: JoiHelper.integer(REPORT_FILTER_DAYS_RANGE).default(1),
    show_columns_dropdown: JoiHelper.boolean().default(true),
    show_time_description_prefixes: JoiHelper.boolean().default(true),
    headers_labels: Joi.array()
        .items(
            Joi.object({
                key: Joi.string().min(1).max(200),
                label: Joi.string().min(1).max(200),
            }),
        )
        .default([]),
    ...generalSetupSessionTimingShape,
})
    .pattern(CHAR_LIMIT_KEY_PATTERN, clientCharLimitSchema)
    .strict();
