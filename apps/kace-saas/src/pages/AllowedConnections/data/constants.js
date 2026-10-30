import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const HEADERS_CONST_CONNECTIONS = ["description", "connection", "is_active", "created_at", "updated_at"];

// Columnas del esquema `allowed_connections` que quedan fuera del panel de filtros:
// - `id`, `deleted_at`, `deleted_by`: metadatos, no son criterios de búsqueda del usuario.
// - `certificate`: blob PEM; un `ilike` sobre él no es un filtro útil y expone su contenido.
// - `has_ssl`: booleana no expuesta como filtro en producto.
export const ALLOWED_CONNECTIONS_FILTER_COLUMNS = [
    "description",
    "connection",
    "is_active",
    "created_by",
    "updated_by",
    "created_at",
    "updated_at",
];

export const dataTableConfig = {
    key: URL_AND_KEYS.allowedConnections.key,
    url: URL_AND_KEYS.allowedConnections.url,
    view: URL_AND_KEYS.allowedConnections.view,
    entity: URL_AND_KEYS.allowedConnections.entity,
    genericColumns: HEADERS_CONST_CONNECTIONS,
    filterColumns: ALLOWED_CONNECTIONS_FILTER_COLUMNS,
};

const createFilterTransformation = (field, operator = "ilike") => {
    return (row) => ({
        ...row,
        filterData: {
            field: `${URL_AND_KEYS.allowedConnections.view}.${field}`,
            operator,
            type: "AND",
            value: "",
        },
    });
};

export const FILTER_TRANSFORMATIONS = {
    description: createFilterTransformation("description"),
    connection: createFilterTransformation("connection"),
    is_active: createFilterTransformation("is_active", "eq"),
    created_by: createFilterTransformation("created_by", "eq"),
    updated_by: createFilterTransformation("updated_by", "eq"),
};
