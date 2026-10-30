import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const HEADERS_CONST_AGENDA = [
    "description",
    "daily_limit",
    "is_for_weekend",
    "is_active",
    "created_at",
    "updated_at",
];

export const AGENDA_QUERY_KEY = "agendas";

export const dataTableConfig = {
    key: URL_AND_KEYS.agendas.key,
    url: URL_AND_KEYS.agendas.url,
    view: URL_AND_KEYS.agendas.view,
    genericColumns: HEADERS_CONST_AGENDA,
    filterColumns: [
        "description",
        "daily_limit",
        "is_for_weekend",
        "is_active",
        "created_by",
        "updated_by",
        "created_at",
        "updated_at",
    ],
    entity: URL_AND_KEYS.agendas.entity,
};

export const FILTER_TRANSFORMATIONS = {
    description: (row) => ({
        ...row,
        filterData: {
            field: "agendas.description",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    daily_limit: (row) => ({
        ...row,
        filterData: {
            field: "agendas.daily_limit",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
    is_for_weekend: (row) => ({
        ...row,
        field_type: "boolean",
        filterData: {
            field: "agendas.is_for_weekend",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
    is_active: (row) => ({
        ...row,
        field_type: "boolean",
        filterData: {
            field: "agendas.is_active",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
    created_by: (row) => ({
        ...row,
        filterData: {
            field: "agendas.created_by",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
    updated_by: (row) => ({
        ...row,
        filterData: {
            field: "agendas.updated_by",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
};
