import { createElement } from "react";
import { Archive, BookUser, Filter } from "lucide-react";
import { Uuid } from "@kace/plugins";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const HEADERS_CONSTANT_MASSIVE_EXECUTION = [
    "type",
    "is_pending",
    "total_records",
    "processed_records",
    "failed_records",
    "start_at",
    "end_at",
    "created_at",
    "updated_at",
];

export const HEADERS_CONSTANT_MASSIVE_EXECUTION_CASES = [
    "reference",
    "created_at",
    "estado_actual",
    "antiguedad_dias",
    "updated_at",
    "nombres",
    "nombre_cliente",
    "fecha_resolucion",
    "nivel1",
];

/*
 * Claves de `gridMain.columns` para los campos de caso cuya etiqueta del backend falta o es
 * ambigua en este contexto (p. ej. `nombre_cliente` llega como "First names").
 * Aplican a los encabezados de la tabla de resultados y al filtro por caso.
 */
export const MASSIVE_EXECUTION_CASES_LABELS = {
    reference: "Consecutivo",
    nombres: "Responsible",
    nombre_cliente: "Customer",
};

// Solo el filtro: en la tabla de resultados `nivel1` es la columna "Nivel 1", no "Niveles".
export const MASSIVE_EXECUTION_CASES_FILTER_LABELS = {
    ...MASSIVE_EXECUTION_CASES_LABELS,
    nivel1: "Levels",
    parent_id: "Parent case ID",
    fecha_vencimiento: "Due date",
    estado_id: "State ID",
    grupo_nombre: "Group name",
    edited_at: "Edited at",
    edited_by: "Edited by",
};

export const HEADERS_CONSTANT_MASSIVE_EXECUTION_CLIENTS = [
    "nombres",
    "tipo_documento",
    "documento",
    "created_at",
    "updated_at",
];

export const TABS_CONSTANT_MASSIVE_EXECUTION = [
    {
        id: Uuid(),
        labelKey: "massiveExecution.tabs.clients",
        value: "clients",
        icon: createElement(Filter, { width: 18, height: 18 }),
    },
    {
        id: Uuid(),
        labelKey: "massiveExecution.tabs.filter",
        value: "filter",
        icon: createElement(Filter, { width: 18, height: 18 }),
    },
    {
        id: Uuid(),
        labelKey: "massiveExecution.tabs.file",
        value: "file",
        icon: createElement(Archive, { width: 18, height: 18 }),
    },
    {
        id: Uuid(),
        labelKey: "massiveExecution.tabs.fileClients",
        value: "file_clients",
        icon: createElement(BookUser, { width: 18, height: 18 }),
    },
];

export const dataTableConfig = {
    key: URL_AND_KEYS.actionJobs.key,
    url: URL_AND_KEYS.actionJobs.url,
    view: URL_AND_KEYS.actionJobs.view,
    genericColumns: HEADERS_CONSTANT_MASSIVE_EXECUTION,
    entity: URL_AND_KEYS.actionJobs.entity,
};

export const FILTER_TRANSFORMATIONS = {
    type: (row) => ({
        ...row,
        filterData: {
            field: "type",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    total_records: (row) => ({
        ...row,
        filterData: {
            field: "total_records",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
    processed_records: (row) => ({
        ...row,
        filterData: {
            field: "processed_records",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
    failed_records: (row) => ({
        ...row,
        filterData: {
            field: "failed_records",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
    start_at: (row) => ({
        ...row,
        filterData: {
            field: "start_at",
            operator: "between",
            type: "AND",
            value: "",
        },
    }),
    end_at: (row) => ({
        ...row,
        filterData: {
            field: "start_at",
            operator: "between",
            type: "AND",
            value: "",
        },
    }),
};
