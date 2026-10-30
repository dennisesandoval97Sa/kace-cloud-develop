import { KnexGlobalConfigurationRepository } from '../../../src/global-config/infrastructure/persistence/KnexGlobalConfigurationRepository.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const stubCriteria = { convertToKnex: (qb) => qb };
const NOW = '2026-07-06T00:00:00.000Z';
const SETTINGS = JSON.stringify({
    layouts: { application: {} },
    behaviors: { application: {} },
    custom_fields: { application: {} },
});

// The per-file database is cloned once for the whole file (see tests/knexfile.js), not per
// `it()`, so fixture ids must stay unique across every test in this file.
let idSeq = 0;
const nextUuid = () => `00000000-0000-4000-8000-${(idSeq++).toString(16).padStart(12, '0')}`;

const markWriteOnCall = async (repo, method, arg) =>
    DbRequestContext.run(async () => {
        try {
            await repo[method](arg);
        } catch {
            // markWrite() fired before the DB op.
        }
        return DbRequestContext.hasWritten();
    });

const seed = async (knex, n) => {
    const rows = Array.from({ length: n }, () => ({
        id: nextUuid(),
        settings: SETTINGS,
        is_active: true,
        description: 'configuracion global',
        created_at: NOW,
        created_by: nextUuid(),
        deleted_at: null,
        deleted_by: null,
    }));
    if (rows.length) await knex('global_configurations').insert(rows);
};

// Tier B: search/findByIds → réplica (find ya migrado en Oleada 6b). Writes van al writer.
describe('KnexGlobalConfigurationRepository — reader wiring (Oleada 14)', () => {
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
    it('search() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexGlobalConfigurationRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = (await repo.search(stubCriteria)).length;
        await seed(repo.writer, 2);

        pools.reset();
        expect(await repo.search(stubCriteria)).toHaveLength(baseline + 2);
        expect(pools.lastPool()).toBe('reader');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.search(stubCriteria);
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite).toHaveLength(baseline + 2);
    });

    it('save() and update() mark the request as written', async () => {
        repo = new KnexGlobalConfigurationRepository(makeWriterConfig(), makeReaderConfig());
        const id = nextUuid();
        const agg = { id: { value: id }, hasMeaningfulChanges: () => true, changedAttributes: {} };
        expect(await markWriteOnCall(repo, 'save', agg)).toBe(true);
        expect(await markWriteOnCall(repo, 'update', agg)).toBe(true);
    });
});
