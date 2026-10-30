import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const HEADERS_CONST_GROUPS = [
    "nombre",
    "expiredCases",
    "intermediateCases",
    "notExpiredCases",
    "status",
    "created_at",
    "updated_at",
];

export const dataTableConfig = {
    key: URL_AND_KEYS.groups.key,
    url: URL_AND_KEYS.groups.url,
    view: URL_AND_KEYS.groups.view,
    genericColumns: HEADERS_CONST_GROUPS,
    entity: URL_AND_KEYS.groups.entity,
};

export const FILTER_TRANSFORMATIONS = {
    nombre: (row) => ({
        ...row,
        label: "nombre",
        filterData: {
            field: "nombre",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    groups: (row) => ({
        ...row,
        label: "groups",
        filterData: {
            field: "groups",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    status: (row) => ({
        ...row,
        filterData: {
            field: "status",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
};
