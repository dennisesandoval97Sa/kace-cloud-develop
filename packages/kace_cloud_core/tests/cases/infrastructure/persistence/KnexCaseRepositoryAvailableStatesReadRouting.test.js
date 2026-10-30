import { KnexCaseRepository } from '../../../../src/cases/index.js';
import { DbRequestContext } from '../../../../src/shared/infrastructure/context/DbRequestContext.js';
import { ValueObjectUuid } from '../../../../src/shared/index.js';
import { StatusEnum } from '../../../../src/shared/domain/enum/StatusEnum.js';
import { buildReaderConfig, buildWriterConfig } from '../../../knexfile.js';
import { watchPools } from '../../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

// Valid UUID: CaseFinder wraps the id in ValueObjectUuid, which validates the format.
const CASE_ID = '11111111-1111-4111-8111-111111111111';

// The onward transition rows and the estados they reference are wrapped into domain
// entities (Transitions, State), both AggregateRoot subclasses whose `id` (and, for
// Transitions, `flujo_id`/`estado_actual_id`/`siguiente_estado_id`) go through
// ValueObjectUuid, which validates strict UUID format (see AggregateRoot / ValueObjectUuid,
// and the analogous note in KnexCaseRepositoryReadRouting.test.js). So every id below must
// be a valid UUID, not a short symbolic string.
const FLUJO_ID = '44444444-4444-4444-8444-444444444444';
const S0_STATE_ID = '55555555-5555-4555-8555-555555555555';
const S1_STATE_ID = '66666666-6666-4666-8666-666666666666';
const S2_STATE_ID = '77777777-7777-4777-8777-777777777777';
const T0_TRANSITION_ID = '88888888-8888-4888-8888-888888888888';
const ONWARD_TRANSITION_ID = '99999999-9999-4999-8999-999999999999';
const CREATOR_ID = '22222222-2222-4222-8222-222222222222';

// Seeds the minimal chain findByIdForAvailableStates walks:
//   cases -> transiciones (current t0) -> transiciones (onward from S1) -> estados
// Writer and reader configs are two routes to the SAME physical database (see
// tests/knexfile.js), so a writer-count/reader-count seed pair can no longer distinguish which
// pool findByIdForAvailableStates() read through the way separate sqlite :memory: instances used
// to. This seeds ONE onward transition and asserts on the `reader` getter's resolved pool
// identity directly (the actual mechanism under test) while still exercising the method
// end-to-end through both states.
const seed = async (knex) => {
    const now = new Date().toISOString();

    // transiciones.flujo_id and estado_actual_id/siguiente_estado_id are FK-constrained to
    // flujos and estados: seed those parents first, before any transition can reference them.
    await knex('flujos').insert({ id: FLUJO_ID, nombre: 'Flujo de prueba' });
    await knex('estados').insert([
        {
            id: S0_STATE_ID,
            nombre: 'Nuevo',
            color: '#000',
            status: StatusEnum.ACTIVE.value,
            created_at: now,
            created_by: CREATOR_ID,
        },
        {
            id: S1_STATE_ID,
            nombre: 'Abierto',
            color: '#111',
            status: StatusEnum.ACTIVE.value,
            created_at: now,
            created_by: CREATOR_ID,
        },
        {
            id: S2_STATE_ID,
            nombre: 'Cerrado',
            color: '#222',
            status: StatusEnum.ACTIVE.value,
            created_at: now,
            created_by: CREATOR_ID,
        },
    ]);

    // Current transition of the case: flujo F, onward state S1.
    await knex('transiciones').insert({
        id: T0_TRANSITION_ID,
        flujo_id: FLUJO_ID,
        estado_actual_id: S0_STATE_ID,
        siguiente_estado_id: S1_STATE_ID,
        is_visible: true,
        status: StatusEnum.ACTIVE.value,
        created_at: now,
        created_by: CREATOR_ID,
    });
    await knex('cases').insert({ id: CASE_ID, transicion_id: T0_TRANSITION_ID });

    // Single onward transition from S1 (estado_actual_id = S1, siguiente_estado_id != S1).
    await knex('transiciones').insert({
        id: ONWARD_TRANSITION_ID,
        flujo_id: FLUJO_ID,
        estado_actual_id: S1_STATE_ID,
        siguiente_estado_id: S2_STATE_ID,
        is_visible: true,
        status: StatusEnum.ACTIVE.value,
        created_at: now,
        created_by: CREATOR_ID,
    });
};

describe('KnexCaseRepository.findByIdForAvailableStates — read routing', () => {
    let repo;
    let pools;

    afterEach(async () => {
        // Desenganchar listeners no lanza consultas, por eso va aqui y no en un afterAll: los
        // afterAll de este archivo corren DESPUES del DROP DATABASE de perFileDatabase.js.
        if (pools) {
            pools.stop();
            pools = undefined;
        }

        if (repo) {
            await repo.destroyConnection();
            repo = undefined;
        }
    });

    it('opens a separate reader pool with a distinct reader config', () => {
        repo = new KnexCaseRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexCaseRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    it('resolves available states through the reader pool, then the writer pool after a write', async () => {
        repo = new KnexCaseRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        await seed(repo.writer);

        pools.reset();
        const result = await repo.findByIdForAvailableStates(new ValueObjectUuid('id', CASE_ID));
        expect(pools.lastPool()).toBe('reader');
        expect(result).toHaveLength(1);

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.findByIdForAvailableStates(new ValueObjectUuid('id', CASE_ID));
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite).toHaveLength(1);
    });
});
