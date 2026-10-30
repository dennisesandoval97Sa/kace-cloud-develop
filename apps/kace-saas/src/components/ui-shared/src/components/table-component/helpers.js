export const levelsClassification = (data = {}) => {
    if (!data.data) {
        return [];
    }
    const { data: dataTable } = data;
    return Array.from(new Set(dataTable.map((item) => item.description)));
};

export const FILTER_SCOPES = Object.freeze({
    AGENTE: "agente",
    ADMIN: "admin",
});

export const DEFAULT_FILTER_SCOPE = FILTER_SCOPES.AGENTE;

export const validateFilters = (dataUser, nameTable, scope = DEFAULT_FILTER_SCOPE) => {
    if (!dataUser) return;
    if (!dataUser.filters) {
        dataUser.filters = {};
    }
    if (!dataUser.filters.application) {
        dataUser.filters.application = {};
    }
    if (!dataUser.filters.application[scope]) {
        dataUser.filters.application[scope] = {};
    }
    if (!dataUser.filters.application[scope][nameTable]) {
        dataUser.filters.application[scope][nameTable] = {};
    }
};

/**
 * Reads the saved filters for a view under the given scope, falling back to the ADMIN scope only
 * when reading AGENTE and the agente bucket for that view does not exist at all yet (never seeded).
 * This keeps filters saved before per-scope filters existed (always stored under admin) visible to
 * agente users until agente gets its own bucket for that view.
 *
 * Deliberately does NOT fall back when the agente bucket exists but is empty (e.g. the user deleted
 * every agente filter after it was seeded) — once agente has its own bucket, admin's legacy filters
 * must not reappear in the list.
 */
export const getScopedViewFilters = (filters, view, scope = DEFAULT_FILTER_SCOPE) => {
    const scopedFilters = filters?.application?.[scope]?.[view];
    if (scopedFilters) {
        return scopedFilters;
    }
    if (scope === FILTER_SCOPES.AGENTE) {
        return filters?.application?.[FILTER_SCOPES.ADMIN]?.[view] ?? {};
    }
    return {};
};

/**
 * Mutates nextFilters in place: on the first-ever AGENTE save for a view (scopeViewExistedBeforeInit
 * is false), seeds that view's agente bucket with a deep copy of admin's legacy filters for the same
 * view, so they stay visible from agente instead of disappearing once agente gets its own bucket.
 * admin is never mutated. No-op for any scope other than AGENTE, once the agente bucket already
 * existed before this write (even if currently empty), or when admin has no filters for that view.
 *
 * Must be called AFTER validateFilters has initialized nextFilters.application[scope][view].
 */
export const seedScopeFromLegacyAdmin = (nextFilters, view, scope, scopeViewExistedBeforeInit) => {
    if (scope !== FILTER_SCOPES.AGENTE || scopeViewExistedBeforeInit) return;
    const legacyAdminFilters = nextFilters.application?.[FILTER_SCOPES.ADMIN]?.[view];
    if (!legacyAdminFilters || Object.keys(legacyAdminFilters).length === 0) return;
    Object.assign(nextFilters.application[scope][view], structuredClone(legacyAdminFilters));
};

export const createFilter = (dataNewFilter) => {
    return Object.entries(dataNewFilter).reduce((acc, [key, value]) => {
        if (value !== "" && value !== null && value !== undefined) {
            acc[key] = value;
        }
        return acc;
    }, {});
};

export const columnsToNotShowByTable = {
    geolocation: ["updated_at", "updated_by", "ip4_address", "created_by"],
    ws_rest_endpoints: ["on_error", "on_success", "headers", "body", "filter_input"],
    ws_rest_functions: ["filter_input"],
    ws_rest_flows: ["json_diagram_properties"],
};

export const caseInsensitiveFields = ["nombres", "apellido1", "apellido2", "email"];

const fieldsCasesUsers = ["nombres", "apellido1", "apellido2"];

const fieldsCasesClients = ["documento", "nombre_cliente"];

export const validateSearchToTable = ({ view = "", field = "" }) => {
    if (view === "cases") {
        if (fieldsCasesUsers.includes(field)) {
            return `responsable.${field}`;
        } else if (fieldsCasesClients.includes(field)) {
            return `clients.${field === "nombre_cliente" ? "nombres" : field}`;
        } else {
            return null;
        }
    }
    return null;
};

export const COLUMNS_NOT_SHOW = [
    "id",
    "deleted_at",
    "deleted_by",
    "json_flujo",
    "tipo_id",
    "require_observation",
    "medicion_ans_id",
    "propiedades",
    "especificaciones",
    "work_days",
    "holiday_dates",
    "client_id",
    "is_read",
    "password",
    "token",
    "session_id",
    "rol_id",
    "password_reset_token",
    "inactivo_desde",
    "inactivo_hasta",
    "intento_login",
    "fecha_bloqueo",
    "grupo_activo",
    "codigos_externos",
    "external_id",
    "account_type",
    "es_externo",
    "envio_correo",
    "grid",
    "filters",
    "permisos",
    "configuracion",
    "tenant_id",
    "client_secret",
    "refresh_token",
    "folders",
    "access_token",
    "vault",
    "vault_data",
    "has_ssl",
    "lista_grupos",
    "nivel2",
    "nivel3",
    "nivel4",
    "nivel5",
    "nivel6",
    "nivel7",
    "nivel8",
    "nivel9",
    "nivel10",
    "is_active",
    "default_group_id",
    "external_id",
    "ruta",
    "copia_oculta",
    "cuerpo",
    "incluye_adjuntos",
    "horario_id",
    "layouts",
    "comportamientos",
    "filter_order",
    "lista_usuarios",
    "secreto",
    "longitud",
    "latitud",
    "antiguedad",
    "classification_id",
    "group_id",
    "form",
    "settings",
    "metadata",
];

const pad2 = (n) => String(n).padStart(2, "0");

const formatLocalDateOnly = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
        return iso;
    }
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const formatLocalDateTime = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
        return iso;
    }
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};

const DATE_EXACT_COLUMNS = [
    "fecha",
    "created_at",
    "updated_at",
    "last_updated_at",
    "last_execution_at",
    "next_execution_at",
    "start_at",
    "end_at",
    "receipt_at",
    "start_date",
    "end_date",
    "occurred_at",
    "edited_at",
];

export const resolveDateFilterOperator = (column) => {
    if (!column || typeof column !== "string") return null;
    if (column.startsWith("fecha_") || DATE_EXACT_COLUMNS.includes(column)) {
        return "between";
    }
    return null;
};

export const pickRestorableFilterValues = (savedFilter, knownColumnNames) => {
    if (!savedFilter || typeof savedFilter !== "object") return {};
    const known = new Set(knownColumnNames ?? []);
    return Object.entries(savedFilter).reduce((acc, [key, value]) => {
        if (known.has(key) && value !== "" && value !== null && value !== undefined) {
            const normalizedValue =
                typeof value === "object" && value !== null && !Array.isArray(value) && "value" in value
                    ? value.value
                    : value;
            if (normalizedValue !== "" && normalizedValue !== null && normalizedValue !== undefined) {
                acc[key] = normalizedValue;
            }
        }
        return acc;
    }, {});
};

/*
 * All current production callers (useDataTable.jsx, useHookFilter.js's handleDeleteFilter) resolve
 * and pass an explicit scope, since each one needs its own admin-fallback rule (useHookFilter falls
 * back from agente to admin, useDataTable is admin-only). The `scope = null` auto-detect branch below
 * is kept for callers that do not pre-resolve one themselves (see helpers.test.js) and must not be
 * removed, since a caller that only knows the name/view and not which scope holds it still needs it.
 */
export const removeSavedUserFilter = (filters, view, name, scope = null) => {
    if (!filters) return filters;
    const targetScope =
        scope ||
        (filters?.application?.[FILTER_SCOPES.AGENTE]?.[view] &&
        Object.prototype.hasOwnProperty.call(filters.application[FILTER_SCOPES.AGENTE][view], name)
            ? FILTER_SCOPES.AGENTE
            : FILTER_SCOPES.ADMIN);
    const viewFilters = filters?.application?.[targetScope]?.[view];
    if (!viewFilters || !Object.prototype.hasOwnProperty.call(viewFilters, name)) {
        return filters;
    }
    const next = structuredClone(filters);
    delete next.application[targetScope][view][name];
    return next;
};

export const formatFilterBadgeValue = (value, column) => {
    if (value === null || value === undefined) {
        return "";
    }
    if (typeof value === "object" && value !== null) {
        return String(value.value ?? value.label ?? JSON.stringify(value));
    }
    if (typeof value !== "string") {
        return String(value);
    }
    const dt = column?.data_type;
    if (dt === "date" || dt === "datetime") {
        const formatPart = dt === "date" ? formatLocalDateOnly : formatLocalDateTime;
        if (value.includes(", ")) {
            return value
                .split(", ")
                .map((part) => formatPart(part.trim()))
                .join(" – ");
        }
        if (/^\d{4}-\d{2}-\d{2}T?/.test(value) || /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return formatPart(value);
        }
    }
    return value;
};
