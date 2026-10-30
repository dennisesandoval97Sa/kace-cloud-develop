import { knexConfig } from '../knexfile.js';
import { CaseContextBatchLoader } from '../../src/actions-queue-executions/domain/services/CaseContextBatchLoader.js';

const fakeCase = (overrides = {}) => ({
    id: { value: overrides.id ?? 'c1' },
    cliente_id: { value: overrides.cliente_id ?? 'cli1' },
    clasificacion_id: { value: overrides.clasificacion_id ?? 'cla1' },
    transicion_id: { value: overrides.transicion_id ?? 'tr1' },
    toJson: () => ({ id: overrides.id ?? 'c1', cliente_id: overrides.cliente_id ?? 'cli1' }),
});

// Mirrors the caseRepository contract the loader depends on (read facade + schema-qualified
// name helper). In tests there is no schema, so qualifiedName is the identity.
// (No read.raw needed: the loader takes raw() from the query builder's client.)
const makeRepo = (knex) => ({
    read: { table: (name) => knex(name) },
    qualifiedName: (name) => name,
});

// aux_cases/clients/aux_clients/clasificaciones/estados/transiciones all exist in the real
// migrated schema (see tests/knexfile.js — every test file gets its own cloned postgres
// database). aux_cases.data is a real jsonb column, so this describe block now exercises the
// loader's postgres branch (`isSqlite === false` in CaseContextBatchLoader#loadAuxCases) for
// real, superseding what used to be sqlite-only coverage.
describe('CaseContextBatchLoader aux_cases projection', () => {
    const knex = knexConfig;
    beforeEach(async () => {
        for (const t of ['aux_cases', 'clients', 'aux_clients', 'clasificaciones', 'estados', 'transiciones']) {
            await knex(t).delete();
        }
    });

    const insertAuxRow = async (data = { form1: { ciudad: 'Bogota' }, pesado: { blob: 'x'.repeat(1000) } }) => {
        await knex('aux_cases').insert({ id: 'aux-c1', caso_id: 'c1', data: JSON.stringify(data) });
    };

    it('reconstructs only the requested sub-keys of aux_cases.data when auxCaseKeys is provided', async () => {
        await insertAuxRow();
        const loader = new CaseContextBatchLoader(makeRepo(knex));
        const ctxMap = await loader.load([fakeCase()], { auxCaseKeys: new Set(['form1']) });

        const aux = ctxMap.get('c1').aux_cases;
        expect(aux.form1).toEqual({ ciudad: 'Bogota' });
        expect(aux.pesado).toBeUndefined();
    });

    it('falls back to full data when auxCaseKeys is null', async () => {
        await insertAuxRow();
        const loader = new CaseContextBatchLoader(makeRepo(knex));
        const ctxMap = await loader.load([fakeCase()], { auxCaseKeys: null });

        const aux = ctxMap.get('c1').aux_cases;
        expect(aux.form1).toEqual({ ciudad: 'Bogota' });
        expect(aux.pesado).toEqual({ blob: 'x'.repeat(1000) });
    });

    it('defaults to full data when no opts are passed (back-compat)', async () => {
        await insertAuxRow();
        const loader = new CaseContextBatchLoader(makeRepo(knex));
        const ctxMap = await loader.load([fakeCase()]);

        const aux = ctxMap.get('c1').aux_cases;
        expect(aux.form1).toEqual({ ciudad: 'Bogota' });
        expect(aux.pesado).toEqual({ blob: 'x'.repeat(1000) });
    });

    it('preserves bare scalar string sub-keys in projection mode (parity with full-data mode)', async () => {
        await insertAuxRow({ escalar: 'abc', form1: { ciudad: 'Bogota' } });
        const loader = new CaseContextBatchLoader(makeRepo(knex));
        const ctxMap = await loader.load([fakeCase()], { auxCaseKeys: new Set(['escalar', 'form1']) });

        const aux = ctxMap.get('c1').aux_cases;
        expect(aux.escalar).toBe('abc');
        expect(aux.form1).toEqual({ ciudad: 'Bogota' });
    });

    it('falls back to full data when a projected key collides with the caso_id key column', async () => {
        await insertAuxRow({ caso_id: { x: 1 }, form1: { ciudad: 'Bogota' } });
        const loader = new CaseContextBatchLoader(makeRepo(knex));
        const ctxMap = await loader.load([fakeCase()], { auxCaseKeys: new Set(['caso_id', 'form1']) });

        const aux = ctxMap.get('c1').aux_cases;
        expect(aux.caso_id).toEqual({ x: 1 });
        expect(aux.form1).toEqual({ ciudad: 'Bogota' });
    });

    it('falls back to full data when the existence alias of k collides with the value column of k__exists', async () => {
        await insertAuxRow({ form1: { a: 1 }, form1__exists: false });
        const loader = new CaseContextBatchLoader(makeRepo(knex));
        const ctxMap = await loader.load([fakeCase()], { auxCaseKeys: new Set(['form1', 'form1__exists']) });

        const aux = ctxMap.get('c1').aux_cases;
        expect(aux.form1).toEqual({ a: 1 });
        expect(aux['form1__exists']).toBe(false);
    });

    it('preserves JSON-null sub-keys as null (key present) in projection mode, matching full-data mode', async () => {
        await insertAuxRow({ form1: null, form2: { a: 1 } });
        const loader = new CaseContextBatchLoader(makeRepo(knex));
        const ctxMap = await loader.load([fakeCase()], { auxCaseKeys: new Set(['form1', 'form2']) });

        const aux = ctxMap.get('c1').aux_cases;
        expect(Object.prototype.hasOwnProperty.call(aux, 'form1')).toBe(true);
        expect(aux.form1).toBeNull();
        expect(aux.form2).toEqual({ a: 1 });
    });

    it('keeps absent sub-keys absent in projection mode', async () => {
        await insertAuxRow({ form1: {} });
        const loader = new CaseContextBatchLoader(makeRepo(knex));
        const ctxMap = await loader.load([fakeCase()], { auxCaseKeys: new Set(['missing']) });

        const aux = ctxMap.get('c1').aux_cases;
        expect('missing' in aux).toBe(false);
    });

    it('returns aux_cases as undefined for cases with no aux row (projection mode)', async () => {
        const loader = new CaseContextBatchLoader(makeRepo(knex));
        const ctxMap = await loader.load([fakeCase({ id: 'c-sin-aux' })], { auxCaseKeys: new Set(['form1']) });

        expect(ctxMap.get('c-sin-aux').aux_cases).toBeUndefined();
    });
});

describe('CaseContextBatchLoader aux_cases projection (postgres branch)', () => {
    // pg's driver materializes `data->'key'` jsonb itself: objects arrive as objects and JSON
    // string scalars as JS strings. The loader must use those values AS-IS — re-parsing would
    // coerce '123' into the number 123, diverging from full-data mode. This describe block
    // exercises that row-shape handling in isolation (no query building/dialect quirks) via a
    // stubbed repo whose builders return driver-shaped rows and report client 'pg' directly
    // (same shape as the concurrency test's repo) — complementary to the describe block above,
    // which now exercises the same pg branch end-to-end against a real postgres connection.
    const makePgRepo = (rowsByTable) => {
        const builder = (name) => {
            const b = {
                client: { config: { client: 'pg' }, raw: () => ({}) },
                leftJoin: () => b,
                whereIn: () => b,
                select: async () => rowsByTable[name] ?? [],
            };
            return b;
        };
        return { read: { table: (name) => builder(name) }, qualifiedName: (name) => name };
    };

    it('uses driver-materialized values as-is, preserving string scalar types', async () => {
        const repo = makePgRepo({
            aux_cases: [
                {
                    caso_id: 'c1',
                    form1: { ciudad: 'Bogota' },
                    form1__exists: true,
                    escalar: '123',
                    escalar__exists: true,
                },
            ],
        });
        const loader = new CaseContextBatchLoader(repo);
        const ctxMap = await loader.load([fakeCase()], { auxCaseKeys: new Set(['form1', 'escalar']) });

        const aux = ctxMap.get('c1').aux_cases;
        expect(aux.form1).toEqual({ ciudad: 'Bogota' });
        expect(aux.escalar).toBe('123');
    });

    it('distinguishes JSON-null (key present) from absent keys via the exists columns', async () => {
        // data->'k' yields JS null both for a JSON null value and for an absent key; only the
        // per-key exists column tells them apart.
        const repo = makePgRepo({
            aux_cases: [
                {
                    caso_id: 'c1',
                    formnull: null,
                    formnull__exists: true,
                    formabs: null,
                    formabs__exists: false,
                },
            ],
        });
        const loader = new CaseContextBatchLoader(repo);
        const ctxMap = await loader.load([fakeCase()], { auxCaseKeys: new Set(['formnull', 'formabs']) });

        const aux = ctxMap.get('c1').aux_cases;
        expect(Object.prototype.hasOwnProperty.call(aux, 'formnull')).toBe(true);
        expect(aux.formnull).toBeNull();
        expect('formabs' in aux).toBe(false);
    });
});
