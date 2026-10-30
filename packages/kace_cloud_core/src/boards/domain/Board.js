import {
    ValueObjectDescription,
    ValueObjectInt,
    ValueObjectJson,
    ValueObjectString,
} from '@kace/core/src/shared/index.js';
import { AggregateRoot } from '../../shared/domain/AggregateRoot.js';
import { ValueObjectBoolean } from '../../shared/domain/value-object/ValueObjectBoolean.js';
import { ValueObjectSharedVisualIcon } from '../../shared/domain/value-object/ValueObjectSharedVisualIcon.js';
import { VOBoardOptions } from '@kace/core/src/boards/domain/VOBoardOptions.js';
import { VOBoardColumns } from '@kace/core/src/boards/domain/VOBoardColumns.js';
import { VOBoardHavings } from '@kace/core/src/boards/domain/VOBoardHavings.js';
import { VOBoardRelations } from '@kace/core/src/boards/domain/VOBoardRelations.js';
import { VOBoardAccessGroups } from '@kace/core/src/boards/domain/VOBoardAccessGroups.js';
import { VOBoardAccessUsers } from '@kace/core/src/boards/domain/VOBoardAccessUsers.js';
import { ValueObjectBoardName } from '@kace/core/src/boards/domain/ValueObjectBoardName.js';
import { ValueObjectIcon } from '@kace/core/src/boards/domain/ValueObjectIcon.js';
import { VOBoardQuickAnsFilter } from '@kace/core/src/boards/domain/VOBoardQuickAnsFilter.js';
import { QUICK_ANS_FILTER_DEFAULT_VALUE } from '@kace/core/src/boards/domain/QuickAnsFilterDefaults.js';

/**
 * Domain Aggregate: Board
 * Representa la configuración y definición de un tablero dentro del sistema.
 * Incluye metadatos, relaciones, columnas y configuración de acceso.
 */
export class Board extends AggregateRoot {
    /** @type {ValueObjectBoardName} */
    #name;

    /** @type {ValueObjectBoolean} */
    #is_active;

    /** @type {ValueObjectInt} */
    #page_size;

    /** @type {ValueObjectInt} */
    #display_order;

    /** @type {ValueObjectJson} */
    #criteria;

    /** @type {ValueObjectString} */
    #description;

    /** @type {ValueObjectString} */
    #primary_entity;

    /** @type {ValueObjectIcon} */
    #icon_class;

    /** @type {ValueObjectString} */
    #onescript_form_id;

    /** @type {ValueObjectString} */
    #filter_onescript_id;

    /** @type {VOBoardRelations} */
    #relations;

    /** @type {VOBoardColumns} */
    #columns;

    /** @type {VOBoardHavings} */
    #havings;

    /** @type {VOBoardAccessGroups} */
    #access_groups;

    /** @type {VOBoardAccessUsers} */
    #access_users;

    /** @type {VOBoardOptions} */
    #options;

    /** @type {VOBoardOrder} */
    #orders;

    /** @type {VOBoardQuickAnsFilter} */
    #quick_ans_filter;

    /** @type {ValueObjectBoolean} */
    #can_view_record;

    /** @type {ValueObjectBoolean} */
    #can_create_record;

    /** @type {ValueObjectBoolean} */
    #can_edit_record;

    /** @type {ValueObjectBoolean} */
    #can_admin_bulk_actions;

    /** @type {ValueObjectBoolean} */
    #can_agent_bulk_actions;

    /** @type {ValueObjectBoolean} */
    #can_admin_delete_record;

    /** @type {ValueObjectBoolean} */
    #can_agent_delete_record;

    /**
     * @param {Object} params
     * @param {string} params.id Identificador único del tablero
     * @param {string} params.name Nombre del tablero
     * @param {string} [params.description] Descripción del tablero
     * @param {string} params.primary_entity Entidad principal asociada al tablero
     * @param {Object} [params.criteria={}] Filtros o condiciones aplicadas al tablero
     * @param {number} [params.page_size=25] Tamaño de página para la paginación
     * @param {number|null} [params.display_order=null] Posición del tablero en los listados del agente
     * @param {boolean} [params.is_active=true] Estado del tablero
     * @param {string|null} [params.icon_class=null] Clase de ícono asociada
     * @param {string|null} [params.onescript_form_id=null] Identificador del formulario OneScript asociado
     * @param {string|null} [params.filter_onescript_id=null] Identificador del formulario OneScript para el filtro personalizado
     * @param {Array|null} [params.relations=null] Relaciones asociadas al tablero
     * @param {Array} [params.columns=[]] Columnas definidas del tablero
     * @param {Array} [params.havings=[]] Havings definidos para tablero
     * @param {Array} [params.access_groups=[]] Grupos de acceso asociados
     * @param {Array} [params.access_users=[]] Usuarios de acceso asociados
     * @param {Array} [params.options=[]] Configuraciones adicionales
     * @param {Object|null} [params.quick_ans_filter=null] Configuración del filtro rápido por estado ANS
     * @param {boolean} [params.can_view_record=true]
     * @param {boolean} [params.can_create_record=true]
     * @param {boolean} [params.can_edit_record=true]
     * @param {boolean} [params.can_admin_bulk_actions=false]
     * @param {boolean} [params.can_agent_bulk_actions=false]
     * @param {boolean} [params.can_admin_delete_record=false]
     * @param {boolean} [params.can_agent_delete_record=false]
     * @param {Date} params.created_at Fecha de creación
     * @param {string} params.created_by Usuario creador
     * @param {Date} params.updated_at Fecha de actualización
     * @param {string} params.updated_by Usuario que actualizó
     * @param {Date|null} [params.deleted_at=null] Fecha de eliminación
     * @param {string|null} [params.deleted_by=null] Usuario que eliminó
     */
    constructor(
        {
            id,
            name,
            description = '',
            primary_entity,
            criteria = {},
            page_size = 25,
            display_order = null,
            is_active = true,
            icon_class,
            onescript_form_id,
            filter_onescript_id,
            relations,
            columns = [],
            havings = [],
            access_groups = [],
            access_users = [],
            options = [],
            can_view_record = true,
            can_create_record = true,
            can_edit_record = true,
            can_admin_bulk_actions = false,
            can_agent_bulk_actions = false,
            can_admin_delete_record = false,
            can_agent_delete_record = false,
            created_at,
            created_by,
            updated_at,
            updated_by,
            deleted_at = null,
            deleted_by = null,
            orders,
            quick_ans_filter = null,
        },
        optionsConfig = {}
    ) {
        const { validateVisualOptions = false } = optionsConfig;
        super(id);
        this.#name = new ValueObjectBoardName(name);
        this.#description = new ValueObjectDescription('description', description ?? '');
        this.#primary_entity = new ValueObjectString('primary_entity', primary_entity);
        this.#criteria = new ValueObjectJson('criteria', criteria);
        this.#page_size = new ValueObjectInt('page_size', page_size);
        this.#display_order = new ValueObjectInt('display_order', display_order, true);
        this.#is_active = new ValueObjectBoolean('is_active', is_active);
        this.#icon_class = validateVisualOptions
            ? new ValueObjectSharedVisualIcon('icon_class', icon_class, icon_class === null || icon_class === undefined)
            : new ValueObjectIcon('icon_class', icon_class, true);
        this.#onescript_form_id = new ValueObjectString('onescript_form_id', onescript_form_id, true);
        this.#filter_onescript_id = new ValueObjectString('filter_onescript_id', filter_onescript_id, true);
        this.#relations = new VOBoardRelations(relations, true);
        this.#columns = new VOBoardColumns(columns);
        this.#havings = new VOBoardHavings(havings);
        this.#access_groups = new VOBoardAccessGroups(access_groups);
        this.#access_users = new VOBoardAccessUsers(access_users);
        this.#options = new VOBoardOptions(options);
        this.#orders = new ValueObjectJson('orders', orders, true);
        this.#quick_ans_filter = new VOBoardQuickAnsFilter(quick_ans_filter);
        this.#can_view_record = new ValueObjectBoolean('can_view_record', can_view_record);
        this.#can_create_record = new ValueObjectBoolean('can_create_record', can_create_record);
        this.#can_edit_record = new ValueObjectBoolean('can_edit_record', can_edit_record);
        this.#can_admin_bulk_actions = new ValueObjectBoolean('can_admin_bulk_actions', can_admin_bulk_actions);
        this.#can_agent_bulk_actions = new ValueObjectBoolean('can_agent_bulk_actions', can_agent_bulk_actions);
        this.#can_admin_delete_record = new ValueObjectBoolean('can_admin_delete_record', can_admin_delete_record);
        this.#can_agent_delete_record = new ValueObjectBoolean('can_agent_delete_record', can_agent_delete_record);
        this.created_at = created_at;
        this.created_by = created_by;
        this.updated_at = updated_at;
        this.updated_by = updated_by;
        this.deleted_at = deleted_at;
        this.deleted_by = deleted_by;
    }

    static create(params) {
        return new Board(params, { validateVisualOptions: true });
    }

    get name() {
        return this.#name;
    }
    set name(value) {
        this.#name = new ValueObjectBoardName(value);
        this.changedAttributes.name = value;
    }

    get description() {
        return this.#description;
    }
    set description(value) {
        this.#description = new ValueObjectDescription('description', value);
        this.changedAttributes.description = value;
    }

    get orders() {
        return this.#orders;
    }

    set orders(value) {
        this.#orders = new ValueObjectJson('orders', value, true);
        this.changedAttributes.orders = value;
    }

    get quick_ans_filter() {
        return this.#quick_ans_filter;
    }

    set quick_ans_filter(value) {
        this.#quick_ans_filter = new VOBoardQuickAnsFilter(value);
        this.changedAttributes.quick_ans_filter = this.#quick_ans_filter.value;
    }

    get primary_entity() {
        return this.#primary_entity;
    }
    set primary_entity(value) {
        this.#primary_entity = new ValueObjectString('primary_entity', value);
        this.changedAttributes.primary_entity = value;
    }

    get criteria() {
        return this.#criteria;
    }
    set criteria(value) {
        this.#criteria = new ValueObjectJson('criteria', value);
        this.changedAttributes.criteria = value;
    }

    get page_size() {
        return this.#page_size;
    }
    set page_size(value) {
        this.#page_size = new ValueObjectInt('page_size', value);
        this.changedAttributes.page_size = value;
    }

    get display_order() {
        return this.#display_order;
    }
    set display_order(value) {
        this.#display_order = new ValueObjectInt('display_order', value, true);
        this.changedAttributes.display_order = value;
    }

    get is_active() {
        return this.#is_active;
    }
    set is_active(value) {
        this.#is_active = new ValueObjectBoolean('is_active', value);
        this.changedAttributes.is_active = value;
    }

    get icon_class() {
        return this.#icon_class;
    }
    set icon_class(value) {
        this.#icon_class = new ValueObjectSharedVisualIcon('icon_class', value, value == null);
        this.changedAttributes.icon_class = value;
    }

    get onescript_form_id() {
        return this.#onescript_form_id;
    }
    set onescript_form_id(value) {
        this.#onescript_form_id = new ValueObjectString('onescript_form_id', value, true);
        this.changedAttributes.onescript_form_id = value;
    }

    get filter_onescript_id() {
        return this.#filter_onescript_id;
    }
    set filter_onescript_id(value) {
        this.#filter_onescript_id = new ValueObjectString('filter_onescript_id', value, true);
        this.changedAttributes.filter_onescript_id = value;
    }

    get relations() {
        return this.#relations;
    }
    set relations(value) {
        this.#relations = new VOBoardRelations(value);
        this.changedAttributes.relations = value;
    }

    get columns() {
        return this.#columns;
    }
    set columns(value) {
        this.#columns = new VOBoardColumns(value);
        this.changedAttributes.columns = value;
        this.#reconcileQuickAnsFilter();
    }

    #reconcileQuickAnsFilter() {
        const filter = this.#quick_ans_filter?.value;
        if (!filter?.enabled || !filter?.ans_column_alias) return;
        const columns = this.#columns?.value ?? [];
        const matched = columns.find((c) => c?.alias === filter.ans_column_alias);
        if (!matched || !matched.is_ans) {
            this.#quick_ans_filter = new VOBoardQuickAnsFilter(structuredClone(QUICK_ANS_FILTER_DEFAULT_VALUE));
            this.changedAttributes.quick_ans_filter = this.#quick_ans_filter.value;
        }
    }

    get havings() {
        return this.#havings;
    }

    set havings(value) {
        this.#havings = new VOBoardHavings(value);
        this.changedAttributes.havings = value;
    }

    get access_groups() {
        return this.#access_groups;
    }
    set access_groups(value) {
        this.#access_groups = new VOBoardAccessGroups(value);
        this.changedAttributes.access_groups = value;
    }

    get access_users() {
        return this.#access_users;
    }
    set access_users(value) {
        this.#access_users = new VOBoardAccessUsers(value);
        this.changedAttributes.access_users = value;
    }

    get options() {
        return this.#options;
    }
    set options(value) {
        this.#options = new VOBoardOptions(value);
        this.changedAttributes.options = value;
    }

    get can_view_record() {
        return this.#can_view_record;
    }
    set can_view_record(value) {
        this.#can_view_record = new ValueObjectBoolean('can_view_record', value);
        this.changedAttributes.can_view_record = value;
    }

    get can_create_record() {
        return this.#can_create_record;
    }
    set can_create_record(value) {
        this.#can_create_record = new ValueObjectBoolean('can_create_record', value);
        this.changedAttributes.can_create_record = value;
    }

    get can_edit_record() {
        return this.#can_edit_record;
    }
    set can_edit_record(value) {
        this.#can_edit_record = new ValueObjectBoolean('can_edit_record', value);
        this.changedAttributes.can_edit_record = value;
    }

    get can_admin_bulk_actions() {
        return this.#can_admin_bulk_actions;
    }
    set can_admin_bulk_actions(value) {
        this.#can_admin_bulk_actions = new ValueObjectBoolean('can_admin_bulk_actions', value);
        this.changedAttributes.can_admin_bulk_actions = value;
    }

    get can_agent_bulk_actions() {
        return this.#can_agent_bulk_actions;
    }
    set can_agent_bulk_actions(value) {
        this.#can_agent_bulk_actions = new ValueObjectBoolean('can_agent_bulk_actions', value);
        this.changedAttributes.can_agent_bulk_actions = value;
    }

    get can_admin_delete_record() {
        return this.#can_admin_delete_record;
    }
    set can_admin_delete_record(value) {
        this.#can_admin_delete_record = new ValueObjectBoolean('can_admin_delete_record', value);
        this.changedAttributes.can_admin_delete_record = value;
    }

    get can_agent_delete_record() {
        return this.#can_agent_delete_record;
    }
    set can_agent_delete_record(value) {
        this.#can_agent_delete_record = new ValueObjectBoolean('can_agent_delete_record', value);
        this.changedAttributes.can_agent_delete_record = value;
    }
}
