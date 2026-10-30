import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const INITIAL_VALUES_TRANSITION_RULE = {
    nombre: "",
    status: 1,
    conditions: {
        combinator: "and",
        rules: [{ combinator: "and", not: false, rules: [] }],
    },
    entity: "case",
};

export const HEADERS_CONSTANT_TRANSITION_RULES = ["nombre", "status", "updated_at", "created_at"];

export const dataTableConfig = {
    key: URL_AND_KEYS.transitionRules.key,
    url: URL_AND_KEYS.transitionRules.url,
    view: URL_AND_KEYS.transitionRules.view,
    genericColumns: HEADERS_CONSTANT_TRANSITION_RULES,
    entity: URL_AND_KEYS.transitionRules.entity,
};

export const FILTER_TRANSFORMATIONS = {
    nombre: (row) => ({
        ...row,
        filterData: {
            field: "nombre",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
};
