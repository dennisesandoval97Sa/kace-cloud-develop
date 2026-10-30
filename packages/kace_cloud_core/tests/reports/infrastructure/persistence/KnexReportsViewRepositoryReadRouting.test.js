import { KnexReportsViewRepository } from '../../../../src/reports/infrastructure/persistence/KnexReportsViewRepository.js';
import { DbRequestContext } from '../../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../../knexfile.js';
import { watchPools } from '../../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

describe('KnexReportsViewRepository — reader wiring', () => {
    let repo;

    afterEach(async () => {
        if (repo) {
            await repo.destroyConnection();
            repo = undefined;
        }
    });

    it('opens a separate reader pool when a distinct reader config is provided', () => {
        repo = new KnexReportsViewRepository(makeWriterConfig(), makeReaderConfig());

        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool when no reader config is provided (fail-safe)', () => {
        repo = new KnexReportsViewRepository(makeWriterConfig());

        expect(repo.reader).toBe(repo.writer);
    });
});

// `mi_vista` es un nombre de vista sintetico, no una tabla del esquema migrado, asi que se
// construye a mano aqui. Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js),
// asi que sembrar datos distintos en cada pool ya no prueba nada: la fila insertada por uno se ve
// al instante por el otro. Lo que si distingue quien sirvio la lectura es el evento `query` de
// knex, que se emite en la instancia que ejecuta; `watchPools` lo engancha en ambos pools y cada
// test asegura que la consulta salio por el pool correcto.
describe('KnexReportsViewRepository — data reads route to the resolved pool', () => {
    let repo;
    let pools;

    // La tabla y su fila se crean en cada test: el reset por test elimina las
    // tablas que no vienen en el manifiesto de la plantilla, y `mi_vista` es una.
    beforeEach(async () => {
        repo = repo ?? new KnexReportsViewRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        await repo.writer.schema.dropTableIfExists('mi_vista');
        await repo.writer.schema.createTable('mi_vista', (t) => {
            t.integer('id');
            t.string('src');
            t.string('created_at');
        });
        await repo.writer('mi_vista').insert({ id: 1, src: 'seeded', created_at: '2026-01-01 00:00:00' });
    });

    // El repositorio se reutiliza entre tests, asi que el listener se desengancha aqui para no
    // acumular uno por test. Quitar un listener no lanza consultas.
    afterEach(() => {
        if (pools) {
            pools.stop();
            pools = undefined;
        }
    });

    afterAll(async () => {
        if (repo) {
            await repo.destroyConnection();
            repo = undefined;
        }
    });

    it('fetchViewDataWithConditions executes against the resolved reader pool', async () => {
        pools.reset();
        const rows = await repo.fetchViewDataWithConditions('mi_vista', null, []);

        expect(pools.lastPool()).toBe('reader');
        expect(rows).toEqual([{ id: 1, src: 'seeded', created_at: '2026-01-01 00:00:00' }]);
    });

    it('getDistinctFieldValues executes against the resolved reader pool', async () => {
        pools.reset();
        const { values } = await repo.getDistinctFieldValues('mi_vista', 'src', {});

        expect(pools.lastPool()).toBe('reader');
        expect(values).toEqual(['seeded']);
    });

    it('fetchViewData executes against the resolved reader pool', async () => {
        const timeFilter = {
            value: { field: 'created_at' },
            toSQLite: () => "'2025-01-01 00:00:00'",
            toSQL: () => "'2025-01-01 00:00:00'",
        };
        pools.reset();
        const rows = await repo.fetchViewData('mi_vista', timeFilter);

        expect(pools.lastPool()).toBe('reader');
        expect(rows).toEqual([{ id: 1, src: 'seeded', created_at: '2026-01-01 00:00:00' }]);
    });

    it('routes data reads to the writer after a write in the same request (read-after-write)', async () => {
        const rows = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.fetchViewDataWithConditions('mi_vista', null, []);
        });

        expect(pools.lastPool()).toBe('writer');
        expect(rows[0].src).toBe('seeded');
    });

    it('streamViewDataWithConditions executes against the resolved reader pool', async () => {
        const rows = [];
        pools.reset();
        for await (const row of repo.streamViewDataWithConditions('mi_vista', null, [])) {
            rows.push(row);
        }

        expect(pools.lastPool()).toBe('reader');
        expect(rows).toEqual([{ id: 1, src: 'seeded', created_at: '2026-01-01 00:00:00' }]);
    });
});
