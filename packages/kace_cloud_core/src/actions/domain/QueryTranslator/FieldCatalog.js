import { InvalidArgumentError } from '../../../shared/index.js';

const SAFE_SEGMENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const CASES_COLUMNS = new Set([
    'id',
    'cliente_id',
    'transicion_id',
    'responsable_id',
    'clasificacion_id',
    'descripcion_caso_id',
    'cambio_estado_comentario_id',
    'caso_clonado_id',
    'grupo_id',
    'fecha_resolucion',
    'antiguedad',
    'ans_posicion',
    'antiguedad_dias',
    'antiguedad_horas',
    'antiguedad_minutos',
    'motivo_baja',
    'alto_impacto',
    'vista',
    'created_at',
    'updated_at',
    'deleted_at',
    'created_by',
    'updated_by',
    'deleted_by',
    'expired_at',
    'remaining_time',
    'cambio_clasificacion',
    'cloned_by',
    'cloned_at',
    'reopen_at',
    'reopen_by',
    'closed_at',
    'closed_by',
    'edited_by',
    'edited_at',
    'reference',
    'state_change_at',
    'state_elapsed_days',
    'state_elapsed_hours',
    'state_elapsed_minutes',
    'state_elapsed_time',
    'external_code',
    'folio',
    'sla_id',
    'sla_due_date',
    'sla_elapsed_time',
    'sla_elapsed_days',
    'sla_elapsed_hours',
    'sla_elapsed_minutes',
    'sla_remaining_time',
    'sla_remaining_days',
    'sla_remaining_hours',
    'sla_remaining_minutes',
    'sla_position',
    'sla_state_id',
    'sla_state_due_date',
    'sla_state_elapsed_time',
    'sla_state_elapsed_days',
    'sla_state_elapsed_hours',
    'sla_state_elapsed_minutes',
    'sla_state_remaining_time',
    'sla_state_remaining_days',
    'sla_state_remaining_hours',
    'sla_state_remaining_minutes',
    'sla_state_position',
    'parent_id',
    'is_visible',
    'last_assigned_at',
    'update_source',
    'assignment_change_type',
]);

const CLASIFICACIONES_COLUMNS = new Set([
    'id',
    'nivel1',
    'nivel2',
    'nivel3',
    'nivel4',
    'nivel5',
    'nivel6',
    'nivel7',
    'nivel8',
    'nivel9',
    'nivel10',
    'folio_config_id',
]);

const ESTADOS_COLUMNS = new Set(['id', 'nombre']);

const CLIENTS_COLUMNS = new Set([
    'id',
    'tipo_documento',
    'documento',
    'fecha_nacimiento',
    'nombres',
    'apellido1',
    'apellido2',
    'campos_extra1',
    'campos_extra2',
    'campos_extra3',
    'pais',
    'ciudad',
    'email',
    'telefono',
    'genero',
    'created_at',
    'updated_at',
]);

/**
 * A domain-scoped catalog that resolves rule field paths to SQL descriptors,
 * builds SQL column expressions, and emits join plans for a query base table.
 *
 * Used by QueryTranslator + RuleTranslatabilityAnalyzer to translate the safe
 * SQL subset of action rules. One catalog instance per domain (cases, users, groups).
 */
export class FieldCatalog {
    /**
     * @param {Object} cfg
     * @param {Object<string, Set<string>>} cfg.columnTables   table → whitelisted column names
     * @param {Object<string, { table: string, column: string }>} cfg.jsonPrefixes
     *   prefix used in field paths (e.g. "aux_users") → physical column to dereference with #>>
     * @param {Object<string, { kind: 'column', table: string, column: string }>} [cfg.aliases]
     *   field path → fixed descriptor overrides (e.g. "cases.estadoActual" → estados.id)
     * @param {(referencedTables: Set<string>, baseTable: string) => Array<{ table: string, on: [string, string] }>} cfg.joinPlanner
     *   given the set of tables referenced by rules and the FROM table of the base query,
     *   returns the left joins to apply (in order)
     */
    constructor({ columnTables, jsonPrefixes, aliases = {}, joinPlanner }) {
        if (!columnTables || typeof columnTables !== 'object') {
            throw new InvalidArgumentError('FieldCatalog requires columnTables');
        }
        if (!jsonPrefixes || typeof jsonPrefixes !== 'object') {
            throw new InvalidArgumentError('FieldCatalog requires jsonPrefixes');
        }
        if (typeof joinPlanner !== 'function') {
            throw new InvalidArgumentError('FieldCatalog requires a joinPlanner function');
        }
        this.columnTables = columnTables;
        this.jsonPrefixes = jsonPrefixes;
        this.aliases = aliases;
        this.joinPlanner = joinPlanner;
    }

    /** Resolve a "prefix.rest" field path to a descriptor or null when unknown. */
    resolve(fieldPath) {
        if (typeof fieldPath !== 'string' || fieldPath.length === 0) return null;
        if (this.aliases[fieldPath]) return this.aliases[fieldPath];

        const dot = fieldPath.indexOf('.');
        if (dot === -1) return null;
        const prefix = fieldPath.slice(0, dot);
        const rest = fieldPath.slice(dot + 1);

        if (this.columnTables[prefix]) {
            if (!this.columnTables[prefix].has(rest)) return null;
            return { kind: 'column', table: prefix, column: rest };
        }

        if (this.jsonPrefixes[prefix]) {
            const segments = rest.split('.');
            if (segments.length === 0) return null;
            if (!segments.every((s) => SAFE_SEGMENT.test(s))) return null;
            const { table, column } = this.jsonPrefixes[prefix];
            return { kind: 'jsonPath', table, jsonColumn: column, path: segments };
        }

        return null;
    }

    /** Build the SQL expression (column or JSON path) for a descriptor. */
    columnExpression(descriptor) {
        if (descriptor.kind === 'column') return `${descriptor.table}.${descriptor.column}`;
        if (descriptor.kind === 'jsonPath') {
            return `${descriptor.table}.${descriptor.jsonColumn} #>> '{${descriptor.path.join(',')}}'`;
        }
        throw new Error(`Unsupported descriptor kind: ${descriptor.kind}`);
    }

    /** Forward referenced-tables + baseTable to the configured joinPlanner. */
    describeJoins(referencedTables, baseTable) {
        return this.joinPlanner(referencedTables, baseTable);
    }
}

const USUARIOS_COLUMNS = new Set([
    'id',
    'login',
    'nombres',
    'apellido1',
    'apellido2',
    'email',
    'telefono',
    'movil',
    'rol_id',
    'grupo_activo',
    'codigos_externos',
    'external_id',
    'is_active',
    'account_type',
    'inactivo_desde',
    'inactivo_hasta',
    'fecha_bloqueo',
    'intento_login',
    'created_at',
    'updated_at',
    'deleted_at',
    'created_by',
    'updated_by',
    'deleted_by',
    'last_login_at',
    'last_integration_active_at',
]);

export function createUsersFieldCatalog() {
    return new FieldCatalog({
        columnTables: {
            usuarios: USUARIOS_COLUMNS,
        },
        jsonPrefixes: {
            aux_users: { table: 'usuarios', column: 'data' },
        },
        aliases: {},
        joinPlanner: () => [],
    });
}

const GRUPOS_COLUMNS = new Set([
    'id',
    'nombre',
    'status',
    'descripcion',
    'codigo_externo',
    'codigos_externos',
    'rol_id',
    'horario_id',
    'configuration_id',
    'filter_order',
    'created_at',
    'updated_at',
    'deleted_at',
    'created_by',
    'updated_by',
    'deleted_by',
]);

export function createGroupsFieldCatalog() {
    return new FieldCatalog({
        columnTables: {
            grupos: GRUPOS_COLUMNS,
        },
        jsonPrefixes: {
            aux_groups: { table: 'grupos', column: 'data' },
        },
        aliases: {},
        joinPlanner: () => [],
    });
}

export function createCasesFieldCatalog() {
    return new FieldCatalog({
        columnTables: {
            cases: CASES_COLUMNS,
            clasificaciones: CLASIFICACIONES_COLUMNS,
            estados: ESTADOS_COLUMNS,
            clients: CLIENTS_COLUMNS,
        },
        jsonPrefixes: {
            aux_cases: { table: 'aux_cases', column: 'data' },
            aux_clients: { table: 'aux_clients', column: 'data' },
            aux_users: { table: 'aux_users', column: 'data' },
        },
        aliases: {
            'cases.estadoActual': { kind: 'column', table: 'estados', column: 'id' },
            'clasificaciones.description': { kind: 'column', table: 'cases', column: 'clasificacion_id' },
        },
        joinPlanner: (tables) => {
            const joins = [];
            if (tables.has('clients')) {
                joins.push({ table: 'clients', on: ['cases.cliente_id', 'clients.id'] });
            }
            if (tables.has('clasificaciones')) {
                joins.push({ table: 'clasificaciones', on: ['cases.clasificacion_id', 'clasificaciones.id'] });
            }
            if (tables.has('estados')) {
                // TODO(MSKT-1392): deriva el estado en vivo desde transiciones.siguiente_estado_id
                // en vez de leer la columna persistida cases.estado_id — mismo TODO que
                // KnexEventRepository#getStateByTransitionID.
                joins.push({ table: 'transiciones', on: ['cases.transicion_id', 'transiciones.id'] });
                joins.push({ table: 'estados', on: ['transiciones.siguiente_estado_id', 'estados.id'] });
            }
            if (tables.has('aux_cases')) {
                joins.push({ table: 'aux_cases', on: ['aux_cases.caso_id', 'cases.id'] });
            }
            if (tables.has('aux_clients')) {
                joins.push({ table: 'aux_clients', on: ['aux_clients.cliente_id', 'cases.cliente_id'] });
            }
            if (tables.has('aux_users')) {
                joins.push({ table: 'aux_users', on: ['aux_users.usuario_id', 'cases.responsable_id'] });
            }
            return joins;
        },
    });
}
