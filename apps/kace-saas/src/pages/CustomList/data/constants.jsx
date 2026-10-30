import { URL_AND_KEYS } from "@/utils/urlAndKeys";

/**
 * Definición de las columnas de la tabla de listas personalizadas.
 * Cada objeto define una columna con su clave, tipo de dato y encabezado.
 *
 * @constant {Array<Object>}
 * @property {string} key - Clave del campo en los datos
 * @property {string} value - Tipo de dato (string, boolean, datetime)
 * @property {string} header - Texto del encabezado de la columna
 */
export const HEADERS_CONSTANT_CUSTOM_LISTS = [
    { key: "name", value: "string", header: "Name" },
    { key: "aux_entity", value: "string", header: "Auxiliary" },
    { key: "is_active", value: "boolean", header: "Status" },
    { key: "created_by", value: "string", header: "Created" },
    { key: "updated_at", value: "datetime", header: "Updated" },
    { key: "created_at", value: "datetime", header: "Created" },
];

/**
 * Valores iniciales del formulario de listas personalizadas.
 * Se usa tanto para crear nuevas listas como para resetear el formulario.
 *
 * @constant {Object}
 * @property {string} name - Nombre de la lista personalizada
 * @property {boolean} is_active - Estado activo/inactivo de la lista
 * @property {string} aux_entity - Nombre del esquema auxiliar asociado
 * @property {string} schema_id - ID del schema asociado
 * @property {string} aux_definition_id - ID del aux_definition seleccionado
 * @property {Array} aux_items - Items auxiliares asociados a la lista
 * @property {Array} groups - Grupos con acceso a la lista
 */
export const INITIAL_VALUES_CUSTOM_LISTS = {
    name: "",
    is_active: true,
    aux_entity: "",
    schema_id: "",
    aux_definition_id: "",
    aux_items: [],
    groups: [],
};

export const CUSTOM_LISTS_PATH = "/custom-lists";

export const CUSTOM_LISTS = {
    form: "CustomListForm",
};

/**
 * Opciones para el tipo de lista en el selector.
 * Define los tipos de listas personalizadas disponibles en el sistema.
 *
 * @constant {Array<Object>}
 * @property {Array<Object>} data - Array de opciones
 * @property {string} data[].label - Clave de traducción para el label
 * @property {string} data[].value - Valor del tipo de lista
 */
export const TIPO_LISTA_OPTIONS = [
    {
        data: [
            {
                label: "app.text.simpleList",
                value: "simple",
            },
            {
                label: "app.text.keyValueList",
                value: "key_value",
            },
            {
                label: "app.text.hierarchicalList",
                value: "hierarchical",
            },
        ],
    },
];

/**
 * Configuración del DataTable para listas personalizadas.
 * Define la estructura y endpoints para la carga y gestión de datos.
 *
 * @constant {Object}
 * @property {string} key - Clave única para identificar el DataTable
 * @property {string} url - URL base del endpoint de listas personalizadas
 * @property {string} view - URL para vista individual
 * @property {Array<string>} genericColumns - Columnas a mostrar en la tabla
 * @property {string} entity - Nombre de la entidad en el backend
 */
export const dataTableConfig = {
    key: URL_AND_KEYS.customLists.key,
    url: URL_AND_KEYS.customLists.url,
    view: URL_AND_KEYS.customLists.view,
    genericColumns: HEADERS_CONSTANT_CUSTOM_LISTS.map((field) => field.key),
    entity: URL_AND_KEYS.customLists.entity,
};

/**
 * Transformaciones de filtros personalizadas para cada columna del DataTable.
 * Define cómo se debe filtrar cada campo en el backend.
 *
 * @constant {Object}
 * @property {Function} name - Transforma filtro para el campo nombre
 * @property {Function} aux_entity - Transforma filtro para el campo auxiliar
 * @property {Function} created_by - Transforma filtro para el campo creador
 */
export const FILTER_TRANSFORMATIONS = {
    /**
     * Transforma el filtro para el campo nombre
     * @param {Object} row - Fila actual del filtro
     * @returns {Object} Objeto de filtro transformado
     */
    name: (row) => ({
        ...row,
        filterData: {
            field: "custom_lists.name",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),

    /**
     * Transforma el filtro para el campo auxiliar
     * @param {Object} row - Fila actual del filtro
     * @returns {Object} Objeto de filtro transformado
     */
    aux_entity: (row) => ({
        ...row,
        filterData: {
            field: "custom_lists.aux_entity",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),

    /**
     * Transforma el filtro para el campo creado por
     * @param {Object} row - Fila actual del filtro
     * @returns {Object} Objeto de filtro transformado
     */
    created_by: (row) => ({
        ...row,
        filterData: {
            field: "custom_lists.created_by",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
};
