import { KnexCaseRepository } from '../../../../src/cases/index.js';
import { EntityCache } from '../../../../src/shared/index.js';
import { buildWriterConfig } from '../../../knexfile.js';

const makeConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });

// Case ids AND every FK that the Case domain entity wraps in ValueObjectUuid (cliente_id,
// grupo_id, responsable_id, transicion_id, clasificacion_id) must be valid UUIDs, because
// findAllMatchingCondition builds full Case entities (CaseDataGrid does the same).
const LIVE_CASE_ID = '11111111-1111-4111-8111-111111111111';
// Soft-deleted row: deleted_at IS SET but deleted_by IS NULL. This is the leak the fix closes:
// the old query (filtering only deleted_by) would WRONGLY include this row.
const SOFT_DELETED_CASE_ID = '99999999-9999-4999-8999-999999999999';

const CLIENTE_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const GRUPO_ID = 'aaaaaaaa-0000-4000-8000-000000000002';
const RESPONSABLE_ID = 'aaaaaaaa-0000-4000-8000-000000000003';
const TRANSICION_ID = 'aaaaaaaa-0000-4000-8000-000000000004';
const CLASIFICACION_ID = 'aaaaaaaa-0000-4000-8000-000000000005';
const ESTADO_ID = 'aaaaaaaa-0000-4000-8000-000000000006';
const DESCRIPCION_CASO_ID = 'aaaaaaaa-0000-4000-8000-000000000007';

// cases/clients/grupos/usuarios/transiciones/clasificaciones/descripciones_casos/estados all
// exist in the real migrated schema (see tests/knexfile.js — every test file gets its own
// cloned postgres database); only the FK-constrained parent rows need seeding. The per-file
// database is shared across every `it()` in this file (cloned once in beforeAll), so the
// fixed ids must be cleared before reseeding each test (children before parents).
const cleanup = async (knex) => {
    await knex('cases').whereIn('id', [LIVE_CASE_ID, SOFT_DELETED_CASE_ID]).delete();
    await knex('transiciones').where({ id: TRANSICION_ID }).delete();
    await knex('estados').where({ id: ESTADO_ID }).delete();
    await knex('clasificaciones').where({ id: CLASIFICACION_ID }).delete();
    await knex('descripciones_casos').where({ id: DESCRIPCION_CASO_ID }).delete();
    await knex('clients').where({ id: CLIENTE_ID }).delete();
    await knex('grupos').where({ id: GRUPO_ID }).delete();
    await knex('usuarios').where({ id: RESPONSABLE_ID }).delete();
};

const seed = async (knex) => {
    await cleanup(knex);
    await knex('clients').insert({ id: CLIENTE_ID });
    await knex('grupos').insert({ id: GRUPO_ID });
    await knex('usuarios').insert({ id: RESPONSABLE_ID });
    // estados before transiciones: transiciones.siguiente_estado_id is FK-constrained to estados.id.
    await knex('estados').insert({ id: ESTADO_ID, nombre: 'Open', color: '#fff' });
    await knex('transiciones').insert({ id: TRANSICION_ID, siguiente_estado_id: ESTADO_ID, is_visible: true });
    await knex('clasificaciones').insert({ id: CLASIFICACION_ID, ans_id: null, json_flujo: null });
    await knex('descripciones_casos').insert({ id: DESCRIPCION_CASO_ID });

    const baseRow = {
        cliente_id: CLIENTE_ID,
        grupo_id: GRUPO_ID,
        responsable_id: RESPONSABLE_ID,
        transicion_id: TRANSICION_ID,
        clasificacion_id: CLASIFICACION_ID,
        descripcion_caso_id: DESCRIPCION_CASO_ID,
        created_by: RESPONSABLE_ID,
        created_at: new Date().toISOString(),
    };
    await knex('cases').insert({ ...baseRow, id: LIVE_CASE_ID, deleted_by: null, deleted_at: null });
    await knex('cases').insert({
        ...baseRow,
        id: SOFT_DELETED_CASE_ID,
        deleted_by: null,
        deleted_at: new Date().toISOString(),
    });
};

// Mirrors the real Criteria.convertToKnex contract: mutates the builder in place AND returns it.
const noopCriteria = () => ({ convertToKnex: (qb) => qb });

describe('KnexCaseRepository — soft-deleted rows excluded from list/count reads', () => {
    let repo;

    beforeEach(async () => {
        const config = makeConfig();
        repo = new KnexCaseRepository(config);
        await seed(repo.writer);
    });

    afterEach(async () => {
        EntityCache.invalidateNamespace('cases:count');
        EntityCache.invalidateNamespace('cases:searchCount');
        EntityCache.invalidateNamespace('cases:countByStatus');
        if (repo) {
            await repo.destroyConnection();
            repo = undefined;
        }
    });

    it('search() excludes the soft-deleted (deleted_at set) row and returns only the live one', async () => {
        const rows = await repo.search(noopCriteria());

        expect(rows).toHaveLength(1);
        expect(rows[0].toJson().id).toBe(LIVE_CASE_ID);
    });

    it('searchCount() counts only the live row, not the soft-deleted one', async () => {
        const result = await repo.searchCount(noopCriteria());

        expect(parseInt(result.count, 10)).toBe(1);
    });

    it('searchCountByStatus() counts only the live row per status', async () => {
        const rows = await repo.searchCountByStatus(noopCriteria());

        const total = rows.reduce((sum, r) => sum + r.count, 0);
        expect(total).toBe(1);
    });

    it('findAllMatchingCondition() excludes the soft-deleted row', async () => {
        const results = await repo.findAllMatchingCondition({});

        expect(results).toHaveLength(1);
        expect(results[0].id.value).toBe(LIVE_CASE_ID);
    });
});
