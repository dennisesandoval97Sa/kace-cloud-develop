import { createUsersFieldCatalog } from '../../src/actions/domain/QueryTranslator/FieldCatalog.js';

describe('createUsersFieldCatalog()', () => {
    const catalog = createUsersFieldCatalog();

    it('resolves usuarios.email to a column descriptor', () => {
        expect(catalog.resolve('usuarios.email')).toEqual({
            kind: 'column',
            table: 'usuarios',
            column: 'email',
        });
    });

    it('resolves aux_users.foo.bar to jsonPath over usuarios.data (no join)', () => {
        expect(catalog.resolve('aux_users.foo.bar')).toEqual({
            kind: 'jsonPath',
            table: 'usuarios',
            jsonColumn: 'data',
            path: ['foo', 'bar'],
        });
    });

    it('returns null for usuarios.last_seen_at (excluded by design)', () => {
        expect(catalog.resolve('usuarios.last_seen_at')).toBeNull();
    });

    it('returns null for excluded JSON-shaped columns (filters, grid, ips_allowed, permissions, groups)', () => {
        expect(catalog.resolve('usuarios.filters')).toBeNull();
        expect(catalog.resolve('usuarios.grid')).toBeNull();
        expect(catalog.resolve('usuarios.ips_allowed')).toBeNull();
        expect(catalog.resolve('usuarios.permissions')).toBeNull();
        expect(catalog.resolve('usuarios.groups')).toBeNull();
    });

    it('returns null for sensitive runtime columns (token, refresh_token, session_id, session_key, cognito_hash_data)', () => {
        expect(catalog.resolve('usuarios.token')).toBeNull();
        expect(catalog.resolve('usuarios.refresh_token')).toBeNull();
        expect(catalog.resolve('usuarios.session_id')).toBeNull();
        expect(catalog.resolve('usuarios.session_key')).toBeNull();
        expect(catalog.resolve('usuarios.cognito_hash_data')).toBeNull();
    });

    it('returns null for foreign-domain prefixes (cases.*, grupos.*, clients.*)', () => {
        expect(catalog.resolve('cases.id')).toBeNull();
        expect(catalog.resolve('grupos.nombre')).toBeNull();
        expect(catalog.resolve('clients.email')).toBeNull();
    });

    it('describeJoins returns [] (users base table needs no joins)', () => {
        expect(catalog.describeJoins(new Set(['aux_users']), 'usuarios')).toEqual([]);
    });

    it('columnExpression for jsonPath uses usuarios.data', () => {
        const d = catalog.resolve('aux_users.foo');
        expect(catalog.columnExpression(d)).toBe("usuarios.data #>> '{foo}'");
    });
});
