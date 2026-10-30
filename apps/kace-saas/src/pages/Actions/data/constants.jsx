import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { GROUP_LIST_SERVICE, USER_LIST_SERVICE, ACTION_UPDATE_MODEL } from "../../../utils/URL";
import { WS_FLOWS_SERVICE } from "@kace/utils";

export const INITIAL_HEADERS_ACTIONS = ["priority", "action_type", "description", "is_active"];

export const LIST_BY_FORM = {
    asignar_lista_asesores: {
        url: `${USER_LIST_SERVICE}/search`,
        name: "listUsers",
        label: "Lista asesores",
        labelFrom: "descripcion",
        field: "advisor_list_id",
    },
    asignar_lista_grupos: {
        url: `${GROUP_LIST_SERVICE}/search`,
        name: "listGroups",
        label: "Lista de grupos",
        labelFrom: "descripcion",
        field: "group_list_id",
    },
    asignar_grupo_por_codigo_externo_dinamico: {
        url: null,
        name: "listGroupExternalCode",
        label: "Grupos código externo",
        labelFrom: "descripcion",
        field: "external_group_dynamic_code",
        auxiliary: "aux_cases",
    },
    asignar_usuario_por_codigo_externo_dinamico: {
        url: null,
        name: "listUserExternalCode",
        label: "Usuario código externo",
        labelFrom: "descripcion",
        field: "external_user_dynamic_code",
        auxiliary: "aux_cases",
    },
    actualizar_modelo: {
        url: `${ACTION_UPDATE_MODEL}/search`,
        name: "updateModel",
        label: "Actualización modelo",
        labelFrom: "description",
        field: "model_update_id",
    },
    consumo_rest_flow: {
        url: `${WS_FLOWS_SERVICE}/search`,
        name: "ws_rest_flow_id",
        label: "Ws flow",
        labelFrom: "description",
        field: "ws_rest_flow_id",
        filter: [
            { field: "is_active", operator: "eq", value: 1, type: "AND" },
            { field: "is_primary", operator: "eq", value: "true", type: "AND" },
        ],
        pageSize: 50,
    },
    supportModel: {
        url: null,
        name: "supportModel",
        label: "Modelo A Respaldar",
        labelFrom: "descripcion",
    },
};

export const INITIAL_VALUES_ACTIONS = {
    action_type: "",
    description: "",
    conditions: {
        combinator: "and",
        rules: [{ field: "", operator: "=", value: "" }],
    },
    triggers: [],
    permissions: {
        blackList: {
            grupos: [],
            usuarios: [],
        },
        whiteList: {
            usuarios: [],
        },
    },
    state_id: "",
    group_id: "",
    responsible_id: "",
    mail_account_id: "",
    advisor_list_id: "",
    group_list_id: "",
    ws_rest_flow_id: "",
    model_update_id: "",
    external_group_code: "",
    external_user_code: "",
    template_id: "",
    is_active: true,
    priority: 99,
    entity: "case",
};

export const ACTION_MENU_GROUPS = {
    ADVISOR_ASSIGNMENT: "advisorAssignment",
    GROUP_ASSIGNMENT: "groupAssignment",
    USER_ASSIGNMENT: "userAssignment",
    TOP_LEVEL: "topLevel",
};

export const LIST_FORMS_ACTIONS = [
    {
        title: "actions.title.ongoingAdvisor",
        valueForm: "ongoingAdvisor",
        menuGroup: ACTION_MENU_GROUPS.ADVISOR_ASSIGNMENT,
    },
    {
        title: "actions.title.listOfAdvisors",
        valueForm: "listOfAdvisors",
        menuGroup: ACTION_MENU_GROUPS.ADVISOR_ASSIGNMENT,
    },
    {
        title: "actions.title.ongoingGroup",
        valueForm: "ongoingGroup",
        menuGroup: ACTION_MENU_GROUPS.GROUP_ASSIGNMENT,
    },
    {
        title: "actions.title.listOfGroups",
        valueForm: "listOfGroups",
        menuGroup: ACTION_MENU_GROUPS.GROUP_ASSIGNMENT,
        hidden: true,
    },
    {
        title: "actions.title.groupToExternalCode",
        valueForm: "groupToExternalCode",
        menuGroup: ACTION_MENU_GROUPS.GROUP_ASSIGNMENT,
    },
    {
        title: "actions.title.groupToDynamicExternalCode",
        valueForm: "groupToDynamicExternalCode",
        menuGroup: ACTION_MENU_GROUPS.GROUP_ASSIGNMENT,
    },
    {
        title: "actions.title.userToExternalCode",
        valueForm: "userToExternalCode",
        menuGroup: ACTION_MENU_GROUPS.USER_ASSIGNMENT,
    },
    {
        title: "actions.title.userToDynamicExternalCode",
        valueForm: "userToDynamicExternalCode",
        menuGroup: ACTION_MENU_GROUPS.USER_ASSIGNMENT,
    },
    { title: "actions.title.sendEmail", valueForm: "sendEmail", menuGroup: ACTION_MENU_GROUPS.TOP_LEVEL },
    { title: "actions.title.updateModel", valueForm: "updateModel", menuGroup: ACTION_MENU_GROUPS.TOP_LEVEL },
    {
        title: "actions.title.webServiceConsumption",
        valueForm: "webServiceConsumption",
        menuGroup: ACTION_MENU_GROUPS.TOP_LEVEL,
    },
    {
        title: "actions.title.supportModel",
        valueForm: "supportModel",
        menuGroup: ACTION_MENU_GROUPS.TOP_LEVEL,
        disabled: true,
    },
];

export const ACTION_TYPE_VALUE = {
    ongoingAdvisor: "asignar_asesor_en_curso",
    listOfAdvisors: "asignar_lista_asesores",
    ongoingGroup: "asignar_grupo_en_curso",
    listOfGroups: "asignar_lista_grupos",
    groupToExternalCode: "asignar_grupo_por_codigo_externo",
    groupToDynamicExternalCode: "asignar_grupo_por_codigo_externo_dinamico",
    userToExternalCode: "asignar_usuario_por_codigo_externo",
    userToDynamicExternalCode: "asignar_usuario_por_codigo_externo_dinamico",
    sendEmail: "envio_correo",
    updateModel: "actualizar_modelo",
    webServiceConsumption: "consumo_rest_flow",
    supportModel: "respaldar modelo",
};

export const allowedKeysData = [
    "antiguedad_dias",
    "antiguedad_horas",
    "antiguedad_minutos",
    "reference",
    "state_elapsed_days",
    "state_elapsed_hours",
    "state_elapsed_minutes",
    "nivel1",
    "nivel2",
    "nivel3",
    "nivel4",
    "nivel5",
    "nivel6",
    "nivel7",
    "nivel8",
    "nivel9",
    "nivel10",
    "tipo_cliente",
    "tipo_documento",
    "documento",
    "nombres",
    "apellido1",
    "apellido2",
    "nombre_empresa",
    "estado_civil",
    "fecha_nacimiento",
    "email",
    "email_alterno",
    "telefono",
    "telefono_alterno",
    "campos_extra1",
    "campos_extra2",
    "campos_extra3",
    "status",
    "padre_id",
    "habeas_data",
    "responsable_id",
    "movil",
    "is_active",
    "rol_id",
    "inactivo_desde",
    "inactivo_hasta",
    "fecha_bloqueo",
    "grupo_activo",
    "external_id",
    "account_type",
    "es_externo",
    "cognito_hash_data",
    "horario_id",
    "descripcion",
    "codigo_externo",
    "last_seen_at",
    "is_visible",
    "assignment_change_type",
];

export const optionsBuilderObject = [
    {
        dataOrigin: "clasificaciones",
        options: [],
    },
    {
        dataOrigin: "cases",
        options: [],
    },
    {
        dataOrigin: "clients",
        options: [],
    },
    {
        dataOrigin: "usuarios",
        options: [],
    },
    {
        dataOrigin: "grupos",
        options: [],
    },
];

export const VALUELESS_OPERATORS = ["null", "notNull", "isEmpty", "isNotEmpty"];

/** Page size for the rule-builder entity pickers (paginated list and search results). */
export const BUILDER_PAGE_SIZE = 20;

export const COMPARISON_TYPE_OPTIONS = [
    { label: "actions.labels.manualInput", value: "manual_input" },
    { label: "actions.labels.entity", value: "entity" },
    { label: "actions.labels.function", value: "function" },
];

export const VALUE_TYPE_OPTIONS = [
    { label: "actions.labels.date", value: "date" },
    { label: "actions.labels.number", value: "number" },
    { label: "actions.labels.text", value: "text" },
];

export const FUNCTION_OPTIONS = [
    { label: "actions.labels.functionDateHour", value: "datetime" },
    { label: "actions.labels.functionDate", value: "date" },
    { label: "actions.labels.functionHour", value: "time" },
];

export const dataTableConfig = {
    key: URL_AND_KEYS.actions.key,
    url: URL_AND_KEYS.actions.url,
    view: URL_AND_KEYS.actions.view,
    genericColumns: ["action_type", "description", "priority", "is_active", "created_at", "updated_at"],
    entity: URL_AND_KEYS.actions.entity,
};

export const FILTER_TRANSFORMATIONS = {
    description: (row) => ({
        ...row,
        label: "description",
        filterData: {
            field: "description",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    priority: (row) => ({
        ...row,
        filterData: {
            field: "priority",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
    action_type: (row) => ({
        ...row,
        filterData: {
            field: "action_type",
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
};

export const ENTITIES_OPTIONS = [
    { label: "Casos", value: "case" },
    { label: "Usuarios", value: "user" },
    { label: "Grupos", value: "group" },
];

export const ENTITIES_CATEGORY_OPTIONS = {
    case: [
        { id: "category_option_cases", label: "actions.form.cases", value: "cases" },
        { id: "category_option_classifications", label: "actions.form.classifications", value: "clasificaciones" },
        { id: "category_option_clients", label: "actions.form.clients", value: "clients" },
        { id: "category_option_aux_clients", label: "actions.form.auxClient", value: "aux_clients" },
        { id: "category_option_aux_cases", label: "actions.form.auxCase", value: "aux_cases" },
    ],
    user: [
        { id: "category_option_users", label: "actions.form.users", value: "usuarios" },
        { id: "category_option_aux_users", label: "actions.form.auxUsers", value: "aux_users" },
    ],
    group: [
        { id: "category_option_groups", label: "actions.form.grupos", value: "grupos" },
        { id: "category_option_aux_groups", label: "actions.form.auxGroups", value: "aux_groups" },
    ],
};
