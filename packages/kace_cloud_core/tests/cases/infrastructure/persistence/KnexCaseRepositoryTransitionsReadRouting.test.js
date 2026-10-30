import { KnexCaseRepository } from '../../../../src/cases/index.js';
import { DbRequestContext } from '../../../../src/shared/infrastructure/context/DbRequestContext.js';
import { ValueObjectUuid } from '../../../../src/shared/index.js';
import { buildReaderConfig, buildWriterConfig } from '../../../knexfile.js';
import { watchPools } from '../../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const CASE_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = 'user-1';
const GROUP_ID = 'group-1';
const TRANSITION_ID = 'trans-1';

const seedEnrichment = async (knex) => {
    await knex('cases').insert({ id: CASE_ID });
    await knex('usuarios').insert({ id: USER_ID, login: 'u', nombres: 'N', apellido1: 'A', apellido2: 'B' });
    await knex('grupos').insert({ id: GROUP_ID, nombre: 'g' });
    await knex('transiciones').insert({ id: TRANSITION_ID, estado_actual_id: null, siguiente_estado_id: null });
};

const attrs = (transicionId = TRANSITION_ID) =>
    JSON.stringify({ responsable_id: USER_ID, grupo_id: GROUP_ID, transicion_id: transicionId, created_by: USER_ID });

// history_cases.entity_id is FK-constrained to cases; rowCount rows are seeded, all carrying
// transicion_id in changed_attributes, so findTransitionsByCaseId's history-to-transitions
// transform returns exactly rowCount transitions (see #transformHistoryToTransitions).
const seedHistory = async (knex, rowCount, { sameTransition = false } = {}) => {
    const originalTransitionId = sameTransition ? TRANSITION_ID : 'trans-0';
    for (let i = 0; i < rowCount; i++) {
        await knex('history_cases').insert({
            id: `hc-${i}`,
            entity_id: CASE_ID,
            original_attributes: attrs(originalTransitionId),
            new_attributes: attrs(),
            changed_attributes: JSON.stringify({ transicion_id: TRANSITION_ID, updated_by: USER_ID }),
            created_at: new Date(2026, 0, 1, 0, 0, i).toISOString(),
        });
    }
};

describe('KnexCaseRepository.findTransitionsByCaseId — read routing (history)', () => {
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

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('resolves the history through the reader pool, then the writer pool after a write', async () => {
        repo = new KnexCaseRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        await seedEnrichment(repo.writer);
        await seedHistory(repo.writer, 3);

        pools.reset();
        const result = await repo.findTransitionsByCaseId(new ValueObjectUuid('id', CASE_ID));
        expect(pools.lastPool()).toBe('reader');
        expect(result).toHaveLength(3);

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.findTransitionsByCaseId(new ValueObjectUuid('id', CASE_ID));
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite).toHaveLength(3);
    });

    it('keeps already stored transition history rows even when transicion_id did not change', async () => {
        repo = new KnexCaseRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        await seedEnrichment(repo.writer);
        await seedHistory(repo.writer, 3, { sameTransition: true });

        const result = await repo.findTransitionsByCaseId(new ValueObjectUuid('id', CASE_ID));

        expect(result).toHaveLength(3);
        expect(result.every((item) => item.transicion_id === TRANSITION_ID)).toBe(true);
    });
});
