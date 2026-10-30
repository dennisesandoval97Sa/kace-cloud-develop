import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const INITIAL_DATA_CLASSIFICATION = {
    nivel1: "",
    nivel2: "",
    nivel3: "",
    nivel4: "",
    nivel5: "",
    nivel6: "",
    nivel7: "",
    nivel8: "",
    nivel9: "",
    nivel10: "",
    flujo_id: "",
    is_active: 1,
    ans_id: "",
    default_group_id: "",
    external_id: "",
    can_start_sub_cases_flow: false,
};

export const HEADERS_CONST_CLASSIFICATION = [
    "nivel1",
    "is_active",
    "can_start_sub_cases_flow",
    "created_at",
    "updated_at",
];

export const INITIAL_DATA_RELATIONSHIPS = {
    form: "",
    lista_grupos: [],
};

export const INITIAL_HEADERS_RELATIONSHIPS = [
    { accessorKey: "group.nombre", header: "", isVisible: true, label: "group" },
    { accessorKey: "one_script.nombre", header: "", isVisible: true, label: "view" },
];

export const dataTableConfig = (case_enable_subcases) => ({
    key: URL_AND_KEYS.classification.key,
    url: URL_AND_KEYS.classification.url,
    view: URL_AND_KEYS.classification.view,
    genericColumns: !case_enable_subcases ? HEADERS_CONST_CLASSIFICATION.filter(
        (column) => column !== "can_start_sub_cases_flow",
    ) : HEADERS_CONST_CLASSIFICATION,
    entity: URL_AND_KEYS.classification.entity,
});

export const FILTER_TRANSFORMATIONS = {
    nivel1: (row) => ({
        ...row,
        label: "nivel1",
        filterData: {
            field: "clasificaciones.nivel1",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    is_active: (row) => ({
        ...row,
        field_type: "boolean",
        filterData: {
            field: "is_active",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
    can_start_sub_cases_flow: (row) => ({
        ...row,
        field_type: "boolean",
        filterData: {
            field: "can_start_sub_cases_flow",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
};

export const INITIAL_NODE = {
    id: "0",
    type: "input",
    data: { label: "inicio" },
    position: { x: 200, y: 100 },
    draggable: false,
    className: "permanent",
};


export const BLANK_NODES = [
    INITIAL_NODE,
    {
        id: "primary-node",
        position: { x: 225, y: 200 },
        data: { id: "primary-node", label: "Clasificacion Primaria", type: "primary" },
        selected: false,
        positionAbsolute: { x: 0, y: 0 },
        dragging: false,
        className: "permanent",
        style: { backgroundColor: "rgb(80, 110, 231)", color: "white" },
    },
];

export const BLANK_EDGES = [
    {
        source: "0",
        target: "primary-node",
        sourceHandle: null,
        targetHandle: null,
        type: "custom",
        id: "reactflow__edge-0-primary-node",
    },
];

export const INITIAL_VALUES_CLASSIFICATION_FLOWS = {
    description: "",
    is_active: true,
    json_diagram_properties: {},
};
