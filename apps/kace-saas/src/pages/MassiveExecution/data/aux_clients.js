import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { SPECIAL_FIELDS } from "@/services/createSchemaFilter";

export const CLIENTS_TABLE = "clients";
export const AUX_CLIENTS_TABLE = "aux_clients";

/*
 * Configuracion unica de la vista previa: la ejecucion masiva actua sobre clientes, asi que
 * siempre consulta `/clients` y adjunta el auxiliar por relationship. Antes alternaba entre
 * `/clients` y `/aux-clients` segun el filtro, y la vista previa (base `clients`) no coincidia
 * con el lote que ejecutaba el backend (base `aux_clients`).
 *
 * Sin persistencia: es la vista previa de un paso del asistente de ejecucion masiva, gobernada
 * por los tableFilters que llegan por prop. Restaurar aqui pagina o filtros de una sesion
 * anterior confundiria la previsualizacion.
 */
export const clientDataTableConfig = {
    url: URL_AND_KEYS.clients.url,
    key: "massive_execution_clients_preview",
    view: URL_AND_KEYS.clients.view,
    persist: false,
    useDefaultFilters: false,
    genericColumns: ["nombres", "documento", "is_active", "created_at"],
    entity: CLIENTS_TABLE,
};

/*
 * `left` a proposito: un cliente sin fila en `aux_clients` debe seguir apareciendo cuando se
 * filtra por columnas nativas. Solo el filtro por `aux_clients.data` lo excluye, y lo hace por
 * el propio predicado, no por el tipo de join.
 */
export const clientsAuxRelationship = [
    {
        table: AUX_CLIENTS_TABLE,
        condition: {
            column: `${AUX_CLIENTS_TABLE}.cliente_id`,
            refColumn: `${CLIENTS_TABLE}.id`,
        },
        type: "left",
    },
];

/*
 * `clients.search` exige este filtro base para usuarios sin permiso de busqueda avanzada
 * (ver `searchPolicies` en SearchPolicyRegistry). Debe viajar sin prefijo y con el 1 numerico:
 * la politica lo compara por igualdad exacta del objeto.
 */
export const activeClientsFilter = {
    field: "status",
    operator: "eq",
    value: 1,
    type: "AND",
};

export const FILTER_TRANSFORMATIONS = {
    name: (row) => ({
        ...row,
        label: "Name",
        filterData: {
            field: "name",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    is_active: (row) => ({
        ...row,
        column_name: "is_active",
        filterData: {
            field: "is_active",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
};

export const columnFilters = [
    {
        column_name: "name",
        field: SPECIAL_FIELDS.string,
    },
    {
        column_name: "is_active",
        field: SPECIAL_FIELDS.switch_state,
    },
];
