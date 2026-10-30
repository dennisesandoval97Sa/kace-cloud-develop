import { getSchemaFilter, SPECIAL_FIELDS } from "@/services/createSchemaFilter";
import { FILTER_TRANSFORMATIONS } from "../constants";
import { createChildren, handleASeniority, handleFullName, handleStateTimer } from "@/utils/main";
import { CLASSIFICATION_LEVEL_KEYS } from "@/utils/classificationLevels";
import { applyTimeDescriptionDisplay } from "@/utils/src/utils/timeDescriptionPrefix";
import { isExpandableClassificationColumn, isNivelColumn } from "./classificationLevels.util";
import { isIdentityFilterField } from "@/utils/identityFilterField";

export const CLASSIFICATION_LEVEL_DUPLICATE_FILTER_COLUMNS = CLASSIFICATION_LEVEL_KEYS.slice(1);

export const processCasesColumns =
    (isCustomViewEnabled) =>
    (filters = {}, schema) => {
        const viewFilters = schema.map((column) => {
            let operator = "eq";

            if (column.data_type === "string" && !isIdentityFilterField(column.column_name)) {
                operator = "ilike";
            } else if (column.data_type === "date") {
                operator = "between";
            }

            const isNivel1 = column.column_name === "nivel1";

            return {
                ...column,
                ...(isNivel1 ? { label: "ByLevel" } : {}),
                filterData: {
                    field: column.column_name,
                    value: "",
                    type: "AND",
                    operator,
                },
            };
        });

        return {
            ...filters,
            ...(isCustomViewEnabled ? viewFilters : FILTER_TRANSFORMATIONS),
        };
    };

/**
 * Caps the classification level picker (ByLevel) to the levels the active view's real
 * columns actually support. Custom admin views aren't guaranteed to expose nivel1..nivel10
 * (the default view always does, via its join to `clasificaciones`), so without this the
 * picker would offer levels that don't exist in the view and crash the search query.
 *
 * @param {Array<object>} schemaFields - Output of getSchemaFilter for the active view.
 * @param {number} maxLevel - Highest nivel column present in the view (see getMaxAvailableNivelLevel).
 * @returns {Array<object>}
 */
export const attachMaxLevelToClassificationField = (schemaFields = [], maxLevel) =>
    schemaFields.map((field) =>
        field.field === SPECIAL_FIELDS.classification_levels ? { ...field, maxLevel } : field,
    );

export const processCasesFilters = (defaultFilters) => [
    ...defaultFilters,
    {
        column_name: "nivel1",
        field: SPECIAL_FIELDS.classification_levels,
    },
];

export const processCasesData = (
    due_date_for_ans_calculation = false,
    semaphore_by_state_ans = false,
    schema = null,
    show_time_description_prefixes = true,
) => {
    return (data) => {
        try {
            const transformedData =
                handleStateTimer(
                    handleASeniority(
                        handleFullName(
                            createChildren(data),
                            "allCases",
                            due_date_for_ans_calculation,
                            semaphore_by_state_ans,
                        ),
                        show_time_description_prefixes,
                    ),
                    [],
                    schema,
                ) || [];
            return transformedData.map((item) => ({
                ...applyTimeDescriptionDisplay(item, show_time_description_prefixes),
                hasSubcases: (item.subcasos && item.subcasos > 0) || false,
            }));
        } catch {
            // NO-SONAR: Si ocurre un error, se devuelve un arreglo vacío para evitar que falle el proceso y continúe sin interrupciones.
            return [];
        }
    };
};

export const processSchema = (schema) => {
    const defaultIgnoreFields = [
        ...CLASSIFICATION_LEVEL_DUPLICATE_FILTER_COLUMNS,
        "antiguedad",
        "login",
        "caso_clonado_id",
        "antiguedad_horas",
        "antiguedad_minutos",
        "primer_apellido",
        "tipo_cliente",
        "segundo_apellido",
        "usuario_inactivo",
        "color_ans_inicial",
        "color_ans_intermedio",
        "color_ans_final",
        "nombre_empresa",
        "cambio_estado_comentario_id",
        "motivo_baja",
        "created_by",
        "creator_external_id",
        "documento",
        "deleted_at",
        "responsable_id",
        "cliente_id",
        "deleted_at",
        "deleted_by",
    ];

    const classificationFields = [
        {
            column_name: "nivel1",
            field: SPECIAL_FIELDS.classification_levels,
        },
    ];

    const filterIgnoreFields = [...defaultIgnoreFields, "id", "antiguedad_dias", "ans_posicion"];
    const ignoreFields = Array.from(new Set([...filterIgnoreFields]));

    return getSchemaFilter(schema, classificationFields, ignoreFields, "columnsCases");
};

const CUSTOM_VIEW_ALWAYS_HIDDEN_FIELDS = ["deleted_at", "deleted_by"];

const CUSTOM_VIEW_OPTIONAL_SYSTEM_FIELDS = ["id", "responsable_id", "cliente_id"];

export const CUSTOM_VIEW_ALWAYS_FILTERABLE_FIELDS = ["reference"];

export const getCustomViewHiddenFields = (visibleColumns = []) => {
    const selectedColumnNames = new Set((visibleColumns ?? []).map((column) => column.column_name).filter(Boolean));

    return [
        ...CUSTOM_VIEW_ALWAYS_HIDDEN_FIELDS,
        ...CUSTOM_VIEW_OPTIONAL_SYSTEM_FIELDS.filter((field) => !selectedColumnNames.has(field)),
    ];
};

export const buildCustomViewVisibleSchema = (schema, visibleColumns = []) => {
    const classificationFields = [
        {
            column_name: "nivel1",
            field: SPECIAL_FIELDS.classification_levels,
        },
    ];

    if (!visibleColumns?.length) {
        return getSchemaFilter(schema, classificationFields, getCustomViewHiddenFields([]), "columnsCases");
    }

    const selectedColumns = filterVisibleColumns(schema, normalizeVisibleColumns(visibleColumns));

    return getSchemaFilter(selectedColumns, classificationFields, CUSTOM_VIEW_ALWAYS_HIDDEN_FIELDS, "columnsCases");
};

export const processSchemaForCustomView = (schema, visibleColumns = []) =>
    buildCustomViewVisibleSchema(schema, visibleColumns);

export const buildCustomViewFilterSchema = (visibleSchema = [], fullSchema = []) => {
    const visibleColumnNames = new Set(visibleSchema.map((column) => column.column_name));
    const missingFilterFields = CUSTOM_VIEW_ALWAYS_FILTERABLE_FIELDS.map((fieldName) =>
        fullSchema.find((column) => column.column_name === fieldName),
    )
        .filter(Boolean)
        .filter((column) => !visibleColumnNames.has(column.column_name));

    if (!missingFilterFields.length) {
        return visibleSchema;
    }

    return [...missingFilterFields, ...visibleSchema];
};

export const normalizeVisibleColumns = (visibleColumns = []) => {
    if (!visibleColumns.length) return visibleColumns;

    const expandColumn = visibleColumns.find(isExpandableClassificationColumn);
    if (!expandColumn) return visibleColumns;

    return visibleColumns.filter(
        (column) => !isNivelColumn(column.column_name) || column.column_name === expandColumn.column_name,
    );
};

export const filterVisibleColumns = (schema, visibleColumns) => {
    if (!visibleColumns || visibleColumns.length === 0) return schema;

    const normalizedColumns = normalizeVisibleColumns(visibleColumns);

    return normalizedColumns
        .map((vc) => {
            const entry = schema.find((col) => col.column_name === vc.column_name);
            if (!entry) return null;
            return {
                ...entry,
                header_label: vc.header_label,
                cell_type: vc.cell_type,
                ...(vc.separator && { separator: vc.separator }),
                ...(vc.expand_levels !== undefined && { expand_levels: vc.expand_levels }),
            };
        })
        .filter(Boolean);
};

export const headersTransform = (column) => {
    const labelMap = {
        nombres: "Responsible",
        nombre_cliente: "Customer",
        reference: "Consecutivo",
        estadoactual: "Current state",
        nombrecliente: "First names",
        primerapellido: "First surname",
        segundoapellido: "Second surname",
    };

    if (labelMap[column.column_name]) column.label = labelMap[column.column_name];

    return column;
};
