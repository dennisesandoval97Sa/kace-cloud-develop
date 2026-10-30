import { v4 as uuidV4 } from 'uuid';
import Knex from 'knex';
import { Helper } from '../utils/Helper.js';
import { QueryDBError } from '../../errors/QueryDBError.js';
import { HistoryEntity } from '../../domain/aggregates/HistoryEntity.js';
import { TenantContext } from '../context/TenantContext.js';
import { SchemaMetadataCache } from './SchemaMetadataCache.js';
import { DbRequestContext } from '../context/DbRequestContext.js';

export class KnexRepository {
    /** @type {Knex} is initialized in the constructor*/
    #connection;

    /** @type {import('knex').Knex} reader connection; may alias #connection (single pool) */
    #readerConnection;

    /** @type {string|null} extracted from config in constructor */
    #schema;

    /**
     * @type {string}
     * is initialized in the constructor
     */
    #tableName;

    #relationshipTables = [
        'agendas_groups',
        'classification_group_relationships',
        'classification_template_relations',
        'rel_usuarios_grupos',
        'rel_cases_subcases',
        'descripciones_casos',
    ];

    /**
     * @param { import('knex').Knex.Config | function } config  writer config (or prebuilt Knex)
     * @param {string} [table]
     * @param { import('knex').Knex.Config | null } [readerConfig]  optional reader config
     */
    constructor(config, table = '', readerConfig = null) {
        this.#tableName = table;
        this.#schema = this.#extractSchema(config);

        if (typeof config !== 'function') {
            this.#connection = Knex(config);
        } else {
            this.#connection = config;
        }

        this.#readerConnection = this.#resolveReaderConnection(config, readerConfig);
    }

    /**
     * Resolves the reader connection. Reuses the writer pool when readerConfig is absent,
     * when the writer was passed as a prebuilt instance, OR when reader host == writer host.
     * Otherwise opens a second pool.
     * @param { import('knex').Knex.Config | function } writerConfig
     * @param { import('knex').Knex.Config | null } readerConfig
     * @returns { import('knex').Knex }
     */
    #resolveReaderConnection(writerConfig, readerConfig) {
        if (!readerConfig || typeof writerConfig === 'function') {
            return this.#connection;
        }
        const writerHost = writerConfig?.connection?.host ?? null;
        const readerHost = readerConfig?.connection?.host ?? null;
        if (!writerHost || !readerHost || writerHost === readerHost) {
            return this.#connection;
        }
        return Knex(readerConfig);
    }

    /**
     * Extracts schema from config or pre-built Knex instance.
     * Falls back to 'public' whenever the config carries no schema, regardless of client.
     *
     * NOTE: In production, Tenant.buildKnexConfig() always sets schema explicitly.
     * The 'public' fallback is intentional for test fixtures that omit schema.
     *
     * Consequence: a config can never yield an unqualified table name, so every query built
     * through table()/qualifiedName()/trxTable() hits `<schema>.<table>` — an engine without
     * schemas cannot back those methods. Only a Knex *instance* without `.client` (a test mock
     * function) returns null here and skips qualification.
     *
     * @param {import('knex').Knex.Config|import('knex').Knex} config
     * @returns {string|null} Schema name, or null only for a Knex instance without client metadata
     */
    #extractSchema(config) {
        const isInstance = typeof config === 'function';
        // If this is a Knex instance but has no client metadata (e.g. a test mock function),
        // skip schema qualification to avoid calling .withSchema() on objects that don't support it.
        if (isInstance && !config.client) return null;
        const schema = isInstance ? config.client?.config?.schema : config.schema;
        return schema || 'public';
    }

    /**
     *
     * @return {Knex| import('knex').Knex}
     */
    get connection() {
        return this.#connection;
    }

    /**
     * Writer connection (primary). Alias of `connection` for explicit read/write-split code.
     * @return { import('knex').Knex }
     */
    get writer() {
        return this.#connection;
    }

    /**
     * Reader connection. Returns the replica pool unless a write has occurred in
     * the current request/job context (read-after-write), in which case it returns
     * the writer pool to guarantee monotonic reads within the same invocation.
     * Outside any DbRequestContext run, falls back to the writer (fail-open).
     * @return { import('knex').Knex }
     */
    get reader() {
        if (DbRequestContext.hasWritten()) {
            return this.#connection;
        }
        return this.#readerConnection;
    }

    /**
     * Read facade bound to the reader connection, resolved lazily on every access
     * so it honors read-after-write (after a write in the request, reads go to the writer).
     *
     * Use for SELECTs you have audited as safe to serve from the replica:
     *   this.read.table('my_view').select('*')
     *   this.read.raw('... ??', [bindings])
     *
     * Schema qualification is preserved (same as this.table()). Metadata/columnInfo
     * and write paths must NOT use this facade.
     *
     * @returns {{ table: (name: string) => import('knex').Knex.QueryBuilder, raw: (sql: string, bindings?: any) => import('knex').Knex.Raw }}
     */
    get read() {
        const resolved = this.reader;
        return {
            table: (name) => resolved(this.qualifiedName(name)),
            raw: (sql, bindings) => resolved.raw(sql, bindings),
        };
    }

    /**
     * @return {string}
     */
    get tableName() {
        return this.#tableName;
    }

    /**
     * @return {string|null} The schema name extracted from config ('public' when the config
     * omitted it), or null when built from a Knex instance without client metadata.
     */
    get schema() {
        return this.#schema;
    }

    /**
     * Returns a Knex query builder for the qualified table ("schema.table").
     * Uses a string-qualified table name (NOT withSchema()) so that joins
     * with already-qualified names don't get a duplicate schema prefix.
     *
     * Bad (old impl): `db(name).withSchema(schema).leftJoin('schema.X', ...)` →
     *   produces `"schema"."schema"."X"` (cross-database, fails).
     * Good (this impl): `db('schema.table').leftJoin('schema.X', ...)` →
     *   produces `"schema"."X"` correctly.
     *
     * @param {string} [name=this.tableName] - Table name (defaults to this repo's table)
     * @return {import('knex').Knex.QueryBuilder}
     */
    table(name = this.#tableName) {
        if (!name) {
            throw new Error('KnexRepository.table(): table name is required (got empty)');
        }
        return this.#connection(this.qualifiedName(name));
    }

    /**
     * Returns a qualified table name string ("schema.table"). Use for joins, .from(),
     * .raw() bindings, history table references, etc.
     *
     * The unqualified branch is only reached when the repository was built from a Knex instance
     * without client metadata; see #extractSchema. Any config-based repository always qualifies.
     *
     * @param {string} [name=this.tableName]
     * @return {string}
     */
    qualifiedName(name = this.#tableName) {
        if (!name) {
            throw new Error('KnexRepository.qualifiedName(): table name is required (got empty)');
        }
        return this.#schema ? `${this.#schema}.${name}` : name;
    }

    /**
     * Transactional version of table(). Use inside .transaction(async (trx) => {}).
     * @param {import('knex').Knex.Transaction} trx
     * @param {string} [name=this.tableName]
     * @return {import('knex').Knex.QueryBuilder}
     */
    trxTable(trx, name = this.#tableName) {
        if (!name) {
            throw new Error('KnexRepository.trxTable(): table name is required (got empty)');
        }
        return trx(this.qualifiedName(name));
    }

    /**
     * Columnas que `update()` escribe. Por defecto, el diff del agregado tal cual.
     *
     * Es el punto de extensión para un repositorio que además tenga que arrastrar una columna
     * derivada (ej. `KnexCaseRepository` con `estado_id`): se sobrescribe esto y no `update()`,
     * de modo que `markWrite()`, el manejo de errores y el filtro de borrado lógico siguen
     * viviendo en un solo sitio.
     *
     * @param {Object} aggregate aggregate class
     * @param {import('knex').Knex.Transaction} [trx]
     * @returns {Object} valores para el UPDATE
     */
    // eslint-disable-next-line no-unused-vars
    updateValues(aggregate, trx) {
        return aggregate.changedAttributes;
    }

    /**
     * Punto de extensión para traducir un error del driver en `update()` a un error de dominio
     * antes de que se convierta en `QueryDBError` (ej. `KnexCaseRepository` con la colisión de
     * folio). Por defecto no hace nada; si quiere traducirlo, lanza.
     *
     * @param {Error} error error original del driver
     * @param {Object} aggregate aggregate class
     * @returns {void}
     */
    // eslint-disable-next-line no-unused-vars
    translateWriteError(error, aggregate) {}

    /**
     *
     * @param {Object} aggregate aggregate class
     * @returns {Promise<void>}
     */
    async update(aggregate, trx) {
        DbRequestContext.markWrite();
        try {
            if (Object.keys(aggregate.changedAttributes).length === 0) {
                return;
            }
            await (trx ? this.trxTable(trx) : this.table())
                .update(this.updateValues(aggregate, trx))
                .where({ id: aggregate.id.value })
                .whereNull('deleted_at');
        } catch (error) {
            this.translateWriteError(error, aggregate);
            Helper.logError(error.message, error);
            throw new QueryDBError('update');
        }
    }

    /**
     *
     * @param {AggregateRoot} aggregate current attributes of aggregate
     * @param originalAttributes
     * @description This method is used to save history of any aggregate
     * @example
     * await this.saveHistory(aggregate, originalAttributes);
     * @returns {Promise<void>}
     */
    async saveHistory(aggregate, originalAttributes = null, trx = null) {
        DbRequestContext.markWrite();
        const data = {
            id: uuidV4(),
            entity_id: aggregate.id.value,
            changed_attributes: JSON.stringify(aggregate.changedAttributes),
            new_attributes: JSON.stringify(aggregate.toJson()),
            original_attributes: JSON.stringify(originalAttributes ?? aggregate.toJson()),
            created_at: new Date().toISOString(),
            created_by: aggregate.updated_by?.value ?? aggregate.created_by.value,
        };

        const historyTable = `history_${this.#tableName}`;
        if (trx) {
            await this.trxTable(trx, historyTable).insert(data);
        } else {
            await this.table(historyTable).insert(data);
        }
    }

    /**
     * This method is used to save history of any aggregate with relationships
     * @param {AggregateRoot} aggregate
     * @param { object }originalAttributes
     * @param { ValueObjectUuid }relationId
     * @param {import('knex').Knex.Transaction} [trx] - optional transaction; when provided the
     *   history INSERT runs on the transactional connection (mirrors saveHistory()).
     * @return {Promise<void>}
     */
    async saveHistoryWithRelationships(aggregate, originalAttributes = null, relationId, trx = null) {
        DbRequestContext.markWrite();
        const data = {
            id: uuidV4(),
            entity_id: relationId.value,
            changed_attributes: JSON.stringify(aggregate.changedAttributes),
            new_attributes: JSON.stringify(aggregate.toJson()),
            original_attributes: JSON.stringify(originalAttributes ?? aggregate.toJson()),
            created_at: new Date().toISOString(),
            created_by: aggregate.updated_by?.value ?? aggregate.created_by.value,
        };

        const historyTable = `history_${this.#tableName}`;
        await (trx ? this.trxTable(trx, historyTable) : this.table(historyTable)).insert(data);
    }

    /**
     *
     * @param {Object} aggregate aggregate class
     */
    async delete(aggregate, trx) {
        await this.update(aggregate, trx);
    }

    /**
     *
     * @param {Criteria} criteria
     * @param {((query: object) => void)|null} [applyExtra] Condiciones adicionales que el
     *   repositorio concreto necesite añadir sin duplicar la guarda de borrado lógico.
     * @returns {Promise<object>}
     */
    async count(criteria, applyExtra = null) {
        try {
            const query = criteria.convertToKnex(this.table().count());

            if (this.#relationshipTables.includes(this.#tableName) === false) {
                query.whereNull(`${this.tableName}.deleted_at`);
            }

            applyExtra?.(query);

            const [count] = await query;
            return count;
        } catch (error) {
            Helper.logError(error);
            throw new QueryDBError(`count`);
        }
    }

    async historyCounter(criteria, tableName, entityId) {
        try {
            const query = criteria.convertToKnex(this.table(tableName).count());
            query.where({ entity_id: entityId });
            query.clearOrder();
            const [count] = await query;
            return count;
        } catch (error) {
            Helper.logError(error);
            throw new QueryDBError(`count`);
        }
    }

    /**
     * @param {string} tableName
     * @returns {Promise<boolean>}
     */
    async entityExists(tableName) {
        try {
            return await SchemaMetadataCache.tableExists(this.connection, tableName);
        } catch (error) {
            Helper.logError(`Error al verificar tabla ${tableName}:`, error);
            throw new QueryDBError('custom', `Error verifying the existence of the table.`);
        }
    }

    /**
     *
     * @returns {Promise<awaited Knex.QueryBuilder<TRecord, TResult>>}
     */
    async getRandomTableName() {
        try {
            return await this.connection('information_schema.tables')
                .select('table_name')
                .where({ table_schema: TenantContext.getTenant().db_schema.value })
                .orderByRaw('RANDOM()')
                .limit(1);
        } catch (error) {
            Helper.logError(error);
            throw new QueryDBError(`custom`, 'Error getting random tables.');
        }
    }

    async isEmptyTable(tableName) {
        try {
            const query = await this.table(tableName).select('*');
            Helper.logInfo(`query`, query);
            const result = await query;
            return result.length === 0;
        } catch (error) {
            Helper.logInfo(`Error ejecutando metodo isEmptyTable en tabla ${tableName}:`, error);
            throw new QueryDBError('custom', `Error ejecutando metodo isEmptyTable en tabla ${tableName}`);
        }
    }

    async getViews() {
        try {
            const views = await this.connection('information_schema.views')
                .select('table_name as name')
                .where({ table_schema: TenantContext.getTenant().db_schema.value });

            return views.map((view) => view.name);
        } catch (error) {
            Helper.logError(error);
            throw new QueryDBError(`custom`, 'Error getting views.');
        }
    }

    async getTableColumns(tableName) {
        try {
            return await SchemaMetadataCache.getTableColumns(this.connection, tableName);
        } catch (error) {
            Helper.logInfo(`Error ejecutando metodo getTableColumns en tabla ${tableName}:`, error);
            throw new QueryDBError('custom', `Error ejecutando metodo getTableColumns en tabla ${tableName}`);
        }
    }

    async getSchemaTables() {
        try {
            return await SchemaMetadataCache.getSchemaTables(this.connection);
        } catch (error) {
            Helper.logError('Error al obtener las tablas:', error);
            throw new QueryDBError('custom', `Error ejecutando metodo getSchemaTables`);
        }
    }

    /**
     * Verifies if a connection is allowed based on the `allowed_connections` table.
     * @param {string} connection The connection identifier or name
     * @returns {Promise<boolean>} Returns true if the connection is allowed, otherwise false
     */
    async isAllowedConnection(connection) {
        try {
            const url = connection.replace(/^https?:\/\//, '');
            const domain = url.split('/')[0];

            const result = await this.table('allowed_connections')
                .select('*')
                .where({ connection: domain, deleted_at: null })
                .first();

            if (!result) {
                Helper.logInfo(`The domain ${domain} is not authorized.`);
                return false;
            }

            return true;
        } catch (error) {
            Helper.logError('Error verifying allowed connection:', error);
            throw new QueryDBError('custom', 'Error verifying allowed connection');
        }
    }

    /**
     * Verifies the existence of a WS REST flow by its ID.
     * @param {ValueObjectUuid} id - The UUID value object representing the flow ID.
     * @returns {Promise<boolean>} - Returns true if the flow exists, otherwise false.
     * @throws {QueryDBError} - If there is an error querying the database.
     */
    async restFlowExistenceValidator(id) {
        try {
            const result = await this.table('ws_rest_flows').where({ id: id.value }).first();

            return result ? true : false;
        } catch (error) {
            Helper.logError('Error finding WS REST flow:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     ** @param {ValueObjectUuid} id - The UUID value object representing the entity_id ID.
     * Busca instancias de Schema según los criterios dados.
     * @param {Object} criteria
     */
    async searchHistory(id, criteria) {
        try {
            const tableName = `history_${this.#tableName}`;
            const selectUserName = `trim(concat(usuarios.nombres, ' ', usuarios.apellido1, ' ', usuarios.apellido2)) as creator_name`;
            const query = criteria.convertToKnex(this.table(tableName).select(`${tableName}.*`));
            query.select(this.connection.raw(selectUserName));
            query
                .where({ entity_id: id.value })
                .leftJoin(this.qualifiedName('usuarios'), `${tableName}.created_by`, 'usuarios.id');
            const rows = await query;
            return rows.map((row) => HistoryEntity.create(row));
        } catch (error) {
            Helper.logError('Error searching schemas', error);
            throw new QueryDBError('search', 'searchHistory');
        }
    }

    async destroyConnection() {
        await this.#connection.destroy();
        if (this.#readerConnection && this.#readerConnection !== this.#connection) {
            await this.#readerConnection.destroy();
        }
    }

    async startTransaction() {
        DbRequestContext.markWrite();
        return this.#connection.transaction();
    }

    /**
     * Runs `callback(trx)` in a writer transaction: commits when it resolves, rolls back when it
     * throws, and returns its result.
     * @template T
     * @param {(trx: import('knex').Knex.Transaction) => Promise<T>} callback
     * @returns {Promise<T>}
     */
    async withTransaction(callback) {
        DbRequestContext.markWrite();
        return this.#connection.transaction(callback);
    }

    async generateAliasedColumns(tables, customPrefix = '') {
        const aliasedColumns = [];
        for (const table of tables) {
            const columns = await this.getTableColumns(table);
            for (const column of columns) {
                if (customPrefix) {
                    aliasedColumns.push(`${customPrefix}.${column} AS ${customPrefix}_${column}`);
                } else {
                    aliasedColumns.push(`${table}.${column} AS ${table}_${column}`);
                }
            }
        }
        return aliasedColumns;
    }

    /**
     * Checks if any non-deleted record has the given value for a JSON data field.
     * Application-level uniqueness check (no DB-level constraint).
     * Supports nested paths via array: ['direccion', 'calle'] → data #>> '{direccion,calle}'.
     *
     * @param {string} tableName - The table to query.
     * @param {string|string[]} fieldPath - A single key or array of keys for nested access.
     * @param {*} value - The value to check (cast to string for JSON text extraction).
     * @param {Object|null} excludeCondition - Optional Knex whereNot condition (e.g. { id: '...' }).
     * @returns {Promise<boolean>} True if a conflicting record exists.
     */
    async existsByFieldValue(tableName, fieldPath, value, excludeCondition = null) {
        const pathArray = Array.isArray(fieldPath) ? fieldPath : [fieldPath];
        const pathLabel = pathArray.join('.');
        try {
            let query = this.table(tableName).select('id').whereNull('deleted_at');

            if (pathArray.length === 1) {
                query = query.whereRaw(`data ->> ? = ?`, [pathArray[0], String(value)]);
            } else {
                query = query.whereRaw(`data #>> ? = ?`, [`{${pathArray.join(',')}}`, String(value)]);
            }

            if (excludeCondition) {
                query = query.whereNot(excludeCondition);
            }

            const result = await query.first();
            return !!result;
        } catch (error) {
            Helper.logError('Error checking field uniqueness', error);
            throw new QueryDBError('custom', `existsByFieldValue failed for field '${pathLabel}'`);
        }
    }

    async advancedSearch(criteria, tableName) {
        try {
            const query = criteria.convertToKnex(this.table(tableName).select(`${tableName}.*`));
            query.whereNull(`${tableName}.deleted_at`);
            const rows = await query;
            return rows;
        } catch (error) {
            Helper.logError('Error searching advancedSearch', error);
            throw new QueryDBError('search');
        }
    }

    async advancedCount(criteria, tableName) {
        try {
            const innerQuery = criteria.convertToKnex(this.table(tableName).select(`${tableName}.*`));

            if (this.#relationshipTables.includes(tableName) === false) {
                innerQuery.whereNull(`${tableName}.deleted_at`);
            }

            const [count] = await this.connection.count({ count: '*' }).from(innerQuery.as('advanced_count_sub'));

            return count;
        } catch (error) {
            Helper.logError(error);
            throw new QueryDBError(`count`);
        }
    }

    async isValidRelationship(tableName, id) {
        try {
            const query = this.table(tableName).where({ id });
            const rows = await query;
            return rows.length > 0;
        } catch (error) {
            Helper.logError(error);
            throw new QueryDBError(`find`);
        }
    }
}
