export const BOARDS_DEFAULT_PAGE_SIZE = 25;

export const BOARDS_DETAILS = {
    INITIAL_VALUES: {
        name: "",
        description: "",
        primary_entity: "",
        page_size: "",
        display_order: "",
        onescript_form_id: "",
        filter_onescript_id: "",
        is_active: true,
        can_view_record: true,
        can_create_record: true,
        can_edit_record: true,
        can_admin_bulk_actions: false,
        can_agent_bulk_actions: false,
        can_admin_delete_record: false,
        can_agent_delete_record: false,
        icon_class: "",
        access_groups: [],
        access_users: [],
        criteria: {
            items: [],
        },
        relations: null,
        columns: [],
        options: [],
        havings: [],
        orders: [],
        quick_ans_filter: {
            enabled: false,
            ans_column_alias: "",
            labels: { 1: "", 2: "", 3: "" },
            use_default_colors: true,
            colors: { 1: "", 2: "", 3: "" },
        },
    },
};

export const QUICK_ANS_FILTER_DEFAULT_LABELS = {
    1: "En tiempo",
    2: "Por vencer",
    3: "Vencidos",
};

export const QUICK_ANS_FILTER_DEFAULT_COLORS = {
    1: "#bdde86",
    2: "#ea6718",
    3: "#e61e1e",
};

export const BOARDS_RELATIONS = {
    INITIAL_VALUES: {
        primary_entity: "",
        related_entity: "",
        selected_join_condition: "",
        primary_filter: {},
        alias: "",
        join_type: "",
        on: [],
        relations: [],
    },
};

export const VALID_CONCAT_SEPARATOR_VALUES = [" ", ", ", " - ", " | ", " / "];

export const concatSeparatorOptions = (t) => [
    { label: t("boards.form.labels.separators.space"), value: " " },
    { label: t("boards.form.labels.separators.comma"), value: ", " },
    { label: t("boards.form.labels.separators.dash"), value: " - " },
    { label: t("boards.form.labels.separators.pipe"), value: " | " },
    { label: t("boards.form.labels.separators.slash"), value: " / " },
];

export const BOARDS_COLUMNS = {
    INITIAL_VALUES: {
        related_entity: "",
        field: "",
        alias: "",
        position: "",
        is_filterable: false,
        is_ans: false,
        is_status_column: false,
        visible: true,
        data_type: "",
        format: "",
        group_by: false,
        function_type: "",
        function: "",
        comparison_type: "",
        comparison_value: "",
        comparison_entity: "",
        comparison_field: "",
        concat_sources: [],
        separator: " ",
    },
};

export const BOARDS_FUNCTIONS = {
    INITIAL_VALUES: {
        related_entity: "",
        field: "",
        alias: "",
        function: "",
        type: "function",
    },
};

export const BOARDS_HAVING = {
    INITIAL_VALUES: {
        entity: "",
        field: "",
        function: "",
        type: "having",
        operator: "",
        value: "",
    },
};

export const BOARDS_OPTIONS = {
    INITIAL_VALUES: {
        type: "",
        ref_id: "",
        label: "",
        requires_confirmation: false,
    },
    TYPES: {
        ACTION: "ACTION",
        RESTFLOW: "RESTFLOW",
        ONESCRIPT: "ONESCRIPT",
    },
};

export const BOARDS_INITIAL_FILTER = {
    INITIAL_VALUES: {
        related_entity: "",
        field: "",
        operator: "",
        comparison_type: "",
        field_related_entity: "",
        value: "",
        type: "",
        function_type: "",
        days: "",
    },
    FUNCTIONS: ["date_calculated_add", "date_calculated_substract"],
    LOGGED_IN_USER: "logged_in_user",
    LOGGED_IN_USER_GROUP: "logged_in_user_group",
    ACTIVE_CLIENT: "active_client",
};

export const BOARDS_SORTING = {
    INITIAL_VALUES: {
        entity: "",
        field: "",
        direction: "",
    },
    TYPES: {
        ASC: "asc",
        DESC: "desc",
    },
};

export const BOARDS_ROWS = {
    TYPES: {
        field: "Columna",
        function: "Función",
        having: "Having",
    },
};

export const BOARDS_FETCH_CONFIG = {
    REFETCH_INTERVAL: 60 * 1000,
};
