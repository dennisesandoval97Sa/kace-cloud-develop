const COMMON_COLUMNS = [
    {
        column: "created_at",
        type: "date",
        typeInput: null,
        label: "Fecha de creación",
    },
    {
        column: "updated_at",
        type: "date",
        typeInput: null,
        label: "Fecha de actualización",
    },
    {
        column: "created_by",
        type: "search",
        typeInput: null,
        label: "Creado por",
    },
];

export const VALIDATE_REQUIRED_FIELDS = {
    usuarios: ["id"],
    grupos: ["id", "nombre", "descripcion", "codigo_externo", "horario_id", "rol_id"],
    clasificaciones: ["id", "nivel1", "flujo_id", "ans_id", "grupos", "is_active", "groups"],
};

export const MODULES = {
    usuarios: {
        value: "usuarios",
        key: "users",
        color: "bg-greenCustom",
        textColor: "text-greenCustom",
    },
    grupos: {
        value: "grupos",
        key: "groups",
        color: "bg-greenCustom",
        textColor: "text-greenCustom",
    },
    clasificaciones: {
        value: "clasificaciones",
        key: "classification",
        color: "bg-orangeCustom",
        textColor: "text-orangeCustom",
    },
};

export const FILTERS_BY_MODULE = {
    usuarios: [
        {
            column: "login",
            type: "string",
            typeInput: "text",
            label: "Login",
        },
        {
            column: "nombres",
            type: "string",
            typeInput: "text",
            label: "Nombres",
        },
        {
            column: "apellido1",
            type: "string",
            typeInput: "text",
            label: "Primer apellido",
        },
        {
            column: "apellido2",
            type: "string",
            typeInput: "text",
            label: "Segundo apellido",
        },
        {
            column: "email",
            type: "string",
            typeInput: "email",
            label: "Email",
        },
        {
            column: "telefono",
            type: "string",
            typeInput: "string",
            label: "Teléfono",
        },
        ...COMMON_COLUMNS,
        {
            column: "is_active",
            type: "boolean",
            typeInput: null,
            label: "Estado",
        },
    ],
    grupos: [
        {
            column: "nombre",
            type: "string",
            typeInput: "text",
            label: "Nombre",
        },
        {
            column: "descripcion",
            type: "string",
            typeInput: "text",
            label: "Descripción",
        },
        ...COMMON_COLUMNS,
        {
            column: "status",
            type: "boolean",
            typeInput: null,
            label: "Estado",
        },
    ],
    clasificaciones: [
        {
            column: "nivel1",
            type: "string",
            typeInput: "text",
            label: "Nivel 1",
        },
        {
            column: "nivel2",
            type: "string",
            typeInput: "text",
            label: "Nivel 2",
        },
        {
            column: "nivel3",
            type: "string",
            typeInput: "text",
            label: "Nivel 3",
        },
        {
            column: "nivel4",
            type: "string",
            typeInput: "text",
            label: "Nivel 4",
        },
        {
            column: "nivel5",
            type: "string",
            typeInput: "text",
            label: "Nivel 5",
        },
        {
            column: "nivel6",
            type: "string",
            typeInput: "text",
            label: "Nivel 6",
        },
        {
            column: "nivel7",
            type: "string",
            typeInput: "text",
            label: "Nivel 7",
        },
        {
            column: "nivel8",
            type: "string",
            typeInput: "text",
            label: "Nivel 8",
        },
        {
            column: "nivel9",
            type: "string",
            typeInput: "text",
            label: "Nivel 9",
        },
        {
            column: "nivel10",
            type: "string",
            typeInput: "text",
            label: "Nivel 10",
        },
        {
            column: "descripcion",
            type: "string",
            typeInput: "text",
            label: "Descripción",
        },
        ...COMMON_COLUMNS,
        {
            column: "is_active",
            type: "boolean",
            typeInput: null,
            label: "Estado",
        },
    ],
};

export const COLUMNS_NOT_SHOW_USERS = [
    "password",
    "token",
    "session_id",
    "password_reset_token",
    "intento_login",
    "envio_correo",
    "grid",
    "deleted_at",
    "deleted_by",
    "filters",
    "cognito_hash_data",
    "account_type",
    "id",
    "login",
    "inactivo_desde",
    "inactivo_hasta",
    "fecha_bloqueo",
    "es_externo",
    "updated_at",
    "updated_by",
    "created_at",
    "created_by",
    "refresh_token",
    "last_seen_at",
    "last_login_at",
    "grupo_activo",
];

export const COLUMNS_NOT_SHOW_GROUPS = [
    "permisos",
    "layouts",
    "comportamientos",
    "filter_order",
    "codigos_externos",
    "deleted_at",
    "deleted_by",
    "configuration_id",
];

export const COLUMNS_NOT_SHOW_CLASSIFICATIONS = ["deleted_at", "deleted_by", "default_group_id"];

export const INITIAL_VALUES_PER_MODULE = {
    usuarios: {
        login: "",
        nombres: "",
        apellido1: "",
        apellido2: "",
        email: "",
        telefono: "",
        is_active: true,
        created_at: "",
        updated_at: "",
        created_by: "",
    },
    grupos: {
        nombre: "",
        status: null,
        descripcion: "",
        created_at: "",
        updated_at: "",
        created_by: "",
    },
    clasificaciones: {
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
        descripcion: "",
        is_active: null,
        created_at: "",
        updated_at: "",
        created_by: "",
    },
};
