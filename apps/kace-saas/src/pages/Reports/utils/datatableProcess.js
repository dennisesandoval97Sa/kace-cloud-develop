import { handleStateTimer } from "@/utils/main";

/**
 * Procesa los datos de reportes para el DataTable
 * Aplana los campos anidados de period (initialDate, endDate) al nivel superior
 * @param {Array|Object} data - Datos crudos del API
 * @returns {Array} Datos procesados con campos aplanados
 */
export const processData = async (data) => {
    const normalizedData = data?.data ?? data;

    try {
        /*
         * Procesar solo las fechas, no sobrescribir el estado porque los reportes
         * usan estados de texto ('pending', 'completed', etc.) y no booleanos.
         */
        const stateProcessed = handleStateTimer(normalizedData) || [];

        /*
         * Aplanar los campos anidados de period para mostrarlos en columnas separadas
         * Estructura original: { period: { initialDate: "2025-12-27", endDate: "2025-12-31" } }
         * Resultado: { initial_date: "2025-12-27", end_date: "2025-12-31" }
         */
        const flattenedData = stateProcessed.map((item) => ({
            ...item,
            initial_date: item?.period?.initialDate || null,
            end_date: item?.period?.endDate || null,
        }));

        return flattenedData;
    } catch (error) {
        return [];
    }
};

const PERIOD_PATH_BY_FILTER_FIELD = {
    initial_date: "initialDate",
    end_date: "endDate",
};

/**
 * Las columnas `initial_date`/`end_date` son virtuales (vienen de `period`), así que su rango
 * `"desde, hasta"` se filtra en el backend sobre la ruta JSON correspondiente de `period`.
 * @param {Array} defaultFilters - Filtros de la tabla
 * @returns {Array} Filtros listos para el backend
 */
export const processFilters = (defaultFilters) => {
    if (!Array.isArray(defaultFilters)) {
        return [];
    }

    return defaultFilters.flatMap((filter) => {
        const path = PERIOD_PATH_BY_FILTER_FIELD[filter?.field];
        if (!path) {
            return [filter];
        }

        const [from, to] = String(filter.value ?? "")
            .split(",")
            .map((date) => date.trim());

        // Sin rango completo no hay filtro: se descarta, como hace normalizeAppliedTableDateFilters.
        if (!from || !to) {
            return [];
        }

        return [
            {
                field: "period",
                operator: "jsonPathDateBetween",
                value: JSON.stringify({ path, from, to }),
                type: filter.type || "AND",
            },
        ];
    });
};
