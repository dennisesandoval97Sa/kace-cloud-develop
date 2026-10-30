import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const HEADERS_CONST_BANNERS = [
    "descripcion",
    "fecha_inicio",
    "fecha_fin",
    "status",
    "created_at",
    "updated_at",
];

export const COLORS_BANNER = [
    "#E76E50",
    "#2563EB",
    "#2A9D90",
    "#E8C468",
    "#E78C50",
    "#EB7AA0",
    "#7342D7",
    "#1FABC7",
    "#66CC33",
    "#2BA17A",
    "#3359CC",
    "#A17345",
    "#BD4FD8",
];

export const POSITIONS_BANNER = [
    { value: "top-center", label: "Arriba" },
    { value: "bottom-center", label: "Abajo" },
];

export const SITE_TO_SHOW_BANNER = [
    { value: "admin", label: "Administrador" },
    { value: "agent", label: "Agente" },
    { value: "both", label: "Administrador y agente" },
];

export const dataTableConfig = {
    key: URL_AND_KEYS.banners.key,
    url: URL_AND_KEYS.banners.url,
    view: URL_AND_KEYS.banners.view,
    genericColumns: HEADERS_CONST_BANNERS,
    entity: URL_AND_KEYS.banners.entity,
};

export const FILTER_TRANSFORMATIONS = {
    descripcion: (row) => ({
        ...row,
        label: "descripcion",
        filterData: {
            field: "banners.descripcion",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    fecha_inicio: (row) => ({
        ...row,
        column_name: "fecha_inicio",
        filterData: {
            field: "banners.fecha_inicio",
            operator: "between",
            type: "AND",
            value: "",
        },
    }),
    fecha_fin: (row) => ({
        ...row,
        column_name: "fecha_fin",
        filterData: {
            field: "banners.fecha_fin",
            operator: "between",
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
};
