import { TenantContext } from '../context/TenantContext.js';

const COLUMN_INFO_CACHE = new Map();
const SCHEMA_TABLES_CACHE = new Map();
const TABLE_EXISTS_CACHE = new Map();

export class SchemaMetadataCache {
    static #resolveSchema(connection) {
        const tenant = TenantContext.getTenant();
        if (tenant?.db_schema?.value) {
            return tenant.db_schema.value;
        }
        const config = connection.client?.config;
        return config?.schema || config?.searchPath?.[0] || config?.connection?.schema || 'public';
    }

    static #cacheKeyForTable(connection, tableName) {
        const schema = SchemaMetadataCache.#resolveSchema(connection);
        return `${schema}:${tableName}`;
    }

    static #cacheKeyForSchema(connection) {
        return SchemaMetadataCache.#resolveSchema(connection);
    }

    static async getColumnInfo(connection, tableName) {
        const key = SchemaMetadataCache.#cacheKeyForTable(connection, tableName);
        if (COLUMN_INFO_CACHE.has(key)) {
            return COLUMN_INFO_CACHE.get(key);
        }
        // Schema-qualify the introspection. The tenant schema is configured via the custom
        // top-level `schema` config field (NOT `searchPath`), so the live PG search_path stays
        // at 'public'. An UNqualified columnInfo() therefore introspects `public.<table>` —
        // which does not exist for the tenant — and returns {}, emptying the aliased column list
        // and surfacing as "metadata de esquema vacía para el tenant". Data queries dodge this by
        // string-qualifying ("schema"."table"); columnInfo() has no such qualification, so we must
        // pin it to the resolved schema explicitly.
        const builder = connection(tableName).withSchema(SchemaMetadataCache.#resolveSchema(connection));
        const info = await builder.columnInfo();
        // Never cache an empty result: columnInfo() can still transiently return {} (e.g. racing
        // the container/schema init). Caching that empty would poison this module-level cache for
        // the warm Lambda container's lifetime and silently drop every aliased column from
        // downstream SELECTs. Re-querying on the next call is cheap and self-heals.
        if (info && Object.keys(info).length > 0) {
            COLUMN_INFO_CACHE.set(key, info);
        }
        return info;
    }

    static async getTableColumns(connection, tableName) {
        const info = await SchemaMetadataCache.getColumnInfo(connection, tableName);
        return Object.keys(info);
    }

    static async getSchemaTables(connection) {
        const key = SchemaMetadataCache.#cacheKeyForSchema(connection);
        if (SCHEMA_TABLES_CACHE.has(key)) {
            return SCHEMA_TABLES_CACHE.get(key);
        }
        const schema = SchemaMetadataCache.#resolveSchema(connection);
        const rows = await connection('information_schema.tables').select('table_name').where({ table_schema: schema });
        const tables = rows.map((row) => row.table_name);
        SCHEMA_TABLES_CACHE.set(key, tables);
        return tables;
    }

    static async tableExists(connection, tableName) {
        const key = SchemaMetadataCache.#cacheKeyForTable(connection, tableName);
        if (TABLE_EXISTS_CACHE.has(key)) {
            return TABLE_EXISTS_CACHE.get(key);
        }
        const schema = SchemaMetadataCache.#resolveSchema(connection);
        const exists = await connection.schema.withSchema(schema).hasTable(tableName);
        TABLE_EXISTS_CACHE.set(key, exists);
        return exists;
    }

    static invalidateTable(connection, tableName) {
        const key = SchemaMetadataCache.#cacheKeyForTable(connection, tableName);
        COLUMN_INFO_CACHE.delete(key);
        TABLE_EXISTS_CACHE.delete(key);
        SchemaMetadataCache.invalidateSchema(connection);
    }

    static invalidateSchema(connection) {
        const key = SchemaMetadataCache.#cacheKeyForSchema(connection);
        SCHEMA_TABLES_CACHE.delete(key);
    }

    static clear() {
        COLUMN_INFO_CACHE.clear();
        SCHEMA_TABLES_CACHE.clear();
        TABLE_EXISTS_CACHE.clear();
    }
}
