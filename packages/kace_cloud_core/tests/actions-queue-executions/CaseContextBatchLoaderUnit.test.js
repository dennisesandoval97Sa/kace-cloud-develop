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
const makeRepo = (knex) => ({
    read: { table: (name) => knex(name) },
    qualifiedName: (name) => name,
});

// aux_cases/clients/aux_clients/clasificaciones/estados/transiciones all exist in the real
// migrated schema (see tests/knexfile.js — every test file gets its own cloned postgres
// database).
describe('CaseContextBatchLoader', () => {
    const knex = knexConfig;
    beforeEach(async () => {
        // Children before parents: aux_clients -> clients, transiciones -> estados.
        for (const t of ['aux_cases', 'aux_clients', 'transiciones', 'clients', 'clasificaciones', 'estados']) {
            await knex(t).delete();
        }
    });

    it('returns Map with shape matching getCasoInfo for each case', async () => {
        await knex('aux_cases').insert({ id: 'aux-c1', caso_id: 'c1', data: JSON.stringify({ foo: 'bar' }) });
        await knex('clients').insert({ id: 'cli1', nombres: 'Alice' });
        await knex('aux_clients').insert({ id: 'aux-cli1', cliente_id: 'cli1', data: JSON.stringify({ x: 1 }) });
        await knex('clasificaciones').insert({ id: 'cla1', nivel1: 'A', nivel2: 'B' });
        // estados before transiciones: transiciones.siguiente_estado_id is FK-constrained to estados.id.
        await knex('estados').insert({ id: 'est1', nombre: 'Open' });
        await knex('transiciones').insert({ id: 'tr1', siguiente_estado_id: 'est1', is_visible: true });

        const loader = new CaseContextBatchLoader(makeRepo(knex));
        const ctxMap = await loader.load([fakeCase()]);

        expect(ctxMap.has('c1')).toBe(true);
        const ctx = ctxMap.get('c1');
        expect(ctx.cases).toEqual({ id: 'c1', cliente_id: 'cli1' });
        expect(ctx.clients).toMatchObject({ nombres: 'Alice' });
        expect(ctx.aux_cases).toEqual({ foo: 'bar' });
        expect(ctx.aux_clients).toEqual({ x: 1 });
        expect(ctx.clasificaciones).toMatchObject({ nivel1: 'A', nivel2: 'B', description: 'A -> B' });
        expect(ctx.estados).toEqual({ id: 'est1', nombre: 'Open' });
    });

    it('handles missing aux rows by returning appropriate defaults', async () => {
        const loader = new CaseContextBatchLoader(makeRepo(knex));
        const ctxMap = await loader.load([fakeCase({ id: 'c2', cliente_id: 'cliX' })]);
        const ctx = ctxMap.get('c2');
        expect(ctx.cases).toBeDefined();
        expect(ctx.clients).toBeNull();
        expect(ctx.clasificaciones).toBeNull();
        expect(ctx.aux_cases).toBeUndefined();
        expect(ctx.aux_clients).toBeUndefined();
        expect(ctx.estados).toMatchObject({ id: undefined, nombre: undefined });
    });

    it('chunking handles >1 chunk without losing rows', async () => {
        const cases = [];
        for (let i = 0; i < 12; i++) {
            const id = `case-${i}`;
            cases.push(fakeCase({ id }));
            await knex('aux_cases').insert({ id: `aux-${id}`, caso_id: id, data: JSON.stringify({ i }) });
        }
        const loader = new CaseContextBatchLoader(makeRepo(knex), { chunkSize: 5 });
        const ctxMap = await loader.load(cases);
        expect(ctxMap.size).toBe(12);
        expect(ctxMap.get('case-7').aux_cases).toEqual({ i: 7 });
    });
});
