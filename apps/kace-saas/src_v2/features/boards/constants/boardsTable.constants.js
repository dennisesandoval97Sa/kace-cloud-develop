import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { SPECIAL_FIELDS } from "@/services/createSchemaFilter";

/**
 * Columnas visibles del listado de tableros, en orden.
 * `access_users` y `access_groups` son columnas reales (jsonb de ids); la tabla pinta
 * los nombres que resuelve el backend en `access_users_data` / `access_groups_data`.
 */
export const HEADERS_CONSTANT_BOARDS = [
    "name",
    "description",
    "primary_entity",
    "access_users",
    "access_groups",
    "is_active",
    "display_order",
    "created_at",
    "updated_at",
];

export const dataTableConfig = {
    key: URL_AND_KEYS.boards.key,
    url: URL_AND_KEYS.boards.url,
    view: URL_AND_KEYS.boards.view,
    entity: URL_AND_KEYS.boards.entity,
    genericColumns: HEADERS_CONSTANT_BOARDS,
};

const ilikeFilter = (field) => ({
    field: `${URL_AND_KEYS.boards.view}.${field}`,
    operator: "ilike",
    type: "AND",
    value: "",
});

export const FILTER_TRANSFORMATIONS = {
    name: (row) => ({
        ...row,
        label: "boardName",
        filterData: ilikeFilter("name"),
    }),
    description: (row) => ({
        ...row,
        label: "boardDescription",
        filterData: ilikeFilter("description"),
    }),
    primary_entity: (row) => ({
        ...row,
        label: "primaryEntity",
        filterData: ilikeFilter("primary_entity"),
    }),
    /*
     * `boards.is_active` es un booleano real, asi que el switch enviara "true"/"false" en vez
     * de 1/0 (DataTableFilterInputs lo decide por el schema_column_type de la columna).
     */
    is_active: (row) => ({
        ...row,
        filterData: {
            field: `${URL_AND_KEYS.boards.view}.is_active`,
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
    /*
     * Sin `filterData`: solo aporta la etiqueta de cabecera. DataTableFilters descarta del
     * modal las columnas que no lo declaran.
     */
    display_order: (row) => ({
        ...row,
        label: "displayOrder",
    }),
    /*
     * `access_users_ids` / `access_groups_ids` no son columnas: BoardSearcher los extrae del
     * filtro y los traduce a una condicion JSONB `?|`. No se ordena por ellas porque el valor
     * almacenado son ids, no los nombres que ve el usuario.
     */
    access_users: (row) => ({
        ...row,
        label: "accessUsers",
        data_type: SPECIAL_FIELDS.multiselect_users,
        enableSorting: false,
        filterData: {
            field: "access_users_ids",
            operator: "in",
            type: "AND",
            value: "",
        },
    }),
    access_groups: (row) => ({
        ...row,
        label: "accessGroups",
        data_type: SPECIAL_FIELDS.multiselect_groups,
        enableSorting: false,
        filterData: {
            field: "access_groups_ids",
            operator: "in",
            type: "AND",
            value: "",
        },
    }),
};
