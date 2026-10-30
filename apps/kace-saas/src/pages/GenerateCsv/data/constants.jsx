import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const HEADERS_CONST_GENERATECSV = [
    "description",
    "frequency",
    "interval",
    "storage_path",
    "next_execution_at",
    "is_active",
    "created_at",
    "updated_at",
];

export const GENERATE_CSV_FILTER_COLUMNS = [
    "description",
    "is_active",
    "frequency",
    "interval",
    "storage_path",
    "last_execution_at",
    "next_execution_at",
    "created_by",
    "created_at",
    "updated_by",
    "updated_at",
];

export const dataTableConfig = {
    key: URL_AND_KEYS.generateCsv.key,
    url: URL_AND_KEYS.generateCsv.url,
    view: URL_AND_KEYS.generateCsv.view,
    entity: URL_AND_KEYS.generateCsv.entity,
    genericColumns: HEADERS_CONST_GENERATECSV,
    filterColumns: GENERATE_CSV_FILTER_COLUMNS,
};

const createFilterTransformation = (field, operator = "ilike") => {
    return (row) => ({
        ...row,
        filterData: {
            field: `${URL_AND_KEYS.generateCsv.view}.${field}`,
            operator,
            type: "AND",
            value: "",
        },
    });
};

export const FILTER_TRANSFORMATIONS = {
    description: createFilterTransformation("description"),
    is_active: createFilterTransformation("is_active", "eq"),
    frequency: createFilterTransformation("frequency"),
    interval: createFilterTransformation("interval", "eq"),
    storage_path: createFilterTransformation("storage_path"),
    last_execution_at: createFilterTransformation("last_execution_at", "between"),
    next_execution_at: createFilterTransformation("next_execution_at", "between"),
    created_by: createFilterTransformation("created_by", "eq"),
    created_at: createFilterTransformation("created_at", "between"),
    updated_by: createFilterTransformation("updated_by", "eq"),
    updated_at: createFilterTransformation("updated_at", "between"),
};
