import { KnexGlobalConfigurationRepository } from '../../../src/global-config/index.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { ValueObjectUuid } from '../../../src/shared/index.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const CREATOR_ID = '33333333-3333-4333-8333-333333333333';

// The per-file database is cloned once for the whole file (see tests/knexfile.js), not per
// `it()`, so fixture ids must stay unique across every test in this file.
let idSeq = 0;
const nextUuid = () => `00000000-0000-4000-8000-${(idSeq++).toString(16).padStart(12, '0')}`;

const settingsJson = () =>
    JSON.stringify({
        layouts: { application: {} },
        behaviors: { application: {} },
        custom_fields: { application: {} },
    });

const seed = async (knex, id) => {
    await knex('global_configurations').insert({
        id,
        settings: settingsJson(),
        is_active: true,
        description: 'cfg',
        created_at: new Date(2026, 0, 1).toISOString(),
        created_by: CREATOR_ID,
        deleted_at: null,
    });
};

describe('KnexGlobalConfigurationRepository.find — read routing', () => {
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
        repo = new KnexGlobalConfigurationRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexGlobalConfigurationRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('find() resolves via the replica pool, then via the writer pool after a write', async () => {
        repo = new KnexGlobalConfigurationRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const id = nextUuid();
        await seed(repo.writer, id);

        pools.reset();
        const viaReplica = await repo.find(new ValueObjectUuid('id', id));
        expect(pools.lastPool()).toBe('reader');
        expect(viaReplica).not.toBeNull();

        const viaWriter = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.find(new ValueObjectUuid('id', id));
        });
        expect(pools.lastPool()).toBe('writer');
        expect(viaWriter).not.toBeNull();
    });
});
