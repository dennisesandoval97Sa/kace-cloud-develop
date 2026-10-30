import { describe, it, expect, vi } from "vitest";
import {
    blockNumericSignAndDecimalKeys,
    blockNumericSignAndDecimalPaste,
    blockNumericSignKeys,
    blockNumericSignPaste,
    getGeneralSetupErrorLabel,
    handleCreateObject,
    isReopenWindowUnlimited,
    mergeFormDataWithDefaults,
    transformDataToFormValues,
} from "./helpers";
import { INITIAL_VALUES_GLOBAL_SETUP, fieldLabels } from "./data/constants";
import es from "../../locale/es.json";
import en from "../../locale/en.json";

const buildSettings = (clientOverrides = {}) => ({
    layouts: {
        application: {
            admin: {
                cases: {
                    enable_custom_view: false,
                    custom_view_name: "",
                    cases_admin_refresh_min: "1",
                    visible_columns: [],
                },
                clients: {
                    tipo_documento: "",
                    documento: "",
                    nombres: "",
                    apellido1: "",
                    apellido2: "",
                    nombre_empresa: "",
                    sexo: "",
                    estado_civil: "",
                    fecha_nacimiento: "",
                    email: "",
                    email_alterno: "",
                    telefono: "",
                    telefono_alterno: "",
                    campos_extra1: "",
                    campos_extra2: "",
                    campos_extra3: "",
                    reference: "",
                    habeas_data: "",
                },
                classifications: {
                    label_1: "",
                    label_2: "",
                    label_3: "",
                    label_4: "",
                    label_5: "",
                    label_6: "",
                    label_7: "",
                    label_8: "",
                    label_9: "",
                    label_10: "",
                },
            },
            agente: {
                agent: {
                    my_cases: true,
                    show_boards: false,
                    enable_custom_view: false,
                    show_my_assigned_cases: true,
                    show_my_created_cases: true,
                    show_interactions: false,
                    show_agent_interactions: true,
                    show_case: false,
                    show_client: false,
                    show_transitions: false,
                    show_subcase: false,
                    show_client_data: true,
                    cases_agent_refresh_min: "1",
                },
                cases: {
                    express_cases: [],
                    show_event_log: false,
                    show_attachments: true,
                    show_description: true,
                    account_to_send_link: "",
                    template_to_send_link: "",
                    allow_client_send_attachments: true,
                    labelCases: null,
                    show_sheduler: null,
                    show_history: null,
                    case_client_form: null,
                    show_comment_tab: null,
                    show_subcases_button: true,
                    show_cases_button: true,
                    show_save_client_button: true,
                    show_new_client_button: true,
                    show_time_counter: true,
                    refresh_tab_case: false,
                    refresh_tab_customer: false,
                    refresh_tab_transitions: false,
                    refresh_tab_subcases: false,
                    refresh_tab_comments: false,
                    refresh_tab_agenda: true,
                    refresh_tab_logs: true,
                    refresh_tab_interactions: false,
                    show_notifications: true,
                    notifications_one_script_form: "form-uuid",
                    refresh_tab_notifications: true,
                },
                header: {
                    helps: true,
                    custom_logo: "",
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
                    fields_copy: {},
                    fields_edit: {},
                    custom_form_id: "form-uuid-123",
                    fields_max_min: {},
                    fields_required: {},
                    content_habeas_data: "",
                    get_list_field_to_show: true,
                    show_update_button: true,
                    show_aux_client_expanded: true,
                    hide_client_form: false,
                    ...clientOverrides,
                },
                calendar: { oneScript_calendar: "" },
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
                    campos_extra1_bool: false,
                    campos_extra2_bool: false,
                    campos_extra3_bool: false,
                },
                interactions: { enable_view_interaction: false },
            },
        },
    },
    behaviors: {
        application: {
            admin: {
                users: { inactivity_time: 30, warning_logout_time: 5 },
                groups: {},
                menus: { hidden_menus: [] },
            },
            agente: {
                casos: {
                    order_type: "asc",
                    folio_length: 4,
                    assign_strategy: "case_ans",
                    work_queue_sorting_rules: [],
                    assignLastResponsibleIgnoreDefault: false,
                    type_assignment: "cola_de_trabajo",
                    max_cases_per_user: 3,
                    case_enable_subcases: true,
                    semaphore_by_state_ans: false,
                    activeUsers_filter_bool: true,
                    activeUsers_filter_integration_bool: false,
                    case_require_state_change: false,
                    lock_case_description_edit: false,
                    reassignFilterActiveUsers: false,
                    reassignIncludeDefaultAssignees: false,
                    add_folio_to_external_code: false,
                    case_stale_check: false,
                    agent_filter_subcases_only: false,
                    allow_new_one_script_forms: true,
                    cases_one_script_base_form: "",
                    account_to_send_notifications: null,
                    allow_close_case_without_subcases: true,
                    due_date_for_ans_calculation: false,
                    allow_description_empty: false,
                },
                geolocation: {
                    geolocation_login_bool: false,
                    geolocation_client_search_bool: false,
                    geolocation_case_creation_bool: false,
                    geolocation_case_update_bool: false,
                    geolocation_client_creation_bool: false,
                    geolocation_client_update_bool: false,
                    geolocation_logout_bool: false,
                    geolocation_current_location_bool: false,
                    max_map_markers: 0,
                },
                files_extensions: {
                    maximun_size_allowed: 10,
                    quantity_files_allowed: 5,
                    allowed_file_extensions: [],
                },
                channel_hub: {
                    create_rules_channel_hub_flow_id: "",
                    account_channel_hub_flow_id: "",
                },
            },
        },
    },
    custom_fields: {
        application: {
            admin: {},
            agente: { flow_id: "", execute_ws_restflow: false },
        },
    },
});

describe("transformDataToFormValues", () => {
    it("maps notifications settings from API layouts cases", () => {
        const formValues = transformDataToFormValues(buildSettings(), "Config", true);

        expect(formValues.show_notifications).toBe(true);
        expect(formValues.notifications_one_script_form).toBe("form-uuid");
        expect(formValues.refresh_tab_notifications).toBe(true);
    });

    it("maps case and agent interactions toggles independently", () => {
        const formValues = transformDataToFormValues(buildSettings(), "Config", true);

        expect(formValues.show_interactions).toBe(false);
        expect(formValues.show_agent_interactions).toBe(true);
    });

    it("maps show_aux_client_expanded and hide_client_form as booleans from API settings", () => {
        const formValues = transformDataToFormValues(buildSettings(), "Config", true);

        expect(formValues.show_aux_client_expanded).toBe(true);
        expect(formValues.hide_client_form).toBe(false);
    });

    it("does not expose obsolete header.search_clients in form state", () => {
        const formValues = transformDataToFormValues(buildSettings(), "Config", true);

        expect(formValues).not.toHaveProperty("search_clients");
    });

    it("coerces truthy non-boolean API values to true", () => {
        const formValues = transformDataToFormValues(
            buildSettings({ show_aux_client_expanded: "true", hide_client_form: 1 }),
            "Config",
            true,
        );

        expect(formValues.show_aux_client_expanded).toBe(true);
        expect(formValues.hide_client_form).toBe(true);
    });

    it("carga assignment_active_session_limit desde agente/casos", () => {
        const settings = buildSettings();
        settings.behaviors.application.agente.casos.assignment_active_session_limit = 8;

        const formValues = transformDataToFormValues(settings, "Config", true);

        expect(formValues.assignment_active_session_limit).toBe(8);
    });

    it("cae a 2 cuando assignment_active_session_limit no está en la API", () => {
        const formValues = transformDataToFormValues(buildSettings(), "Config", true);

        expect(formValues.assignment_active_session_limit).toBe(2);
    });

    it("carga active_session_limit desde admin/users", () => {
        const settings = buildSettings();
        settings.behaviors.application.admin.users.active_session_limit = 45;

        const formValues = transformDataToFormValues(settings, "Config", true);

        expect(formValues.active_session_limit).toBe(45);
    });

    it("cae a 2 (no a 10) cuando active_session_limit no está en la API, alineado con el default que aplican los consumidores backend (KnexGroupsRepository, AssignationService)", () => {
        const formValues = transformDataToFormValues(buildSettings(), "Config", true);

        expect(formValues.active_session_limit).toBe(2);
    });

    it("does not expose obsolete hidden global Channel Hub REST flow values in form state", () => {
        const settings = buildSettings();
        settings.behaviors.application.agente.channel_hub = {
            create_rules_channel_hub_flow_id: "create-flow-id",
            account_channel_hub_flow_id: "account-flow-id",
        };

        const formValues = transformDataToFormValues(settings, "Config", true);

        expect(formValues).not.toHaveProperty("create_rules_channel_hub_flow_id");
        expect(formValues).not.toHaveProperty("account_channel_hub_flow_id");
        expect(formValues._channel_hub).toEqual({
            create_rules_channel_hub_flow_id: "create-flow-id",
            account_channel_hub_flow_id: "account-flow-id",
        });
    });

    it("maps visible_columns from API settings to admin_visible_columns", () => {
        const settings = buildSettings();
        const visibleColumns = [
            { column_name: "reference", header_label: "Consecutivo", cell_type: "default" },
            { column_name: "estadoactual", header_label: "Estado", cell_type: "estado" },
        ];
        settings.layouts.application.admin.cases.visible_columns = visibleColumns;

        const formValues = transformDataToFormValues(settings, "Config", true);

        expect(formValues.admin_visible_columns).toEqual(visibleColumns);
    });

    it("defaults admin_visible_columns to empty array when visible_columns is absent", () => {
        const settings = buildSettings();
        delete settings.layouts.application.admin.cases.visible_columns;

        const formValues = transformDataToFormValues(settings, "Config", true);

        expect(formValues.admin_visible_columns).toEqual([]);
    });

    it("maps show_columns_dropdown and headers_labels from API settings to form values", () => {
        const settings = buildSettings();
        settings.layouts.application.agente.cases.show_columns_dropdown = false;
        settings.layouts.application.agente.cases.headers_labels = [{ key: "reference", label: "Consecutivo" }];

        const formValues = transformDataToFormValues(settings, "Config", true);

        expect(formValues.show_columns_dropdown).toBe(false);
        expect(formValues.headers_labels).toEqual([{ key: "reference", label: "Consecutivo" }]);
    });

    it("defaults show_columns_dropdown to true and headers_labels to empty array when absent", () => {
        const settings = buildSettings();
        delete settings.layouts.application.agente.cases.show_columns_dropdown;
        delete settings.layouts.application.agente.cases.headers_labels;

        const formValues = transformDataToFormValues(settings, "Config", true);

        expect(formValues.show_columns_dropdown).toBe(true);
        expect(formValues.headers_labels).toEqual([]);
    });

    it("maps show_time_description_prefixes set to false from API settings to form values", () => {
        const settings = buildSettings();
        settings.layouts.application.agente.cases.show_time_description_prefixes = false;

        const formValues = transformDataToFormValues(settings, "Config", true);

        expect(formValues.show_time_description_prefixes).toBe(false);
    });

    it("defaults show_time_description_prefixes to true when absent", () => {
        const settings = buildSettings();

        const formValues = transformDataToFormValues(settings, "Config", true);

        expect(formValues.show_time_description_prefixes).toBe(true);
    });

    it("converts legacy object-shaped headers_labels to an array of key/label entries", () => {
        const settings = buildSettings();
        settings.layouts.application.agente.cases.headers_labels = {
            reference: "Consecutivo",
            estadoActual: "Estado",
        };

        const formValues = transformDataToFormValues(settings, "Config", true);

        expect(formValues.headers_labels).toEqual([
            { key: "reference", label: "Consecutivo" },
            { key: "estadoActual", label: "Estado" },
        ]);
    });

    it("maps case_stale_check from API settings when the key is present", () => {
        const settings = buildSettings();
        settings.behaviors.application.agente.casos.case_stale_check = true;

        const formValues = transformDataToFormValues(settings, "Config", true);

        expect(formValues.case_stale_check).toBe(true);
    });

    it("keeps case_stale_check null when the unified key is null so a save does not widen CAS", () => {
        const settings = buildSettings();
        settings.behaviors.application.agente.casos.case_stale_check = null;
        settings.behaviors.application.agente.casos.transition_stale_check = false;
        settings.behaviors.application.agente.casos.responsable_stale_check = true;

        const formValues = transformDataToFormValues(settings, "Config", true);

        expect(formValues.case_stale_check).toBeNull();
        expect(formValues.transition_stale_check).toBe(false);
        expect(formValues.responsable_stale_check).toBe(true);
    });

    it("keeps case_stale_check null when the unified key is absent", () => {
        const settings = buildSettings();
        delete settings.behaviors.application.agente.casos.case_stale_check;
        settings.behaviors.application.agente.casos.transition_stale_check = false;
        settings.behaviors.application.agente.casos.responsable_stale_check = true;

        const formValues = transformDataToFormValues(settings, "Config", true);

        expect(formValues.case_stale_check).toBeNull();
        expect(formValues.responsable_stale_check).toBe(true);
    });

    it("keeps case_stale_check null when the API omits the key and legacy flags", () => {
        const settings = buildSettings();
        delete settings.behaviors.application.agente.casos.case_stale_check;

        const formValues = transformDataToFormValues(settings, "Config", true);

        expect(formValues.case_stale_check).toBeNull();
        expect(formValues.transition_stale_check).toBe(false);
        expect(formValues.responsable_stale_check).toBe(false);
    });

    it("does not OR legacy flags when case_stale_check is explicitly false", () => {
        const settings = buildSettings();
        settings.behaviors.application.agente.casos.case_stale_check = false;
        settings.behaviors.application.agente.casos.transition_stale_check = true;
        settings.behaviors.application.agente.casos.responsable_stale_check = true;

        const formValues = transformDataToFormValues(settings, "Config", true);

        expect(formValues.case_stale_check).toBe(false);
    });
    it("maps reopen_cases_only_last_days from API settings", () => {
        const settings = buildSettings();
        settings.behaviors.application.agente.casos.reopen_cases_only_last_days = 30;

        const formValues = transformDataToFormValues(settings, "Config", true);

        expect(formValues.reopen_cases_only_last_days).toBe(30);
    });

    it("defaults reopen_cases_only_last_days to 7 when the API omits the key", () => {
        const settings = buildSettings();
        delete settings.behaviors.application.agente.casos.reopen_cases_only_last_days;

        const formValues = transformDataToFormValues(settings, "Config", true);

        expect(formValues.reopen_cases_only_last_days).toBe(7);
    });

    it("maps reopen_cases_only_last_days 0 from API settings", () => {
        const settings = buildSettings();
        settings.behaviors.application.agente.casos.reopen_cases_only_last_days = 0;

        const formValues = transformDataToFormValues(settings, "Config", true);

        expect(formValues.reopen_cases_only_last_days).toBe(0);
    });

    it("maps allow_case_reclassification from API settings", () => {
        const settings = buildSettings();
        settings.behaviors.application.agente.casos.allow_case_reclassification = true;

        const formValues = transformDataToFormValues(settings, "Config", true);

        expect(formValues.allow_case_reclassification).toBe(true);
    });

    it("leaves allow_case_reclassification falsy when the API omits the key", () => {
        const settings = buildSettings();

        const formValues = transformDataToFormValues(settings, "Config", true);

        expect(formValues.allow_case_reclassification).toBeFalsy();
    });

    it("maps my_agenda set to false from API settings", () => {
        const settings = buildSettings();
        settings.layouts.application.agente.header.my_agenda = false;

        const formValues = transformDataToFormValues(settings, "Config", true);

        expect(formValues.my_agenda).toBe(false);
    });

    it("defaults my_agenda to true when the saved header has no key, so legacy tenants keep the agenda", () => {
        const settings = buildSettings();

        const formValues = transformDataToFormValues(settings, "Config", true);

        expect(formValues.my_agenda).toBe(true);
    });

    it("keeps my_agenda true through mergeFormDataWithDefaults, which coerces undefined booleans to false", () => {
        const settings = buildSettings();

        const merged = mergeFormDataWithDefaults(transformDataToFormValues(settings, "Config", true));

        expect(merged.my_agenda).toBe(true);
    });
});

describe("handleCreateObject", () => {
    it("persists notifications_one_script_form when show_notifications is true", () => {
        const result = handleCreateObject({
            show_notifications: true,
            notifications_one_script_form: "form-uuid",
            refresh_tab_notifications: true,
        });

        const cases = result.layouts.application.agente.cases;
        expect(cases.show_notifications).toBe(true);
        expect(cases.notifications_one_script_form).toBe("form-uuid");
        expect(cases.refresh_tab_notifications).toBe(true);
    });

    it("persists case and agent interactions toggles independently in the agent layout", () => {
        const result = handleCreateObject({
            show_interactions: true,
            show_agent_interactions: false,
        });

        const agent = result.layouts.application.agente.agent;
        expect(agent.show_interactions).toBe(true);
        expect(agent.show_agent_interactions).toBe(false);
    });

    it("clears notifications_one_script_form when show_notifications is false", () => {
        const result = handleCreateObject({
            show_notifications: false,
            notifications_one_script_form: "form-uuid",
            refresh_tab_notifications: false,
        });

        const cases = result.layouts.application.agente.cases;
        expect(cases.show_notifications).toBe(false);
        expect(cases.notifications_one_script_form).toBe("");
        expect(cases.refresh_tab_notifications).toBe(false);
    });

    it("guarda assignment_active_session_limit dentro de agente/casos", () => {
        const result = handleCreateObject({
            assignment_active_session_limit: 8,
        });

        expect(result.behaviors.application.agente.casos.assignment_active_session_limit).toBe(8);
    });

    it("does not persist obsolete hidden global Channel Hub REST flow settings", () => {
        const result = handleCreateObject({
            create_rules_channel_hub_flow_id: "create-flow-id",
            account_channel_hub_flow_id: "account-flow-id",
        });

        expect(result.behaviors.application.agente).not.toHaveProperty("channel_hub");
    });

    it("preserves existing hidden Channel Hub REST flow settings when saving other General Setup fields", () => {
        const result = handleCreateObject({
            _channel_hub: {
                create_rules_channel_hub_flow_id: "create-flow-id",
                account_channel_hub_flow_id: "account-flow-id",
            },
        });

        expect(result.behaviors.application.agente.channel_hub).toEqual({
            create_rules_channel_hub_flow_id: "create-flow-id",
            account_channel_hub_flow_id: "account-flow-id",
        });
    });

    it("persists admin_visible_columns when provided", () => {
        const visibleColumns = [
            { column_name: "reference", header_label: "Consecutivo", cell_type: "default" },
            { column_name: "estadoactual", header_label: "Estado", cell_type: "estado" },
        ];
        const result = handleCreateObject({
            admin_visible_columns: visibleColumns,
        });

        const cases = result.layouts.application.admin.cases;
        expect(cases.visible_columns).toEqual(visibleColumns);
    });

    it("defaults visible_columns to empty array when admin_visible_columns is absent", () => {
        const result = handleCreateObject({});

        const cases = result.layouts.application.admin.cases;
        expect(cases.visible_columns).toEqual([]);
    });

    it("writes show_columns_dropdown and headers_labels defaults to layouts.application.agente.cases", () => {
        const result = handleCreateObject({ ...INITIAL_VALUES_GLOBAL_SETUP });

        const cases = result.layouts.application.agente.cases;
        expect(cases.show_columns_dropdown).toBe(true);
        expect(cases.headers_labels).toEqual([]);
    });

    it("writes show_time_description_prefixes set to false to layouts.application.agente.cases", () => {
        const result = handleCreateObject({ ...INITIAL_VALUES_GLOBAL_SETUP, show_time_description_prefixes: false });

        expect(result.layouts.application.agente.cases.show_time_description_prefixes).toBe(false);
    });

    it("writes headers_labels entries to layouts.application.agente.cases", () => {
        const result = handleCreateObject({
            ...INITIAL_VALUES_GLOBAL_SETUP,
            headers_labels: [{ key: "reference", label: "Consecutivo" }],
        });

        const cases = result.layouts.application.agente.cases;
        expect(cases.headers_labels).toEqual([{ key: "reference", label: "Consecutivo" }]);
    });

    it("persists case_stale_check in agente/casos without legacy stale-check keys", () => {
        const result = handleCreateObject({
            case_stale_check: true,
        });

        expect(result.behaviors.application.agente.casos.case_stale_check).toBe(true);
        expect(result.behaviors.application.agente.casos).not.toHaveProperty("transition_stale_check");
        expect(result.behaviors.application.agente.casos).not.toHaveProperty("responsable_stale_check");
    });

    it("omits case_stale_check while the checkbox has not been touched", () => {
        const result = handleCreateObject({
            case_stale_check: null,
        });

        expect(result.behaviors.application.agente.casos).not.toHaveProperty("case_stale_check");
        expect(result.behaviors.application.agente.casos).not.toHaveProperty("transition_stale_check");
        expect(result.behaviors.application.agente.casos).not.toHaveProperty("responsable_stale_check");
    });

    it("persists reopen_cases_only_last_days in agente/casos", () => {
        const result = handleCreateObject({
            reopen_cases_only_last_days: 0,
        });

        expect(result.behaviors.application.agente.casos.reopen_cases_only_last_days).toBe(0);
    });

    it("persists reopen_cases_only_last_days as a number when Formik sends a string", () => {
        const result = handleCreateObject({
            reopen_cases_only_last_days: "10",
        });

        expect(result.behaviors.application.agente.casos.reopen_cases_only_last_days).toBe(10);
    });

    it("persists allow_case_reclassification in agente/casos", () => {
        const result = handleCreateObject({
            allow_case_reclassification: true,
        });

        expect(result.behaviors.application.agente.casos.allow_case_reclassification).toBe(true);
    });

    it("does not persist obsolete header.search_clients from form values", () => {
        const result = handleCreateObject({
            ...INITIAL_VALUES_GLOBAL_SETUP,
            search_clients: false,
        });

        expect(result.layouts.application.agente.header).not.toHaveProperty("search_clients");
        expect(result.layouts.application.agente.search_clients).toEqual(expect.any(Object));
    });

    it("persists my_agenda in the agent header layout", () => {
        const result = handleCreateObject({ ...INITIAL_VALUES_GLOBAL_SETUP, my_agenda: false });

        expect(result.layouts.application.agente.header.my_agenda).toBe(false);
    });
});

describe("isReopenWindowUnlimited", () => {
    it("is true for 0 and string 0", () => {
        expect(isReopenWindowUnlimited(0)).toBe(true);
        expect(isReopenWindowUnlimited("0")).toBe(true);
    });

    it("is false for 7, empty and null", () => {
        expect(isReopenWindowUnlimited(7)).toBe(false);
        expect(isReopenWindowUnlimited("")).toBe(false);
        expect(isReopenWindowUnlimited(null)).toBe(false);
    });
});

describe("reopen window i18n", () => {
    it("explains zero in es and en labels", () => {
        const esLabels = es.generalSetup.form.labels;
        const enLabels = en.generalSetup.form.labels;

        expect(esLabels.reopen_cases_only_last_days_hint).toEqual(expect.any(String));
        expect(esLabels.reopen_cases_only_last_days_zero).toEqual(expect.any(String));
        expect(enLabels.reopen_cases_only_last_days_hint).toEqual(expect.any(String));
        expect(enLabels.reopen_cases_only_last_days_zero).toEqual(expect.any(String));
        expect(esLabels.reopen_cases_only_last_days_hint.length).toBeGreaterThan(0);
        expect(enLabels.reopen_cases_only_last_days_hint.length).toBeGreaterThan(0);
        expect(esLabels.reopen_cases_only_last_days_hint).toMatch(/grupo activo/i);
        expect(enLabels.reopen_cases_only_last_days_hint).toMatch(/active group/i);
    });
});

describe("my agenda i18n", () => {
    it("labels the my_agenda toggle in es and en", () => {
        const esLabels = es.generalSetup.form.labels;
        const enLabels = en.generalSetup.form.labels;

        expect(esLabels.my_agenda).toEqual(expect.any(String));
        expect(enLabels.my_agenda).toEqual(expect.any(String));
        expect(esLabels.my_agenda.length).toBeGreaterThan(0);
        expect(enLabels.my_agenda.length).toBeGreaterThan(0);
    });
});

describe("mergeFormDataWithDefaults", () => {
    it("starts from INITIAL_VALUES and preserves true booleans from API data", () => {
        const apiFormValues = transformDataToFormValues(buildSettings(), "Config", true);
        const merged = mergeFormDataWithDefaults(apiFormValues);

        expect(merged.show_aux_client_expanded).toBe(true);
        expect(merged.hide_client_form).toBe(false);
        expect(merged.custom_form_id).toBe("form-uuid-123");
        expect(merged.description).toBe("Config");
    });

    it("returns full defaults when data is null", () => {
        const merged = mergeFormDataWithDefaults(null);

        expect(merged).toEqual({ ...INITIAL_VALUES_GLOBAL_SETUP });
    });

    it("coerces boolean fields when merging partial API data", () => {
        const merged = mergeFormDataWithDefaults({
            show_aux_client_expanded: "true",
            hide_client_form: 0,
        });

        expect(merged.show_aux_client_expanded).toBe(true);
        expect(merged.hide_client_form).toBe(false);
    });
});

describe("blockNumericSignAndDecimalKeys", () => {
    const keyDown = (key) => ({ key, preventDefault: vi.fn() });

    it.each(["-", "e", "E", "+", "."])("prevents typing %s", (key) => {
        const event = keyDown(key);
        blockNumericSignAndDecimalKeys(event);
        expect(event.preventDefault).toHaveBeenCalled();
    });

    it.each(["1", "0", "Backspace"])("lets %s through", (key) => {
        const event = keyDown(key);
        blockNumericSignAndDecimalKeys(event);
        expect(event.preventDefault).not.toHaveBeenCalled();
    });
});

describe("blockNumericSignAndDecimalPaste", () => {
    const paste = (text) => ({ clipboardData: { getData: () => text }, preventDefault: vi.fn() });

    it.each(["-3", "2.5", "1e3", "+4"])("prevents pasting %s", (text) => {
        const event = paste(text);
        blockNumericSignAndDecimalPaste(event);
        expect(event.preventDefault).toHaveBeenCalled();
    });

    it("lets a plain integer through", () => {
        const event = paste("25");
        blockNumericSignAndDecimalPaste(event);
        expect(event.preventDefault).not.toHaveBeenCalled();
    });
});

describe("blockNumericSignKeys", () => {
    const keyDown = (key) => ({ key, preventDefault: vi.fn() });

    it.each(["-", "e", "E", "+"])("prevents typing %s", (key) => {
        const event = keyDown(key);
        blockNumericSignKeys(event);
        expect(event.preventDefault).toHaveBeenCalled();
    });

    it.each([".", "1", "Backspace"])("lets %s through", (key) => {
        const event = keyDown(key);
        blockNumericSignKeys(event);
        expect(event.preventDefault).not.toHaveBeenCalled();
    });
});

describe("blockNumericSignPaste", () => {
    const paste = (text) => ({ clipboardData: { getData: () => text }, preventDefault: vi.fn() });

    it.each(["-3", "1e3", "+4"])("prevents pasting %s", (text) => {
        const event = paste(text);
        blockNumericSignPaste(event);
        expect(event.preventDefault).toHaveBeenCalled();
    });

    it("lets a decimal through", () => {
        const event = paste("0.5");
        blockNumericSignPaste(event);
        expect(event.preventDefault).not.toHaveBeenCalled();
    });
});

describe("client form char limits mapping", () => {
    const charLimitKeys = fieldLabels.flatMap((field) => [`field_${field}_min`, `field_${field}_max`]);
    const charLimitValues = Object.fromEntries(charLimitKeys.map((key, index) => [key, index]));

    it("persists every client field min and max in fields_max_min", () => {
        const result = handleCreateObject(charLimitValues);

        expect(result.layouts.application.agente.clients.fields_max_min).toEqual(charLimitValues);
    });

    it("loads every client field min and max from fields_max_min into the form", () => {
        const formValues = transformDataToFormValues(
            buildSettings({ fields_max_min: charLimitValues }),
            "Config",
            true,
        );

        charLimitKeys.forEach((key) => expect.soft(formValues[key]).toBe(charLimitValues[key]));
    });

    it("starts every client field min and max empty in the initial values", () => {
        charLimitKeys.forEach((key) => expect.soft(INITIAL_VALUES_GLOBAL_SETUP[key]).toBe(""));
    });

    it("leaves the form limits undefined when fields_max_min is missing", () => {
        const formValues = transformDataToFormValues(buildSettings({ fields_max_min: undefined }), "Config", true);

        charLimitKeys.forEach((key) => expect.soft(formValues[key]).toBeUndefined());
    });
});

describe("getGeneralSetupErrorLabel", () => {
    const labels = es.generalSetup.form.labels;
    const t = (key, fallback) => labels[key.replace("generalSetup.form.labels.", "")] ?? fallback;

    it.each([
        ["field_documento_max", "Documento (Máx.)"],
        ["field_tipo_documento_min", "Tipo de documento (Mín.)"],
    ])("labels the char limit error %s with its field and bound", (key, expected) => {
        expect(getGeneralSetupErrorLabel(key, t)).toBe(expected);
    });

    it("keeps the plain label lookup for other form fields", () => {
        expect(getGeneralSetupErrorLabel("inactivity_time", t)).toBe(labels.inactivity_time);
    });

    it("falls back to the raw key for a field_*_max key outside the client fields", () => {
        expect(getGeneralSetupErrorLabel("field_unknown_max", t)).toBe("field_unknown_max");
    });
});
