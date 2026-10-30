import Knex from 'knex';
import { KnexRepository } from '../../src/shared/infrastructure/persistence/KnexRepository.js';

// Test subclass that exposes protected helpers via passthroughs
class TestRepo extends KnexRepository {
    constructor(config, table) {
        super(config, table);
    }
    // Expose protected helpers for testing
    callTable(name) {
        return this.table(name);
    }
    callQualifiedName(name) {
        return this.qualifiedName(name);
    }
    callTrxTable(trx, name) {
        return this.trxTable(trx, name);
    }
}

describe('KnexRepository — schema qualification helpers', () => {
    describe('schema getter', () => {
        it('extracts schema from Postgres config', () => {
            const repo = new TestRepo({ client: 'pg', connection: {}, schema: 'asistencia' }, 'usuarios');
            expect(repo.schema).toBe('asistencia');
        });

        it('falls back to "public" for PG without schema', () => {
            const repo = new TestRepo({ client: 'pg', connection: {} }, 'usuarios');
            expect(repo.schema).toBe('public');
        });

        it('extracts schema from pre-built knex instance', async () => {
            const knexInstance = Knex({
                client: 'pg',
                connection: {},
                schema: 'asistencia',
            });
            const repo = new TestRepo(knexInstance, 'usuarios');
            expect(repo.schema).toBe('asistencia');
            await knexInstance.destroy();
        });
    });

    describe('table()', () => {
        it('PG: emits SQL "schema"."table"', () => {
            const repo = new TestRepo({ client: 'pg', connection: {}, schema: 'asistencia' }, 'usuarios');
            const sql = repo.callTable().select('*').toSQL().sql;
            expect(sql).toBe('select * from "asistencia"."usuarios"');
        });

        it('PG: accepts custom table name', () => {
            const repo = new TestRepo({ client: 'pg', connection: {}, schema: 'asistencia' }, 'usuarios');
            const sql = repo.callTable('grupos').select('*').toSQL().sql;
            expect(sql).toBe('select * from "asistencia"."grupos"');
        });

        it('PG: falls back to "public" schema when omitted (still qualifies)', () => {
            const repo = new TestRepo({ client: 'pg', connection: {} }, 'usuarios');
            const sql = repo.callTable().select('*').toSQL().sql;
            expect(sql).toBe('select * from "public"."usuarios"');
        });
    });

    describe('qualifiedName()', () => {
        it('PG: returns "schema.table"', () => {
            const repo = new TestRepo({ client: 'pg', connection: {}, schema: 'asistencia' }, 'usuarios');
            expect(repo.callQualifiedName()).toBe('asistencia.usuarios');
            expect(repo.callQualifiedName('grupos')).toBe('asistencia.grupos');
        });

        it('PG: falls back to "public" schema when omitted', () => {
            const repo = new TestRepo({ client: 'pg', connection: {} }, 'usuarios');
            expect(repo.callQualifiedName()).toBe('public.usuarios');
        });
    });

    describe('trxTable()', () => {
        it('PG: applies withSchema on transaction builder', async () => {
            const knexInstance = Knex({
                client: 'pg',
                connection: {},
                schema: 'asistencia',
            });
            const repo = new TestRepo(knexInstance, 'usuarios');
            const fakeTrx = knexInstance; // for SQL gen purposes
            const sql = repo.callTrxTable(fakeTrx).select('*').toSQL().sql;
            expect(sql).toBe('select * from "asistencia"."usuarios"');
            await knexInstance.destroy();
        });
    });

    describe('empty table name guards', () => {
        it('table() throws if no name and no default', () => {
            const repo = new TestRepo(
                { client: 'pg', connection: {}, schema: 'asistencia' },
                '' // empty default
            );
            expect(() => repo.callTable()).toThrow(/table name is required/);
        });

        it('qualifiedName() throws if no name and no default', () => {
            const repo = new TestRepo({ client: 'pg', connection: {}, schema: 'asistencia' }, '');
            expect(() => repo.callQualifiedName()).toThrow(/table name is required/);
        });

        it('trxTable() throws if no name and no default', () => {
            const repo = new TestRepo({ client: 'pg', connection: {}, schema: 'asistencia' }, '');
            const fakeTrx = (n) => ({ select: () => ({ toSQL: () => ({ sql: '' }) }) });
            expect(() => repo.callTrxTable(fakeTrx)).toThrow(/table name is required/);
        });
    });
});
