import { KnexCaseRepository } from '../../../../src/cases/index.js';
import { CaseContextBatchLoader } from '../../../../src/actions-queue-executions/domain/services/CaseContextBatchLoader.js';
import { DbRequestContext } from '../../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../../knexfile.js';
import { watchPools } from '../../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

// aux_cases.caso_id has no FK to cases, and clients has no FK from this write, so seeding a
// bare client + aux_cases row is enough to exercise CaseContextBatchLoader's joins.
const seed = async (knex, marker) => {
    await knex('clients').insert({ id: 'cl1', nombres: marker });
    await knex('aux_cases').insert({ id: 'aux-c1', caso_id: 'c1', data: JSON.stringify({ src: marker }) });
};

const caseAggregate = () => ({
    id: { value: 'c1' },
    cliente_id: { value: 'cl1' },
    clasificacion_id: { value: undefined },
    transicion_id: { value: undefined },
    toJson: () => ({ id: 'c1' }),
});

describe('CaseContextBatchLoader — read routing', () => {
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
    it('load() resolves aux_cases/clients through the reader pool, then the writer pool after a write', async () => {
        repo = new KnexCaseRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        await seed(repo.writer, 'marker');

        pools.reset();
        const map = await new CaseContextBatchLoader(repo).load([caseAggregate()]);
        expect(pools.lastPool()).toBe('reader');
        expect(map.get('c1').aux_cases).toEqual({ src: 'marker' });
        expect(map.get('c1').clients.id).toBe('cl1');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return new CaseContextBatchLoader(repo).load([caseAggregate()]);
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite.get('c1').aux_cases).toEqual({ src: 'marker' });
        expect(afterWrite.get('c1').clients.id).toBe('cl1');
    });
});
