import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const HEADERS_CONST_VAULT_SECRET = ["descripcion", "referencia", "secreto", "created_at", "updated_at"];

export const FILTER_COLUMNS_VAULT_SECRET = [
    "descripcion",
    "referencia",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by",
];

export const dataTableConfig = {
    key: URL_AND_KEYS.vaultSecret.key,
    url: URL_AND_KEYS.vaultSecret.url,
    view: URL_AND_KEYS.vaultSecret.view,
    entity: URL_AND_KEYS.vaultSecret.entity,
    genericColumns: HEADERS_CONST_VAULT_SECRET,
    filterColumns: FILTER_COLUMNS_VAULT_SECRET,
};

const createFilterTransformation = (columnName, operator = "ilike") => {
    return (row) => ({
        ...row,
        filterData: {
            field: `${URL_AND_KEYS.vaultSecret.view}.${columnName}`,
            operator,
            type: "AND",
            value: "",
        },
    });
};

export const FILTER_TRANSFORMATIONS = {
    descripcion: createFilterTransformation("descripcion"),
    referencia: createFilterTransformation("referencia"),
    secreto: (row) => ({ ...row, enableSorting: false }),
    created_by: createFilterTransformation("created_by", "eq"),
    updated_by: createFilterTransformation("updated_by", "eq"),
};
