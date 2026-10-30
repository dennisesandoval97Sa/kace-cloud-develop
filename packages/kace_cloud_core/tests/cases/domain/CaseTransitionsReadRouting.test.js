import { KnexCaseRepository } from '../../../src/cases/index.js';
import { CaseTransitions } from '../../../src/cases/domain/CaseTransitions.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const USER_ID = 'user-1';
const GROUP_ID = 'group-1';
const TRANSITION_ID = 'trans-1';
const STATE_ACTUAL_ID = 'state-a';
const STATE_NEXT_ID = 'state-b';

// CaseTransitions.execute() enriches via #getLogin (usuarios), #getGroup (grupos),
// #getStates (transiciones + estados), all through this.#repository.read.table(), so each call
// re-resolves the reader pool independently.
const seed = async (knex) => {
    await knex('usuarios').insert({ id: USER_ID, login: 'user-login', nombres: 'N', apellido1: 'A', apellido2: 'B' });
    await knex('grupos').insert({ id: GROUP_ID, nombre: 'grupo-1' });
    await knex('estados').insert([
        { id: STATE_ACTUAL_ID, nombre: 'actual-state' },
        { id: STATE_NEXT_ID, nombre: 'next-state' },
    ]);
    await knex('transiciones').insert({
        id: TRANSITION_ID,
        estado_actual_id: STATE_ACTUAL_ID,
        siguiente_estado_id: STATE_NEXT_ID,
    });
};

const ATTRS = JSON.stringify({
    responsable_id: USER_ID,
    grupo_id: GROUP_ID,
    transicion_id: TRANSITION_ID,
    created_by: USER_ID,
    updated_at: '2026-07-02T00:00:00.000Z',
});

describe('CaseTransitions.execute — read routing (enrichment)', () => {
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
    it('enriches through the resolved pool, before and after a write', async () => {
        repo = new KnexCaseRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        await seed(repo.writer);

        pools.reset();
        const result = await new CaseTransitions(repo).execute(ATTRS, ATTRS);
        expect(pools.lastPool()).toBe('reader');
        expect(result.responsable.login).toBe('user-login');
        expect(result.grupo).toBe('grupo-1');
        expect(result.estado_actual).toBe('actual-state');
        expect(result.estado_siguiente).toBe('next-state');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return new CaseTransitions(repo).execute(ATTRS, ATTRS);
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite.responsable.login).toBe('user-login');
        expect(afterWrite.grupo).toBe('grupo-1');
        expect(afterWrite.estado_actual).toBe('actual-state');
        expect(afterWrite.estado_siguiente).toBe('next-state');
    });
});
