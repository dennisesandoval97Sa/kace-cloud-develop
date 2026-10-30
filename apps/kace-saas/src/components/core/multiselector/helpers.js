export const extractLabel = (item, keys, valueKey) => {
    if (Array.isArray(keys)) {
        return keys.map((key) => item[key]).join(" - ");
    }

    if (typeof keys === "string") {
        return item[keys] || item[valueKey] || "unknown";
    }

    return item[valueKey] || "unknown";
};

/**
 * Ordena las opciones del desplegable del selector de usuarios.
 *
 * Por defecto (`groupSelectedFirst = true`) antepone los usuarios ya
 * seleccionados. Con `groupSelectedFirst = false` conserva el orden del catálogo
 * devuelto por la API —igual que el selector de grupos—, de modo que el usuario
 * no tenga que desplazarse por encima de lo ya elegido para marcar lo siguiente;
 * el estado seleccionado se refleja in situ con el check y desde los chips.
 *
 * @param {Array} dataUsers - Opciones del catálogo, en orden de la API.
 * @param {Array} listValues - Usuarios seleccionados.
 * @param {{ hasSearched?: boolean, isFetching?: boolean, groupSelectedFirst?: boolean }} [options]
 * @returns {Array} Opciones a renderizar, en orden.
 */
export const buildDisplayUsers = (
    dataUsers = [],
    listValues = [],
    { hasSearched = false, isFetching = false, groupSelectedFirst = true } = {},
) => {
    if (hasSearched && isFetching && dataUsers.length === 0) {
        return listValues;
    }

    const dataIds = new Set(dataUsers.map((item) => item.id));
    const missingSelected = listValues.filter((item) => !dataIds.has(item.id));

    if (groupSelectedFirst) {
        const selectedIds = new Set(listValues.map((item) => item.id));
        const selectedInData = dataUsers.filter((item) => selectedIds.has(item.id));
        const unselectedInData = dataUsers.filter((item) => !selectedIds.has(item.id));
        return [...missingSelected, ...selectedInData, ...unselectedInData];
    }

    /*
     * Orden del catálogo intacto. En una búsqueda activa no se arrastran los
     * seleccionados que no coinciden; en navegación, los seleccionados que no
     * están en la página cargada se añaden al final (no al inicio) para poder
     * deseleccionarlos desde la propia lista.
     */
    return hasSearched ? [...dataUsers] : [...dataUsers, ...missingSelected];
};
