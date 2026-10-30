import { DEFAULT_ANS_VISUAL_COLORS } from "@kace/core/src/shared/visual-options/sharedVisualOptions.js";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const HEADERS_CONSTANT_ANS = [
    "nombre",
    "color_ans_inicial",
    "color_ans_intermedio",
    "color_ans_final",
    "status",
    "created_at",
    "updated_at",
];

export const FILTER_COLUMNS_ANS = [
    "id",
    "nombre",
    "intermedio",
    "vencido",
    "color_ans_inicial",
    "color_ans_intermedio",
    "color_ans_final",
    "status",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by",
];

export const dataTableConfig = {
    key: URL_AND_KEYS.ans.key,
    url: URL_AND_KEYS.ans.url,
    view: URL_AND_KEYS.ans.view,
    genericColumns: HEADERS_CONSTANT_ANS,
    filterColumns: FILTER_COLUMNS_ANS,
    entity: URL_AND_KEYS.ans.entity,
};

export const INITIAL_VALUES_ANS = {
    color_ans_final: DEFAULT_ANS_VISUAL_COLORS.final,
    color_ans_inicial: DEFAULT_ANS_VISUAL_COLORS.initial,
    color_ans_intermedio: DEFAULT_ANS_VISUAL_COLORS.intermediate,
    id: "",
    intermedio: "",
    medicion_ans_id: "",
    nombre: "",
    status: 1,
    vencido: "",
};

const createFilterTransformation = (columnName, operator = "eq") => {
    return (row) => ({
        ...row,
        filterData: {
            field: `${URL_AND_KEYS.ans.view}.${columnName}`,
            operator,
            type: "AND",
            value: "",
        },
    });
};

export const FILTER_TRANSFORMATIONS = {
    id: createFilterTransformation("id"),
    nombre: createFilterTransformation("nombre", "ilike"),
    intermedio: createFilterTransformation("intermedio"),
    vencido: createFilterTransformation("vencido"),
    color_ans_inicial: createFilterTransformation("color_ans_inicial", "ilike"),
    color_ans_intermedio: createFilterTransformation("color_ans_intermedio", "ilike"),
    color_ans_final: createFilterTransformation("color_ans_final", "ilike"),
    status: createFilterTransformation("status"),
    created_by: createFilterTransformation("created_by"),
    updated_by: createFilterTransformation("updated_by"),
};
