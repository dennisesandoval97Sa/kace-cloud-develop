import { handleState, handleStateTimer } from "@/utils/main";
import {
    activeClientsFilter,
    AUX_CLIENTS_TABLE,
    clientsAuxRelationship,
    CLIENTS_TABLE,
    columnFilters,
    FILTER_TRANSFORMATIONS,
} from "../data/aux_clients";

export const processFilters = (defaultFilters) => [...defaultFilters, ...columnFilters];

export const processColumns = (defaultFilters) => ({
    ...defaultFilters,
    ...FILTER_TRANSFORMATIONS,
});

/*
 * Las filas ya son clientes: la busqueda tiene base `clients` y el auxiliar viaja en
 * `relations.aux_clients`, que la tabla no pinta.
 */
export const processData = (data) => {
    const normalizedData = data?.data ?? data;
    if (!Array.isArray(normalizedData)) return [];
    return handleStateTimer(handleState(normalizedData));
};

/**
 * Cualifica el campo con su tabla. El formulario de auxiliares emite `data` a secas; cualquier
 * otro campo del auxiliar llega ya como `aux_clients.<x>`.
 *
 * Con el join a `aux_clients` las columnas homonimas (`id`, `data`, `created_at`,
 * `deleted_at`) son ambiguas para Postgres, asi que ningun campo puede viajar desnudo.
 *
 * @param {string} field
 * @returns {string}
 */
export const qualifyFilterField = (field) => {
    if (!field) return field;
    if (field === "data") return `${AUX_CLIENTS_TABLE}.data`;
    if (field.includes(".")) return field;
    return `${CLIENTS_TABLE}.${field}`;
};

/**
 * @param {Array<object>|null|undefined} filters
 * @returns {Array<object>} los mismos filtros con el campo cualificado
 */
export const normalizeClientFilters = (filters) => {
    if (!Array.isArray(filters)) return [];
    return filters.map((filter) => (filter?.field ? { ...filter, field: qualifyFilterField(filter.field) } : filter));
};

/**
 * Determina si el conjunto de filtros incluye alguna condicion sobre la tabla auxiliar.
 *
 * @param {Array<object>|null|undefined} filters
 * @returns {boolean}
 */
export const hasAuxiliaryFilter = (filters) => {
    if (!Array.isArray(filters)) return false;
    return filters.some((filter) => filter?.field === "data" || filter?.field?.startsWith(`${AUX_CLIENTS_TABLE}.`));
};

/**
 * Unica fuente de la consulta de clientes de la ejecucion masiva. La usan tanto la vista previa
 * como el envio del lote, de modo que el usuario ejecuta exactamente sobre lo que vio: mismos
 * filtros, mismo relationship y misma tabla base (`clients`).
 *
 * El join a `aux_clients` solo se adjunta si hay filtros sobre el auxiliar, permitiendo
 * que usuarios sin permiso en `aux_clients` consulten por columnas nativas de clientes.
 *
 * @param {Array<object>|null|undefined} filters filtros crudos del formulario
 * @returns {{filter: Array<object>, relationship?: Array<object>}}
 */
export const buildClientsSearchQuery = (filters) => {
    const normalizedFilters = normalizeClientFilters(filters);
    const requiresAuxRelationship = hasAuxiliaryFilter(filters);

    return {
        filter: [...normalizedFilters, activeClientsFilter],
        ...(requiresAuxRelationship && { relationship: clientsAuxRelationship }),
    };
};
