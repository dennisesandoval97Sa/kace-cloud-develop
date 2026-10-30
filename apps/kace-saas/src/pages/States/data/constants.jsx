import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const HEADERS_CONSTANT_STATES = [
    "nombre",
    "descripcion",
    "icon_class",
    "color",
    "status",
    "updated_at",
    "created_at",
];

export const INITIAL_VALUES_STATES = {
    nombre: "",
    descripcion: "",
    icon_class: "",
    color: "",
    require_observation: false,
    status: 1,
};

export const dataTableConfig = {
    key: URL_AND_KEYS.states.key,
    url: URL_AND_KEYS.states.url,
    view: URL_AND_KEYS.states.view,
    genericColumns: HEADERS_CONSTANT_STATES,
    entity: URL_AND_KEYS.states.entity,
};

export const FILTER_TRANSFORMATIONS = {
    nombre: (row) => ({
        ...row,
        label: "Name",
        filterData: {
            field: "nombre",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    descripcion: (row) => ({
        ...row,
        label: "descripcion",
        filterData: {
            field: "descripcion",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    status: (row) => ({
        ...row,
        column_name: "status",
        filterData: {
            field: "status",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
};
