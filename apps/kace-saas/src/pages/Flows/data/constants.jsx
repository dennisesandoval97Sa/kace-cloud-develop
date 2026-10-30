import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const HEADERS_CONSTANT_FLOWS = [
    "nombre",
    "status",
    "created_at",
    "updated_at",
];

export const INITIAL_VALUES_FLOWS = {
    nombre: "",
    json_flujo: "",
    status: 1,
};

export const dataTableConfig = {
    key: URL_AND_KEYS.flows.key,
    url: URL_AND_KEYS.flows.url,
    view: URL_AND_KEYS.flows.view,
    genericColumns: HEADERS_CONSTANT_FLOWS,
    entity: URL_AND_KEYS.flows.entity,
};

export const FILTER_TRANSFORMATIONS = {
    nombre: (row) => ({
        ...row,
        label: "Nombre",
        filterData: {
            field: "flujos.nombre",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    status: (row) => ({
        ...row,
        column_name: "status",
        filterData: {
            field: "flujos.status",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
};
