import { t } from "i18next";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const SPECIAL_FIELDS = Object.freeze({
    classification_levels: "classification_levels",
    search_users: "search_users",
    switch_state: "switch_state",
    select_colors: "select_colors",
    select_icons: "select_icons",
    number: "number",
    string: "string",
    list: "list",
    date: "date",
    datetime: "datetime",
    schema_id: "schema_id",
    select_roles: "select_roles",
    multiselect_roles: "multiselect_roles",
    multiselect_groups: "multiselect_groups",
    multiselect_users: "multiselect_users",
    select_classification: "select_classification",
});

const BOOLEAN_SQL_TYPES = new Set(["boolean", "bool"]);

export const isBooleanSchemaType = (...types) =>
    types
        .filter((type) => type !== undefined && type !== null && type !== "")
        .map((type) => String(type).toLowerCase())
        .some((type) => BOOLEAN_SQL_TYPES.has(type));

const defaultFields = [
    {
        column_name: "created_by",
        field: SPECIAL_FIELDS.search_users,
    },
    {
        column_name: "updated_by",
        field: SPECIAL_FIELDS.search_users,
    },
    {
        column_name: "created_at",
        field: SPECIAL_FIELDS.date,
    },
    {
        column_name: "updated_at",
        field: SPECIAL_FIELDS.date,
    },
    {
        column_name: "edited_by",
        field: SPECIAL_FIELDS.search_users,
    },
    {
        column_name: "edited_at",
        field: SPECIAL_FIELDS.date,
    },
];

const defaultFieldsNoShow = ["deleted_at", "deleted_by"];

const inferSchemaColumnType = (item) => (item.field_type ?? item.data_type ?? "").toString().toLowerCase();

const toTitleCase = (str) =>
    str
        ?.replace(/_/g, " ")
        .toLowerCase()
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

const toAgentFilterLabel = (columnName) => {
    if (!columnName) return "";
    return columnName.charAt(0).toUpperCase() + columnName.replaceAll("_", " ").substring(1);
};

const isUsableLabel = (label) => Boolean(label) && label !== "undefined";

/**
 * Detects whether a table config represents the Cases table/entity, and returns the "columnsCases"
 * i18n namespace when it does (see resolveGridColumnHeader), else undefined.
 *
 * Checks BOTH `.entity` and `.key` because Cases-derived configs are inconsistent: the main /cases
 * grid and AdminCaseSubCases match on `.entity` (view_casos, shared even though AdminCaseSubCases
 * uses a per-case `.key`), while a saved custom Cases view keeps `.key === URL_AND_KEYS.cases.key`
 * but overrides `.entity` to the view's own name — so entity alone would miss that case.
 *
 * This is the single place that decides "is this a Cases table"; use it everywhere the Cases
 * namespace needs to be derived from a table/nameTable config instead of re-deriving the check.
 */
export const getCasesHeaderNamespace = (config) =>
    config?.entity === URL_AND_KEYS.cases.entity || config?.key === URL_AND_KEYS.cases.key ? "columnsCases" : undefined;

/**
 * Core of the "Cases-specific copy first, then shared copy" lookup shared by
 * resolveGridColumnHeader (below), CasesTableComponent's resolveHeader and HeadersLabelsEditor's
 * resolveLabelText. Given one label candidate, returns the translated text found under
 * `gridMain.<namespace>.<label>` if it translates, else under `gridMain.columns.<label>` if that
 * translates, else `null`.
 *
 * Deliberately does not pick a final fallback (e.g. toTitleCase) itself, since callers differ on
 * what that should be — keep that part where it already lives in each caller.
 */
export const resolveNamespacedColumnLabel = (translate, label, namespace = "columnsCases") => {
    if (namespace) {
        const namespacedKey = `gridMain.${namespace}.${label}`;
        const namespacedText = translate(namespacedKey);
        if (namespacedText !== namespacedKey) return namespacedText;
    }
    const sharedKey = `gridMain.columns.${label}`;
    const sharedText = translate(sharedKey);
    return sharedText !== sharedKey ? sharedText : null;
};

/**
 * Resolves a schema column's header text.
 *
 * `namespace` is an optional Cases-only override: when given, each label candidate is first looked
 * up under `gridMain.<namespace>.*` before falling back to the shared `gridMain.columns.*` key. This
 * lets the Cases table/filter show longer, Cases-specific copy (e.g. "Cuándo se creó el caso" for
 * created_at) without bleeding that copy into every other table that shares these column names
 * (Roles, Groups, Users, export/import, GenerateCsv, ...). Use getCasesHeaderNamespace to derive it
 * from a table config rather than re-deriving the "is this Cases" check here.
 */
export const resolveGridColumnHeader = (column, translate = t, namespace = null) => {
    if (column.column_name === "estadoActual") {
        /*
         * No columnsCases key exists for "Current state" today, so namespace intentionally doesn't
         * apply to this branch — it would be a silent no-op even if passed through.
         */
        const translationKey = "gridMain.columns.Current state";
        const translatedText = translate(translationKey);
        return translatedText !== translationKey ? translatedText : "Estado actual";
    }

    const candidates = [
        isUsableLabel(column.label) ? column.label : null,
        toAgentFilterLabel(column.column_name),
        toTitleCase(column.column_name),
        column.column_name,
    ].filter(Boolean);

    for (const candidate of [...new Set(candidates)]) {
        const resolved = resolveNamespacedColumnLabel(translate, candidate, namespace);
        if (resolved !== null) return resolved;
    }

    return toTitleCase(column.column_name) || "";
};

export const getSchemaFilter = (data = [], fields = [], fieldsNoShow = [], namespace = null) => {
    const injectedFields = fields.filter((f) => f.inject);
    const regularFields = fields.filter((f) => !f.inject);

    fields = [...defaultFields, ...regularFields];
    fieldsNoShow = [...defaultFieldsNoShow, ...fieldsNoShow];
    const result = data
        .filter((item) => !fieldsNoShow.includes(item.column_name))
        .map((item) => {
            const schemaColumnType = inferSchemaColumnType(item);
            const filterColumnsByFieldsProps = fields.find((field) => field.column_name === item.column_name);
            if (filterColumnsByFieldsProps) {
                return {
                    ...item,
                    data_type: filterColumnsByFieldsProps.field,
                    field: filterColumnsByFieldsProps.field,
                    schema_column_type: schemaColumnType,
                };
            }
            return {
                ...item,
                data_type: item.data_type.toLowerCase(),
                schema_column_type: schemaColumnType,
            };
        });

    const getTranslatedHeader = (column) => resolveGridColumnHeader(column, t, namespace);

    const filtered = result.filter((field) => {
        return SPECIAL_FIELDS[field.data_type.toLowerCase()];
    });

    const validInjected = injectedFields.filter(
        (f) => !fieldsNoShow.includes(f.column_name) && SPECIAL_FIELDS[f.data_type?.toLowerCase()],
    );

    return [...validInjected, ...filtered].map((field) => ({
        ...field,
        header: getTranslatedHeader(field),
    }));
};
