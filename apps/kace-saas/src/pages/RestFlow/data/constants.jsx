import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const HEADERS_CONSTANT_WS_REST_FLOWS = ["description", "external_code", "is_active", "updated_at", "created_at"];

export const REST_FLOWS_TYPES = {
    endpoint: "endpoint",
    function: "function",
};

export const INITIAL_VALUES_WS_REST_FLOWS = {
    description: "",
    is_active: true,
    is_primary: true,
    external_code: "",
    json_diagram_properties: {},
};

export const INITIAL_NODE = {
    id: "0",
    type: "input",
    position: { x: 225, y: 75 },
    data: { label: "inicio" },
    selected: false,
    positionAbsolute: { x: 0, y: 0 },
    dragging: false,
};

export const dataTableConfig = {
    key: URL_AND_KEYS.restFlows.key,
    url: URL_AND_KEYS.restFlows.url,
    view: URL_AND_KEYS.restFlows.view,
    genericColumns: HEADERS_CONSTANT_WS_REST_FLOWS,
    entity: URL_AND_KEYS.restFlows.entity,
};

export const FILTER_TRANSFORMATIONS = {
    description: (row) => ({
        ...row,
        label: "Name",
        filterData: {
            field: "description",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    external_code: (row) => ({
        ...row,
        label: "External Code",
        filterData: {
            field: "external_code",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    is_active: (row) => ({
        ...row,
        field_type: "boolean",
        filterData: {
            field: "is_active",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
};
