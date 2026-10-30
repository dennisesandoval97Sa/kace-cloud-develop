import { isNivelColumn, parseNivelNumber, MAX_CLASSIFICATION_LEVELS } from "./classificationLevels.util";

/**
 * Transforms a single nivel field name for backend consumption.
 *
 * - Classic view (isCustomView = false): `nivel3` → `clasificaciones.nivel3`
 * - Custom view (isCustomView = true): field is already flat, returned as-is,
 *   unless it's above `maxLevel` (the highest nivel column the active custom
 *   view's real columns actually have) — then `null` signals "drop this
 *   filter", since the column doesn't exist and would crash the query.
 *
 * Supported range: nivel1–nivel10 (per NIVEL_COLUMN_PATTERN in classificationLevels.util).
 *
 * @param {string} fieldName - The column/field name to transform
 * @param {{ isCustomView: boolean, maxLevel?: number }} options
 * @returns {string|null} The transformed field name, or null if it should be dropped
 */
export const transformNivelField = (fieldName, { isCustomView, maxLevel } = {}) => {
    if (!isNivelColumn(fieldName)) {
        return fieldName;
    }
    if (isCustomView && maxLevel !== undefined) {
        const level = parseNivelNumber(fieldName);
        if (level !== null && level > maxLevel) {
            return null;
        }
    }
    return isCustomView ? fieldName : `clasificaciones.${fieldName}`;
};

/**
 * Creates a `transformFilterField` callback suitable for injecting into
 * useHookFilter via `nameTable.transformFilterField`. This keeps the
 * domain-specific nivel logic in the Cases layer instead of ui-shared.
 *
 * @param {{ isCustomView: boolean, maxLevel?: number }} options
 * @returns {(fieldName: string) => string|null}
 */
export const createNivelFieldTransformer = ({ isCustomView, maxLevel } = {}) => {
    return (fieldName) => transformNivelField(fieldName, { isCustomView, maxLevel });
};

/**
 * Transforma los filtros de columnas `nivelX` antes de enviarlos al backend.
 *
 * - Vista clásica (isCustomView = false): el campo `nivel3` se convierte en
 *   `clasificaciones.nivel3` porque el backend necesita calificar la relación.
 * - Vista personalizada (isCustomView = true): el campo ya es plano, se deja tal cual.
 *
 * Rango soportado: nivel1–nivel10 (según NIVEL_COLUMN_PATTERN de classificationLevels.util).
 *
 * `maxLevel` es una defensa adicional para vistas custom cuyas columnas reales no llegan
 * a nivel10 (p.ej. una vista creada por un admin antes de que existiera ese nivel): si el
 * filtro apunta a un nivel por encima de `maxLevel` en vista custom, se descarta en lugar
 * de enviarse al backend, donde produciría un error de columna inexistente. En vista
 * clásica `maxLevel` no aplica: el join a `clasificaciones` siempre soporta los 10 niveles.
 *
 * @param {Array<{field: string, operator: string, value: string, type: string}>} filters
 * @param {{ isCustomView: boolean, maxLevel?: number }} options
 * @returns {Array} Filters con el campo transformado donde corresponda; los niveles fuera
 *   de rango en vista custom se omiten del resultado.
 */
export const transformNivelFilters = (filters, { isCustomView, maxLevel = MAX_CLASSIFICATION_LEVELS }) => {
    return filters
        .filter((filter) => {
            if (!isCustomView || !filter.field) return true;
            const levelNumber = parseNivelNumber(filter.field);
            return levelNumber === null || levelNumber <= maxLevel;
        })
        .map((filter) => {
            if (filter.field && isNivelColumn(filter.field) && !isCustomView) {
                return { ...filter, field: `clasificaciones.${filter.field}` };
            }
            return filter;
        });
};

const CLASSIFICATION_VALUE_PATTERN = /^(?:clasificaciones\.)?(nivel(?:[1-9]|10))\/(.*)$/i;

// NOTA MSKT-1392: `estado_id` (vía `estados.id`, filtro EQ abajo) ahora puede coincidir con casos
// que antes tenían esa columna en NULL en la vista (transición sin siguiente_estado_id) — la
// vista pasó a resolverla contra `cases.estado_id` persistido. Ver el comentario en
// `packages/kace_cloud_database/views/view_cases_details_v9.js`.
const CASES_FILTER_FIELD_ALIASES_BASE = {
    fecha_vencimiento: "cases.sla_due_date",
    estadoActual: "estados.nombre",
    estado_actual: "estados.nombre",
    estado_id: "estados.id",
    grupo_nombre: "grupos.nombre",
    responsable_nombre: "responsable.nombres",
};

const CASES_FILTER_EQ_FIELDS = new Set(["estado_id", "grupo_id", "transicion_id"]);

export const resolveCasesFilterCriterion = ({ field, value, isCustomView }) => {
    if (value === "" || value === null || value === undefined) {
        return null;
    }

    if (field === "reference") {
        const numeric = typeof value === "number" ? value : Number(String(value).trim());
        if (!Number.isFinite(numeric)) {
            return null;
        }
        return { field: "reference", value: numeric, operator: "eq" };
    }

    if (typeof value === "string") {
        const match = value.match(CLASSIFICATION_VALUE_PATTERN);
        if (match) {
            const level = match[1].toLowerCase();
            const classificationValue = match[2];
            if (!classificationValue || classificationValue === "null") {
                return null;
            }
            if (!isNivelColumn(level)) {
                return null;
            }
            const resolvedField = isCustomView ? level : `clasificaciones.${level}`;
            return { field: resolvedField, value: classificationValue };
        }
    }

    const aliasedField = isCustomView ? undefined : CASES_FILTER_FIELD_ALIASES_BASE[field];
    if (aliasedField) {
        return {
            field: aliasedField,
            value: field === "fecha_vencimiento" ? String(value) : value,
            ...(CASES_FILTER_EQ_FIELDS.has(field) ? { operator: "eq" } : {}),
        };
    }

    if (CASES_FILTER_EQ_FIELDS.has(field)) {
        return { field, value, operator: "eq" };
    }

    if (isNivelColumn(field) && !isCustomView) {
        return { field: `clasificaciones.${field}`, value };
    }

    return { field, value };
};

export const createCasesFilterCriterionResolver = ({ isCustomView }) => {
    return ({ field, value }) => resolveCasesFilterCriterion({ field, value, isCustomView });
};
