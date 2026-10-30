import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const HEADERS_CONSTANT_HELPS = ["titulo", "color", "is_active", "created_at", "updated_at"];

export const FILTER_COLUMNS_HELPS = [
    "titulo",
    "descripcion",
    "color",
    "is_active",
    "created_by",
    "updated_by",
    "created_at",
    "updated_at",
];

export const dataTableConfig = {
    key: URL_AND_KEYS.helps.key,
    url: URL_AND_KEYS.helps.url,
    view: URL_AND_KEYS.helps.view,
    genericColumns: HEADERS_CONSTANT_HELPS,
    filterColumns: FILTER_COLUMNS_HELPS,
    entity: URL_AND_KEYS.helps.entity,
};

export const FILTER_TRANSFORMATIONS = {
    titulo: (row) => ({
        ...row,
        label: "Title",
        filterData: {
            field: "helps.titulo",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    descripcion: (row) => ({
        ...row,
        filterData: {
            field: "helps.descripcion",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    color: (row) => ({
        ...row,
        filterData: {
            field: "helps.color",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    is_active: (row) => ({
        ...row,
        filterData: {
            field: "helps.is_active",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
    created_by: (row) => ({
        ...row,
        filterData: {
            field: "helps.created_by",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
    updated_by: (row) => ({
        ...row,
        filterData: {
            field: "helps.updated_by",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
};

export const initialValuesHelps = {
    titulo: "",
    descripcion: "",
    color: "",
    is_active: 1,
};
