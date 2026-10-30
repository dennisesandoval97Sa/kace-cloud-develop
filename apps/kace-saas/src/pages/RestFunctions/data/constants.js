import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const SHOW_COLUMNS = [
    "description",
    "type",
    "is_active",
    "updated_at",
    "created_at",
];

export const INITIAL_VALUES_WS_REST_FUNCTIONS = {
    id: "",
    description: "",
    type: "",
    is_active: true,
    value_dynamic: false,
    value_static: "",
    context_position: "",
    filter_input: "",
};

export const dataTableConfig = {
    key: URL_AND_KEYS.restFunctions.key,
    url: URL_AND_KEYS.restFunctions.url,
    view: URL_AND_KEYS.restFunctions.view,
    genericColumns: SHOW_COLUMNS,
    entity: URL_AND_KEYS.restFunctions.entity,
};

export const FILTER_TRANSFORMATIONS = {
    description: (row) => ({
        ...row,
        label: "Description",
        filterData: {
            field: "ws_rest_functions.description",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    type: (row) => ({
        ...row,
        label: "Type",
        filterData: {
            field: "ws_rest_functions.type",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    is_active: (row) => ({
        ...row,
        column_name: "is_active",
        filterData: {
            field: "ws_rest_functions.is_active",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
};
