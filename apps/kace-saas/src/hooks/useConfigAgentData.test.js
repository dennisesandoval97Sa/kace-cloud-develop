import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("@tanstack/react-query", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        useQueryClient: vi.fn(),
    };
});

vi.mock("./useGenericViewQuery", () => ({
    default: vi.fn(),
}));

import { useQueryClient } from "@tanstack/react-query";
import useGenericViewQuery from "./useGenericViewQuery";
import useConfigAgentData from "./useConfigAgentData";

const makeSettings = (adminCasesOverride = {}) => ({
    layouts: {
        application: {
            admin: {
                cases: {
                    enable_custom_view: false,
                    custom_view_name: "",
                    cases_admin_refresh_min: "1",
                    visible_columns: [],
                    ...adminCasesOverride,
                },
                clients: {},
                classifications: {},
            },
            agente: {
                agent: {
                    my_cases: true,
                    show_boards: false,
                    enable_custom_view: false,
                    show_my_assigned_cases: true,
                    show_my_created_cases: true,
                    show_interactions: false,
                    show_case: false,
                    show_client: false,
                    show_transitions: false,
                    show_subcase: false,
                    show_client_data: true,
                    cases_agent_refresh_min: "1",
                    show_cases_button: false,
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
                    show_notifications: false,
                    notifications_one_script_form: "",
                    refresh_tab_case: false,
                    refresh_tab_customer: false,
                    refresh_tab_transitions: false,
                    refresh_tab_subcases: false,
                    refresh_tab_comments: false,
                    refresh_tab_agenda: true,
                    refresh_tab_logs: true,
                    refresh_tab_interactions: false,
                    refresh_tab_notifications: false,
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
                    custom_form_id: "",
                    fields_max_min: {},
                    fields_required: {},
                    content_habeas_data: "",
                    get_list_field_to_show: true,
                    show_update_button: true,
                    show_aux_client_expanded: false,
                    hide_client_form: false,
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
            agente: {
                casos: {
                    order_type: "",
                    max_cases_per_user: 3,
                    case_enable_subcases: false,
                    show_number_subcases: false,
                    agent_filter_subcases_only: false,
                    close_tab_on_case_created: false,
                    assign_strategy: "",
                    reassignFilterActiveUsers: false,
                    reassignActiveUsersTimeFrame: false,
                    work_queue_sorting_rules: [],
                    assignLastResponsibleIgnoreDefault: false,
                    cases_one_script_base_form: "",
                    allow_close_case_without_subcases: false,
                    allow_reopen_cases: false,
                },
                geolocation: { geolocation_login_bool: false },
                files_extensions: {
                    allowed_file_extensions: [],
                    maximun_size_allowed: 0,
                    quantity_files_allowed: 0,
                },
                onescript: { onescript_cache_ttl_ms: 0 },
            },
            admin: {
                users: { inactivity_time: 30, warning_logout_time: 5 },
                groups: {},
                menus: { hidden_menus: [] },
            },
        },
    },
});

beforeEach(() => {
    vi.clearAllMocks();
    useQueryClient.mockReturnValue({
        getQueryData: vi.fn().mockReturnValue({}),
    });
});

describe("useConfigAgentData — adminVisibleColumns", () => {
    it("returns adminVisibleColumns from visible_columns when present", () => {
        useGenericViewQuery.mockReturnValue({
            data: { settings: makeSettings({ visible_columns: ["reference", "estadoactual"] }) },
            isLoading: false,
            isFetching: false,
        });

        const { result } = renderHook(() => useConfigAgentData());

        expect(result.current.adminVisibleColumns).toEqual(["reference", "estadoactual"]);
    });

    it("returns empty array when visible_columns is absent", () => {
        const settings = makeSettings();
        delete settings.layouts.application.admin.cases.visible_columns;

        useGenericViewQuery.mockReturnValue({
            data: { settings },
            isLoading: false,
            isFetching: false,
        });

        const { result } = renderHook(() => useConfigAgentData());

        expect(result.current.adminVisibleColumns).toEqual([]);
    });

    it("returns empty array when data is null", () => {
        useGenericViewQuery.mockReturnValue({
            data: null,
            isLoading: false,
            isFetching: false,
        });

        const { result } = renderHook(() => useConfigAgentData());

        expect(result.current.adminVisibleColumns).toEqual([]);
    });
});

describe("useConfigAgentData — active_session_limit default", () => {
    it("falls back to 2 minutes when active_session_limit is absent from the API settings", () => {
        const settings = makeSettings();
        delete settings.behaviors.application.admin.users.active_session_limit;

        useGenericViewQuery.mockReturnValue({
            data: { settings },
            isLoading: false,
            isFetching: false,
        });

        const { result } = renderHook(() => useConfigAgentData());

        expect(result.current.active_session_limit).toBe(2);
    });

    it("returns the stored active_session_limit when present", () => {
        const settings = makeSettings();
        settings.behaviors.application.admin.users.active_session_limit = 45;

        useGenericViewQuery.mockReturnValue({
            data: { settings },
            isLoading: false,
            isFetching: false,
        });

        const { result } = renderHook(() => useConfigAgentData());

        expect(result.current.active_session_limit).toBe(45);
    });
});

describe("useConfigAgentData — attachment defaults", () => {
    it("returns safe attachment settings when data is null", () => {
        useGenericViewQuery.mockReturnValue({
            data: null,
            isLoading: true,
            isFetching: true,
        });

        const { result } = renderHook(() => useConfigAgentData());

        expect(result.current.allowed_file_extensions).toEqual([]);
        expect(result.current.maximun_size_allowed).toBe(0);
        expect(result.current.quantity_files_allowed).toBe(0);
    });
});
