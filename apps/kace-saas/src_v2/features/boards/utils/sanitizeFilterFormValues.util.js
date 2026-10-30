const EMPTY_FORM_VALUES = {};

/*
 * Un campo vaciado no es un filtro. filterBuilder sigue construyendo el criterio
 * (`ilike ""`, `eq ""`), y sin descartarlo aqui se persistiria y se reenviaria a
 * la API en cada consulta, con un chip que el usuario no sabe como quitar. Es el
 * mismo criterio que aplica handleApplyFilters en useDataTable.
 */
const isEmptyValue = (value) => {
    if (value === undefined || value === null || value === "") return true;
    if (typeof value !== "object") return false;
    const raw = value.displayValue !== undefined ? value.displayValue : value.value;
    return raw === undefined || raw === null || raw === "";
};

/**
 * Descarta los valores de formulario cuyo campo ya no es filtrable en el
 * tablero (columna eliminada o marcada como no filtrable desde la ultima vez
 * que el agente aplico el filtro), y los que quedaron vacios.
 *
 * Devuelve la misma referencia cuando no hubo nada que descartar, para que el
 * llamador pueda detectar el cambio con una comparacion por identidad.
 */
export const sanitizeFilterFormValues = (formValues, filtersFields) => {
    if (!formValues || typeof formValues !== "object") return EMPTY_FORM_VALUES;

    const entries = Object.entries(formValues);
    if (entries.length === 0) return formValues;

    /*
     * Sin campos todavia (boardConfig aun cargando) no se puede decidir si un
     * campo sigue siendo filtrable, pero los vacios se descartan igualmente.
     */
    const hasFields = Array.isArray(filtersFields) && filtersFields.length > 0;
    const allowedNames = hasFields ? new Set(filtersFields.map((field) => field.name)) : null;

    const kept = entries.filter(
        ([name, value]) => (allowedNames === null || allowedNames.has(name)) && !isEmptyValue(value),
    );

    if (kept.length === entries.length) return formValues;
    return Object.fromEntries(kept);
};

export default sanitizeFilterFormValues;
