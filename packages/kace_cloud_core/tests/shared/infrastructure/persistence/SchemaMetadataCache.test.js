import { jest } from '@jest/globals';
import { SchemaMetadataCache } from '../../../../src/shared/infrastructure/persistence/SchemaMetadataCache.js';
import { TenantContext } from '../../../../src/shared/infrastructure/context/TenantContext.js';

// Postgres-shaped connection mock: columnInfo behind withSchema(), hasTable behind
// schema.withSchema(), and getSchemaTables behind information_schema.tables select/where.
const buildConnection = ({ columnInfo = jest.fn(), hasTable = jest.fn(), tables = [] } = {}) => {
    const where = jest.fn().mockResolvedValue(tables);
    const tableFn = jest.fn((name) => {
        if (name === 'information_schema.tables') {
            return { select: jest.fn(() => ({ where })) };
        }
        return { withSchema: jest.fn(() => ({ columnInfo })) };
    });
    tableFn.client = { config: { client: 'pg', schema: 'public' } };
    // Tracks the schema passed to schema.withSchema(), so tableExists() tests can assert the
    // hasTable() check was actually qualified against the resolved tenant schema — not just
    // that hasTable() itself was invoked (see SchemaMetadataCache.columnInfo() qualification
    // regression that motivated the same check on the columnInfo() path).
    const schemaWithSchemaCalls = [];
    tableFn.schema = {
        withSchema: jest.fn((schema) => {
            schemaWithSchemaCalls.push(schema);
            return { hasTable };
        }),
    };
    tableFn.__where = where;
    tableFn.__schemaWithSchemaCalls = schemaWithSchemaCalls;
    return tableFn;
};

describe('SchemaMetadataCache', () => {
    beforeEach(() => {
        SchemaMetadataCache.clear();
    });

    describe('getColumnInfo', () => {
        it('queries the connection on first call and caches the result', async () => {
            const expected = { id: { type: 'string' }, deleted_at: { type: 'datetime' } };
            const columnInfo = jest.fn().mockResolvedValue(expected);
            const connection = buildConnection({ columnInfo });

            const first = await SchemaMetadataCache.getColumnInfo(connection, 'cases');
            const second = await SchemaMetadataCache.getColumnInfo(connection, 'cases');

            expect(first).toBe(expected);
            expect(second).toBe(expected);
            expect(columnInfo).toHaveBeenCalledTimes(1);
            expect(connection).toHaveBeenCalledWith('cases');
        });
    });

    describe('getTableColumns', () => {
        it('returns Object.keys of the cached columnInfo and reuses cache', async () => {
            const columnInfo = jest.fn().mockResolvedValue({
                id: { type: 'string' },
                created_at: { type: 'datetime' },
                deleted_at: { type: 'datetime' },
            });
            const connection = buildConnection({ columnInfo });

            const keys = await SchemaMetadataCache.getTableColumns(connection, 'usuarios');
            await SchemaMetadataCache.getTableColumns(connection, 'usuarios');

            expect(keys).toEqual(['id', 'created_at', 'deleted_at']);
            expect(columnInfo).toHaveBeenCalledTimes(1);
        });
    });

    describe('tableExists', () => {
        it('queries hasTable on miss and caches result', async () => {
            const hasTable = jest.fn().mockResolvedValue(true);
            const connection = buildConnection({ hasTable });

            const first = await SchemaMetadataCache.tableExists(connection, 'cases');
            const second = await SchemaMetadataCache.tableExists(connection, 'cases');

            expect(first).toBe(true);
            expect(second).toBe(true);
            expect(hasTable).toHaveBeenCalledTimes(1);
            expect(hasTable).toHaveBeenCalledWith('cases');
            // Regression guard: hasTable() must be qualified against the resolved schema
            // (connection.schema.withSchema(schema).hasTable(...)), not called unqualified —
            // this repository already shipped an unqualified-introspection bug once (see
            // columnInfo()'s "Postgres schema qualification" tests below).
            expect(connection.__schemaWithSchemaCalls).toEqual(['public']);
        });
    });

    describe('getSchemaTables', () => {
        it('reads information_schema.tables once and caches the list', async () => {
            const connection = buildConnection({ tables: [{ table_name: 'cases' }, { table_name: 'usuarios' }] });

            const first = await SchemaMetadataCache.getSchemaTables(connection);
            const second = await SchemaMetadataCache.getSchemaTables(connection);

            expect(first).toEqual(['cases', 'usuarios']);
            expect(second).toEqual(['cases', 'usuarios']);
            expect(connection).toHaveBeenCalledWith('information_schema.tables');
            expect(connection.__where).toHaveBeenCalledTimes(1);
            expect(connection.__where).toHaveBeenCalledWith({ table_schema: 'public' });
        });
    });

    describe('clear', () => {
        it('drops all entries so the next call hits the connection again', async () => {
            const columnInfo = jest.fn().mockResolvedValue({ id: { type: 'string' } });
            const connection = buildConnection({ columnInfo });

            await SchemaMetadataCache.getColumnInfo(connection, 'cases');
            SchemaMetadataCache.clear();
            await SchemaMetadataCache.getColumnInfo(connection, 'cases');

            expect(columnInfo).toHaveBeenCalledTimes(2);
        });
    });

    describe('Postgres path without TenantContext', () => {
        const buildPostgresConnection = (overrides = {}) => {
            const columnInfo = jest.fn().mockResolvedValue({ id: { type: 'string' } });
            const tableFn = jest.fn(() => ({ columnInfo, withSchema: jest.fn(() => ({ columnInfo })) }));
            tableFn.client = {
                config: {
                    client: 'pg',
                    schema: overrides.schema ?? 'kace_test_w1',
                    ...(overrides.searchPath ? { searchPath: overrides.searchPath } : {}),
                    ...(overrides.connectionSchema ? { connection: { schema: overrides.connectionSchema } } : {}),
                },
            };
            tableFn.schema = { hasTable: jest.fn().mockResolvedValue(true) };
            tableFn.raw = jest.fn();
            return { tableFn, columnInfo };
        };

        it('uses config.schema as fallback when TenantContext is empty', async () => {
            const { tableFn, columnInfo } = buildPostgresConnection({ schema: 'kace_test_w3' });

            const first = await SchemaMetadataCache.getColumnInfo(tableFn, 'cases');
            const second = await SchemaMetadataCache.getColumnInfo(tableFn, 'cases');

            expect(first).toEqual({ id: { type: 'string' } });
            expect(second).toBe(first);
            expect(columnInfo).toHaveBeenCalledTimes(1);
        });

        it('uses searchPath[0] when config.schema is missing', async () => {
            const { tableFn, columnInfo } = buildPostgresConnection({
                schema: undefined,
                searchPath: ['from_search_path'],
            });

            await SchemaMetadataCache.getColumnInfo(tableFn, 'cases');
            await SchemaMetadataCache.getColumnInfo(tableFn, 'cases');

            expect(columnInfo).toHaveBeenCalledTimes(1);
        });

        it('falls back to "public" when nothing else is available', async () => {
            const { tableFn, columnInfo } = buildPostgresConnection({ schema: undefined });

            await SchemaMetadataCache.getColumnInfo(tableFn, 'cases');
            await SchemaMetadataCache.getColumnInfo(tableFn, 'cases');

            expect(columnInfo).toHaveBeenCalledTimes(1);
        });
    });

    describe('Postgres schema qualification (tenant schema ≠ search_path)', () => {
        // Reproduces the production failure: tenant schema is configured via the custom
        // `schema` config field (NOT searchPath), so the live PG search_path stays at
        // 'public'. An UNqualified columnInfo() therefore introspects `public.cases` —
        // which does not exist for the tenant — and returns {}. That empties the aliased
        // column list and surfaces as "metadata de esquema vacía para el tenant".
        const buildSchemaAwarePgConnection = (columnsBySchema) => {
            const withSchemaCalls = [];
            const makeBuilder = (resolvedSchema) => ({
                withSchema: jest.fn((s) => {
                    withSchemaCalls.push(s);
                    return makeBuilder(s);
                }),
                columnInfo: jest.fn(async () => columnsBySchema[resolvedSchema] ?? {}),
            });
            // Bare connection(table) resolves against the live search_path ('public').
            const tableFn = jest.fn(() => makeBuilder('public'));
            tableFn.client = { config: { client: 'pg', schema: 'public' } };
            return { tableFn, withSchemaCalls };
        };

        it('introspects columnInfo against the tenant schema, not the connection default', async () => {
            const fullColumns = { id: { type: 'uuid' }, estado_id: { type: 'uuid' } };
            const { tableFn, withSchemaCalls } = buildSchemaAwarePgConnection({
                public: {},
                tenant_acme: fullColumns,
            });
            const tenant = { id: { value: 't-1' }, db_schema: { value: 'tenant_acme' } };

            const info = await TenantContext.run(tenant, () => SchemaMetadataCache.getColumnInfo(tableFn, 'cases'));

            expect(info).toEqual(fullColumns);
            expect(withSchemaCalls).toContain('tenant_acme');
        });

        it('does not cache the empty result so a later call self-heals', async () => {
            const { tableFn } = buildSchemaAwarePgConnection({ public: {}, tenant_acme: {} });
            const tenant = { id: { value: 't-1' }, db_schema: { value: 'tenant_acme' } };

            await TenantContext.run(tenant, () => SchemaMetadataCache.getColumnInfo(tableFn, 'cases'));
            await TenantContext.run(tenant, () => SchemaMetadataCache.getColumnInfo(tableFn, 'cases'));

            // Empty info is never cached: the connection is hit on every call.
            expect(tableFn).toHaveBeenCalledTimes(2);
        });
    });

    describe('invalidate', () => {
        it('invalidateTable evicts columnInfo and tableExists for that table and the schema list', async () => {
            const columnInfo = jest.fn().mockResolvedValue({ id: { type: 'string' } });
            const hasTable = jest.fn().mockResolvedValue(true);
            const connection = buildConnection({ columnInfo, hasTable, tables: [{ table_name: 'cases' }] });

            await SchemaMetadataCache.getColumnInfo(connection, 'cases');
            await SchemaMetadataCache.tableExists(connection, 'cases');
            await SchemaMetadataCache.getSchemaTables(connection);

            SchemaMetadataCache.invalidateTable(connection, 'cases');

            await SchemaMetadataCache.getColumnInfo(connection, 'cases');
            await SchemaMetadataCache.tableExists(connection, 'cases');
            await SchemaMetadataCache.getSchemaTables(connection);

            expect(columnInfo).toHaveBeenCalledTimes(2);
            expect(hasTable).toHaveBeenCalledTimes(2);
            expect(connection.__where).toHaveBeenCalledTimes(2);
        });

        it('invalidateSchema only evicts the schema tables list', async () => {
            const columnInfo = jest.fn().mockResolvedValue({ id: { type: 'string' } });
            const connection = buildConnection({ columnInfo, tables: [{ table_name: 'cases' }] });

            await SchemaMetadataCache.getColumnInfo(connection, 'cases');
            await SchemaMetadataCache.getSchemaTables(connection);

            SchemaMetadataCache.invalidateSchema(connection);

            await SchemaMetadataCache.getColumnInfo(connection, 'cases');
            await SchemaMetadataCache.getSchemaTables(connection);

            expect(columnInfo).toHaveBeenCalledTimes(1);
            expect(connection.__where).toHaveBeenCalledTimes(2);
        });
    });
});
