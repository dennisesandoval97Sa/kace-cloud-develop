import { jest } from '@jest/globals';

const mockQuery = jest.fn();
jest.unstable_mockModule('pg', () => ({
    default: { Client: jest.fn(() => ({ connect: jest.fn(), end: jest.fn(), query: mockQuery })) },
}));

const { extractIds, buildIntrospectionQuery } = await import('../data/data-pool/extract-ids.mjs');

beforeEach(() => {
    mockQuery.mockReset();
});

describe('extractIds', () => {
    it('returns a flat array of ids from the query result', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        });

        const result = await extractIds({
            client: { query: mockQuery },
            table: 'cases',
            schema: 'tenant_a',
            limit: 100,
        });

        expect(result).toEqual(['a', 'b', 'c']);
        expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('FROM "tenant_a"."cases"'), [100]);
    });

    it('throws when limit is non-positive', async () => {
        await expect(
            extractIds({ client: { query: mockQuery }, table: 'cases', schema: 'tenant_a', limit: 0 })
        ).rejects.toThrow(/limit must be > 0/);
    });

    it('throws when schema is missing or has invalid characters', async () => {
        await expect(
            extractIds({ client: { query: mockQuery }, table: 'cases', schema: '', limit: 10 })
        ).rejects.toThrow(/invalid schema/);

        await expect(
            extractIds({ client: { query: mockQuery }, table: 'cases', schema: 'bad; DROP TABLE', limit: 10 })
        ).rejects.toThrow(/invalid schema/);
    });
});

describe('extractIds identifier guard', () => {
    it('accepts table names with hyphens (valid quoted Postgres identifier)', async () => {
        const fakeQuery = jest.fn().mockResolvedValue({ rows: [{ id: 'x' }] });
        await expect(
            extractIds({ client: { query: fakeQuery }, table: 'one-script', schema: 'public', limit: 10 })
        ).resolves.toEqual(['x']);
        expect(fakeQuery).toHaveBeenCalledWith(expect.stringContaining('"public"."one-script"'), [10]);
    });

    it('still rejects names with semicolons or quotes', async () => {
        const fakeQuery = jest.fn();
        await expect(
            extractIds({ client: { query: fakeQuery }, table: 'foo;DROP', schema: 'public', limit: 10 })
        ).rejects.toThrow(/invalid table/);
        await expect(
            extractIds({ client: { query: fakeQuery }, table: 'foo"bar', schema: 'public', limit: 10 })
        ).rejects.toThrow(/invalid table/);
        expect(fakeQuery).not.toHaveBeenCalled();
    });
});

describe('buildIntrospectionQuery', () => {
    it('returns SQL filtering by id uuid + deleted_at timestamp', () => {
        const sql = buildIntrospectionQuery();

        expect(sql).toContain("c_id.column_name = 'id'");
        expect(sql).toContain("c_del.column_name = 'deleted_at'");
        expect(sql).toContain("c_id.data_type = 'uuid'");
        expect(sql).toMatch(/c_del\.data_type LIKE 'timestamp%'/);
    });

    it('accepts varchar(36) and char(36) id columns in addition to native uuid', () => {
        const sql = buildIntrospectionQuery();

        // Accepts native uuid
        expect(sql).toContain("c_id.data_type = 'uuid'");

        // OR accepts varchar(36) / char(36) — udt_name in (varchar, bpchar) AND length 36
        expect(sql).toMatch(/c_id\.udt_name IN \('varchar', ?'bpchar'\)/);
        expect(sql).toMatch(/c_id\.character_maximum_length = 36/);
    });

    it('excludes _log/_history/_event/_audit suffixes by default', () => {
        const sql = buildIntrospectionQuery();
        expect(sql).toMatch(/NOT LIKE.*_log/);
        expect(sql).toMatch(/NOT LIKE.*_history/);
        expect(sql).toMatch(/NOT LIKE.*_event/);
        expect(sql).toMatch(/NOT LIKE.*_audit/);
    });

    it('appends custom exclude suffixes when provided', () => {
        const sql = buildIntrospectionQuery({ excludeSuffixes: ['_temp'] });
        expect(sql).toMatch(/NOT LIKE.*_temp/);
    });

    it('auto-prepends underscore to exclude suffixes without one', () => {
        const sql = buildIntrospectionQuery({ excludeSuffixes: ['temp'] });
        expect(sql).toMatch(/NOT LIKE.*_temp/);
    });
});
