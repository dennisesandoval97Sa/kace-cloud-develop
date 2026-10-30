import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const HEADERS_CONSTANT_GROUP_LIST = [
    "descripcion",
    "created_at",
    "updated_at",
];

export const INITIAL_GROUP_LIST_VALUES = {
    descripcion: "",
    is_active: true,
    lista_grupos: [],
};

export const dataTableConfig = {
    key: URL_AND_KEYS.groupLists.key,
    url: URL_AND_KEYS.groupLists.url,
    view: URL_AND_KEYS.groupLists.view,
    genericColumns: HEADERS_CONSTANT_GROUP_LIST,
    entity: URL_AND_KEYS.groupLists.entity,
};

export const FILTER_TRANSFORMATIONS = {
    descripcion: (row) => ({
        ...row,
        label: "Descripcion",
        filterData: {
            field: "descripcion",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
};
