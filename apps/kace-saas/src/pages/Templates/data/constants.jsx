import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const HEADERS_CONSTANT_TEMPLATES = [
    { key: "descripcion", value: "string", header: "Descripción" },
    { key: "copia", value: "string", header: "Copia" },
    { key: "copia_oculta", value: "string", header: "Copia Oculta" },
    { key: "asunto", value: "string", header: "Asunto" },
    {
        key: "enviar_adjuntos_del_caso",
        value: "boolean",
        header: "Enviar adjuntos del caso",
    },
    { key: "status", value: "string", header: "Estado" },
    { key: "updated_at", value: "updated_at", header: "updated_at" },
    { key: "created_at", value: "created_at", header: "created_at" },
];

export const INITIAL_VALUES_TEMPLATES = {
    tipo: "",
    descripcion: "",
    destinatario: "",
    copia: "",
    copia_oculta: "",
    asunto: "",
    cuerpo: "",
    ruta: "",
    incluye_adjuntos: false,
    enviar_adjuntos_del_caso: false,
    status: "1",
};

export const RECIPIENTS_OPTIONS = [
    {
        data: [
            {
                label: "app.text.sendEmailClient",
                value: "clients.email",
            },
            {
                label: "app.text.sendEmailResponsible",
                value: "usuarios.email",
            },
        ],
    },
];

export const dataTableConfig = {
    key: URL_AND_KEYS.templates.key,
    url: URL_AND_KEYS.templates.url,
    view: URL_AND_KEYS.templates.view,
    genericColumns: HEADERS_CONSTANT_TEMPLATES.map((field) => field.key),
    entity: URL_AND_KEYS.templates.entity,
};

export const FILTER_TRANSFORMATIONS = {
    descripcion: (row) => ({
        ...row,
        label: "descripcion",
        filterData: {
            field: "plantillas.descripcion",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    copia: (row) => ({
        ...row,
        label: "copia",
        filterData: {
            field: "plantillas.copia",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    copia_oculta: (row) => ({
        ...row,
        label: "copia_oculta",
        filterData: {
            field: "plantillas.copia_oculta",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    asunto: (row) => ({
        ...row,
        label: "asunto",
        filterData: {
            field: "plantillas.asunto",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    status: (row) => ({
        ...row,
        filterData: {
            field: "status",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
    enviar_adjuntos_del_caso: (row) => ({
        ...row,
        label: "enviar_adjuntos_del_caso",
        data_type: "switch_state",
        field: "switch_state",
        filterData: {
            field: "plantillas.enviar_adjuntos_del_caso",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
};
