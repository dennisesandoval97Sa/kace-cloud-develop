import { SPECIAL_FIELDS } from "@/services/createSchemaFilter";
import { handleFullName, handleState, handleStateTimer } from "../../../utils/main";
import { FILTER_TRANSFORMATIONS } from "../data/constants";

/**
 * Procesa la data en el DataTable.
 *
 * @param {Object}  data - Objeto con los datos transformados
 * @returns {Object} Objeto con los datos procesados para el DataTable
 */
export const processData = async (data) => {
    const normalizedData = data?.items ?? data;
    try {
        const transformedData = handleStateTimer(handleState(handleFullName(normalizedData))) || [];
        return transformedData;
    } catch {
    // Errors are intentionally not logged or thrown to prevent flow interruption
        return [];
    }
};

/**
 * Procesa las columnas del DataTable aplicando transformaciones de filtro personalizadas.
 *
 * @param {Object} defaultFilters - Filtros por defecto del DataTable
 * @returns {Object} Filtros combinados (por defecto + personalizados)
 */
export const processColumns = (defaultFilters) => ({
    ...defaultFilters,
    ...FILTER_TRANSFORMATIONS,
});

/**
 * Procesa los filtros del DataTable agregando filtros especiales para campos específicos.
 * Agrega el filtro de tipo switch para el campo is_active.
 *
 * @param {Array<Object>} defaultFilters - Array de filtros por defecto
 * @returns {Array<Object>} Array de filtros incluyendo los personalizados
 */
export const processFilters = (defaultFilters) => [
    ...defaultFilters,
    {
        column_name: "is_active",
        field: SPECIAL_FIELDS.switch_state,
    },
];
