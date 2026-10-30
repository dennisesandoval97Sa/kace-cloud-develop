import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const casesDataTableConfig = {
    url: URL_AND_KEYS.cases.url,
    key: URL_AND_KEYS.cases.key,
    view: URL_AND_KEYS.cases.view,
    genericColumns: [
        "nivel1",
        "nombres",
        "nombre_cliente",
        "estado_actual",
        "created_at",
        "updated_at",
        "antiguedad_dias",
        "fecha_resolucion",
        "reference",
    ],
    entity: URL_AND_KEYS.cases.entity,
};

export const FILTER_TRANSFORMATIONS = {
    nivel1: (row) => ({
        ...row,
        label: "ByLevel",
        filterData: {
            field: "clasificaciones.nivel1",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    reference: (row) => ({
        ...row,
        label: "Consecutivo",
        filterData: {
            field: "cases.reference",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
    nombres: (row) => ({
        ...row,
        label: "Responsible",
        filterData: {
            field: "responsable.nombres",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    nombre_cliente: (row) => ({
        ...row,
        column_name: "nombreCliente",
        filterData: {
            field: "clients.nombres",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    estado_actual: (row) => ({
        ...row,
        column_name: "estadoActual",
        filterData: {
            field: "estados.nombre",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    antiguedad_dias: (row) => ({
        ...row,
        filterData: {
            field: "cases.antiguedad_dias",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
    fecha_resolucion: (row) => ({
        ...row,
        filterData: {
            field: "cases.fecha_resolucion",
            operator: "between",
            type: "AND",
            value: "",
        },
    }),
};

export const ACTION_GROUPS = {
    RESOLVED: ["Calendario", "Ver caso", "Re-abrir caso", "Clonar caso"],
    UNRESOLVED: [
        "Calendario",
        "Ver caso",
        "Re-asignar caso",
        "Clonar caso",
        "Cerrar caso",
    ],
};
