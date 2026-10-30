/**
 * Helpers para procesar datos de aux-definitions y auxiliaries
 * Estos helpers transforman las respuestas del backend al formato esperado por los componentes
 */

/**
 * Procesa los datos de aux-definitions (esquemas de auxiliares) desde el backend
 *
 * @param {Array} data - Respuesta del backend con los esquemas de auxiliares
 * @returns {Array<Object>} Array de objetos con formato para select: {id, label, value, name, status}
 */
export const processSchemaData = (data = []) => {
    return data?.data?.map((item) => ({
        id: item.id,
        label: item.name || "",
        value: item.id || "",
        name: item.name || "", // Guardamos el name para usarlo en la URL de auxiliaries
        status: item.is_active,
    }));
};

/**
 * Construye los parámetros de filtro para buscar esquemas de auxiliares
 *
 * @param {string} event - Término de búsqueda ingresado por el usuario
 * @returns {Object} Objeto con estructura de filtro para el backend
 */
export const bodyFilterParams = (event) => ({
    filter: [
        {
            field: "name",
            operator: "ilike",
            value: event,
            type: "OR",
        },
    ],
    order: { field: "created_at", direction: "desc" },
    limit: 0,
    offset: 0,
});

/**
 * Formatea los esquemas activos al formato esperado por el componente select
 *
 * @param {Array<Object>} activeAuxDefinitions - Array de definiciones auxiliares activas
 * @returns {Array<Object>} Array formateado para select: {id, label, value, name}
 */
export const formatSchema = (activeAuxDefinitions) => {
    return activeAuxDefinitions.map((auxDef) => ({
        id: auxDef.id,
        label: auxDef.name.trim(),
        value: auxDef.id,
        name: auxDef.name.trim(), // Guardamos el name para usarlo en la URL de auxiliaries
    }));
};

/**
 * Procesa los datos de auxiliaries desde el backend
 * Maneja dos estructuras posibles: data.items (de /search) o data.data (estructura original)
 *
 * @param {Object} data - Respuesta del backend con los auxiliares
 * @returns {Array<Object>} Array de objetos con formato para select: {id, label, value}
 */
export const processAuxiliariesData = (data = []) => {
    // Intentar con data.items primero (estructura de /search)
    if (data?.data?.items && Array.isArray(data.data.items)) {
        return data.data.items.map((item) => ({
            id: item.id,
            label: item.data?.nombre || item.name || item.id || "",
            value: item.id || "",
        }));
    }

    // Fallback a data.data (estructura original)
    if (data?.data && Array.isArray(data.data)) {
        return data.data.map((item) => ({
            id: item.id,
            label: item.data?.nombre || item.name || item.id || "",
            value: item.id || "",
        }));
    }

    return [];
};

/**
 * Construye los parámetros de filtro para buscar auxiliares
 * Usa el operador jsonContains para buscar en el campo data.nombre
 *
 * @param {string} event - Término de búsqueda ingresado por el usuario
 * @returns {Object} Objeto con estructura de filtro para el backend
 */
export const bodyFilterAuxiliaries = (event) => ({
    filter: [
        {
            field: "data",
            operator: "jsonContains",
            value: `{"nombre":"${event}"}`,
            type: "OR",
        },
    ],
    order: { field: "created_at", direction: "desc" },
    limit: 0,
    offset: 0,
});

/**
 * Formatea los auxiliares activos al formato esperado por el componente select
 *
 * @param {Array<Object>} activeAuxiliaries - Array de auxiliares activos
 * @returns {Array<Object>} Array formateado para select: {id, label, value}
 */
export const formatAuxiliaries = (activeAuxiliaries) => {
    if (!activeAuxiliaries || !Array.isArray(activeAuxiliaries)) {
        return [];
    }

    return activeAuxiliaries.map((auxiliary) => ({
        id: auxiliary.id,
        label: auxiliary.data?.nombre || auxiliary.name || auxiliary.id || "",
        value: auxiliary.id,
    }));
};
