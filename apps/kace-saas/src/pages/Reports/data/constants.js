import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { t } from "i18next";

export const MAX_DAYS_RANGE = 32;

export const HEADERS_CONSTANT_REPORTS = [
    { key: "name", value: "string", header: t("reports.table.name", "Name") },
    { key: "initial_date", value: "date", header: t("reports.table.initialDate", "Initial Date") },
    { key: "end_date", value: "date", header: t("reports.table.endDate", "End Date") },
    { key: "status", value: "string", header: t("reports.table.status", "Estado") },
    { key: "created_at", value: "date", header: t("reports.table.generationDate") },
];

export const REPORTS_PATH = "/reports";

export const dataTableConfig = {
    key: URL_AND_KEYS.reports.key,
    url: URL_AND_KEYS.reports.url,
    view: URL_AND_KEYS.reports.view,
    genericColumns: HEADERS_CONSTANT_REPORTS.map((field) => field.key),
    entity: URL_AND_KEYS.reports.entity,
};

export const CONDITION_OPTIONS = [
    // Operadores de igualdad
    { value: "equals", label: "Igual a" },
    { value: "neq", label: "Diferente de" },

    // Operadores de comparación
    { value: "gt", label: "Mayor que" },
    { value: "gte", label: "Mayor o igual que" },
    { value: "lt", label: "Menor que" },
    { value: "lte", label: "Menor o igual que" },

    // Operadores de texto
    { value: "like", label: "Contiene" },
    { value: "ilike", label: "Contiene (sin distinguir mayúsculas)" },

    // Operadores de lista
    { value: "in", label: "En la lista" },
    { value: "notIn", label: "No en la lista" },

    // Operadores de rango
    { value: "between", label: "Entre" },

    // Operadores de nulos
    { value: "null", label: "Es nulo" },
    { value: "notNull", label: "No es nulo" },
];

/**
 * Valores iniciales para el formulario de generación de reportes.
 *
 * @constant {Object}
 * @property {string} report - Nombre de la vista/reporte a generar
 * @property {Object} period - Período de tiempo para el reporte
 * @property {string} period.field - Campo de fecha a filtrar (created_at, updated_at, etc.)
 * @property {string} period.initialDate - Fecha inicial en formato YYYY-MM-DD
 * @property {string} period.endDate - Fecha final en formato YYYY-MM-DD
 * @property {Array} conditions - Condiciones adicionales para filtrar el reporte
 */
export const INITIAL_VALUES_REPORTS = {
    report: "",
    period: {
        field: "",
        initialDate: "",
        endDate: "",
    },
    conditions: [],
};

/**
 * Opciones disponibles de reportes para el select
 * @constant {Array}
 */
export const REPORTS_OPTIONS = [
    {
        value: "reports_case_details",
        label: "Reporte de Detalles de Casos",
    },
];

/**
 * Transformaciones de filtros para la tabla de reportes generados.
 * Define cómo se debe filtrar cada campo en el backend.
 *
 * @constant {Object}
 */
export const FILTER_TRANSFORMATIONS = {
    /**
     * Transforma el filtro para el campo nombre
     * @param {Object} row - Fila actual del filtro
     * @returns {Object} Objeto de filtro transformado
     */
    name: (row) => ({
        ...row,
        label: t("reports.table.name"),
        filterData: {
            field: "name",
            operator: "ilike",
            type: "AND",
            value: row?.filterData?.value || "",
        },
    }),

    /**
     * Transforma el filtro para fecha inicial del período
     * @param {Object} row - Fila actual del filtro
     * @returns {Object} Objeto de filtro transformado
     */
    initial_date: (row) => ({
        ...row,
        label: t("reports.table.initialDate"),
        filterData: {
            field: "initial_date",
            operator: "between",
            type: "AND",
            value: row?.filterData?.value || "",
        },
    }),

    /**
     * Transforma el filtro para fecha final del período
     * @param {Object} row - Fila actual del filtro
     * @returns {Object} Objeto de filtro transformado
     */
    end_date: (row) => ({
        ...row,
        label: t("reports.table.endDate"),
        filterData: {
            field: "end_date",
            operator: "between",
            type: "AND",
            value: row?.filterData?.value || "",
        },
    }),

    created_at: (row) => ({
        ...row,
        label: t("reports.table.generationDate"),
        filterData: {
            field: "created_at",
            operator: "between",
            type: "AND",
            value: row?.filterData?.value || "",
        },
    }),
};
