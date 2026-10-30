import { FILTER_TRANSFORMATIONS } from "../data/constants";

/**
 * Procesa las columnas del DataTable aplicando transformaciones de filtros
 * @param {Object} defaultFilters - Filtros por defecto del sistema
 * @returns {Object} Filtros procesados con transformaciones aplicadas
 */
export const processReportsColumns = (defaultFilters) => ({
    ...defaultFilters,
    ...FILTER_TRANSFORMATIONS,
});
