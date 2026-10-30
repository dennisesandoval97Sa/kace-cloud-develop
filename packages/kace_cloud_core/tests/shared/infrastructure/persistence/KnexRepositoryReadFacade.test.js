import { KnexRepository } from '../../../../src/shared/infrastructure/persistence/KnexRepository.js';
import { DbRequestContext } from '../../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../../knexfile.js';
import { watchPools } from '../../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

// `widgets` has no counterpart in the real schema (pure fixture for this generic-facade
// test), so it's kept as an explicit create, translated to postgres types.
const ensureWidgetsTable = async (knex) => {
    const exists = await knex.schema.hasTable('widgets');
    if (!exists) {
        await knex.schema.dropTableIfExists('widgets');
        await knex.schema.createTable('widgets', (t) => {
            t.integer('id');
            t.string('src');
        });
    }
};

// Writer y reader son dos rutas a la MISMA base fisica (ver tests/knexfile.js), asi que el
// contenido sembrado ya no distingue que pool sirvio una lectura, como si hacian las dos
// instancias sqlite :memory: de antes. Lo que si distingue es el evento `query` de knex, que
// se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools y cada test
// asegura que la lectura salio por el pool correcto. `seed` solo prepara la fila.
const seed = async (knex, src) => {
    await ensureWidgetsTable(knex);
    await knex('widgets').del();
    await knex('widgets').insert({ id: 1, src });
};

describe('KnexRepository — read facade', () => {
    let repo;
    let pools;

    afterEach(async () => {
        // Desenganchar listeners no lanza consultas, por eso va aqui y no en un afterAll:
        // los afterAll de este archivo corren DESPUES del DROP DATABASE de perFileDatabase.js.
        if (pools) {
            pools.stop();
            pools = undefined;
        }

        if (repo) {
            await repo.destroyConnection();
            repo = undefined;
        }
    });

    it('read.table() reads through the reader pool (distinct host => separate pool)', async () => {
        // Arrange
        repo = new KnexRepository(makeWriterConfig(), 'widgets', makeReaderConfig());
        pools = watchPools(repo);
        await seed(repo.writer, 'from-writer');

        // Act
        pools.reset();
        const rows = await repo.read.table('widgets').select('src');

        // Assert
        expect(pools.lastPool()).toBe('reader');
        expect(rows).toEqual([{ src: 'from-writer' }]);
    });

    it('read.table() routes to the writer after markWrite() (read-after-write)', async () => {
        repo = new KnexRepository(makeWriterConfig(), 'widgets', makeReaderConfig());
        pools = watchPools(repo);
        await seed(repo.writer, 'from-writer');

        const rows = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.read.table('widgets').select('src');
        });

        expect(pools.lastPool()).toBe('writer');
        expect(rows).toEqual([{ src: 'from-writer' }]);
    });

    it('read.table() falls back to the writer when no readerConfig is given (fail-safe)', async () => {
        repo = new KnexRepository(makeWriterConfig(), 'widgets');
        pools = watchPools(repo);
        await seed(repo.writer, 'from-writer');

        pools.reset();
        const rows = await repo.read.table('widgets').select('src');

        // Sin readerConfig solo hay un pool, asi que lo unico observable -y lo unico que hay
        // que garantizar- es que la lectura se ejecuto por el writer.
        expect(pools.sharedPool).toBe(true);
        expect(pools.lastPool()).toBe('writer');
        expect(rows).toEqual([{ src: 'from-writer' }]);
    });

    it('read.raw() executes through the reader pool', async () => {
        repo = new KnexRepository(makeWriterConfig(), 'widgets', makeReaderConfig());
        pools = watchPools(repo);
        await seed(repo.writer, 'from-writer');

        pools.reset();
        const result = await repo.read.raw('select src from widgets where id = ?', [1]);
        const rows = result?.rows ?? [];

        expect(pools.lastPool()).toBe('reader');
        expect(rows[0].src).toBe('from-writer');
    });
});
