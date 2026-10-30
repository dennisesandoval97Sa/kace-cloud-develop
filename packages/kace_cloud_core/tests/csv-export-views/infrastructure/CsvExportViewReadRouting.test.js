import { KnexCsvExportViewRepository } from '../../../src/csv-export-views/infrastructure/KnexCsvExportViewRepository.js';
import { CsvExportView } from '../../../src/csv-export-views/domain/CsvExportView.js';
import { ValueObjectTimeFilter } from '../../../src/csv-export-views/domain/value-objects/ValueObjectTimeFilter.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

let idSeq = 0;
const UUID = () => `44444444-4444-4444-8444-4444444444${String(idSeq++).padStart(2, '0')}`;

const noopCriteria = { convertToKnex: (qb) => qb };

const seedCsvExportView = async (
    knex,
    { id, description, nextExecutionAt = new Date().toISOString(), lastExecutionAt = null }
) => {
    await knex('csv_export_views').insert({
        id,
        description,
        is_active: true,
        views: JSON.stringify(['default']),
        frequency: 'hours',
        interval: 12,
        time_filter: JSON.stringify({ field: 'created_at', interval: 12, unit: 'hours', reference: 'now' }),
        storage_path: 'some/path',
        last_execution_at: lastExecutionAt,
        details: null,
        next_execution_at: nextExecutionAt,
        created_by: UUID(),
        created_at: new Date().toISOString(),
        deleted_by: null,
    });
};

// Tier C: generate-csv is hybrid. find/search/fetchViewData route to the replica;
// findByNextExecutionAt stays on the writer (cron read-then-write); save() marks a write.
describe('KnexCsvExportViewRepository — reader wiring (Oleada 16)', () => {
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
        repo = new KnexCsvExportViewRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexCsvExportViewRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('find() reads through the resolved reader pool, then the writer after a write', async () => {
        repo = new KnexCsvExportViewRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const id = UUID();
        await seedCsvExportView(repo.writer, { id, description: 'SEEDED' });

        pools.reset();
        const fromReplica = await repo.find({ value: id });
        expect(pools.lastPool()).toBe('reader');
        expect(fromReplica).toBeInstanceOf(CsvExportView);
        expect(fromReplica.description.value).toBe('SEEDED');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.find({ value: id });
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite.description.value).toBe('SEEDED');
    });

    // Same reasoning as find() above: baseline-delta count instead of a writer/reader marker
    // split, since the clone is a migrated template and may already contain rows.
    it('search() reads through the resolved reader pool, then the writer after a write', async () => {
        repo = new KnexCsvExportViewRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = (await repo.search(noopCriteria)).length;
        await seedCsvExportView(repo.writer, { id: UUID(), description: 'writer one' });
        await seedCsvExportView(repo.writer, { id: UUID(), description: 'writer two' });
        await seedCsvExportView(repo.writer, { id: UUID(), description: 'writer three' });

        pools.reset();
        expect(await repo.search(noopCriteria)).toHaveLength(baseline + 3);
        expect(pools.lastPool()).toBe('reader');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.search(noopCriteria);
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite).toHaveLength(baseline + 3);
    });

    it('findByNextExecutionAt() STAYS on the writer even with a reader config', async () => {
        repo = new KnexCsvExportViewRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        await seedCsvExportView(repo.writer, { id: UUID(), description: 'pending', lastExecutionAt: null });

        // findByNextExecutionAt() lee por this.table() a proposito: es un read-then-write de
        // cron, y servirlo desde la replica podria reprocesar una vista ya ejecutada. Que el
        // pool observado sea el writer AUNQUE haya reader configurado es justo la garantia.
        pools.reset();
        const pending = await repo.findByNextExecutionAt();
        expect(pools.lastPool()).toBe('writer');
        expect(pending.length).toBeGreaterThanOrEqual(1);
        expect(pending[0]).toBeInstanceOf(CsvExportView);
    });

    it('save() marks a write so subsequent reads pin to the writer', async () => {
        repo = new KnexCsvExportViewRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);

        const id = UUID();
        const view = CsvExportView.create({
            id,
            description: 'created',
            is_active: true,
            views: ['v'],
            frequency: 'hours',
            interval: 12,
            time_filter: { field: 'created_at', interval: 12, unit: 'hours', reference: 'now' },
            storage_path: 'p',
            last_execution_at: null,
            next_execution_at: new Date().toISOString(),
            details: null,
            created_by: UUID(),
            created_at: new Date().toISOString(),
        });

        await DbRequestContext.run(async () => {
            await repo.save(view);
            // Tras la escritura, una lectura de la MISMA peticion tiene que volver al writer:
            // eso es el read-after-write, y se comprueba mirando quien ejecuta el search().
            pools.reset();
            await repo.search(noopCriteria);
            expect(pools.lastPool()).toBe('writer');
        });

        const rows = await repo.writer('csv_export_views').where({ id });
        expect(rows).toHaveLength(1);
    });

    // test_view has no equivalent in the real migrated schema (it's a stand-in for an arbitrary
    // reporting view), so it's still fabricated here. Same reasoning as find()/search() above:
    // baseline-delta + pool identity instead of a writer/reader marker split. The two tests use
    // disjoint created_at ranges (a fixed 2026-01-15 date vs. "now") so they don't interfere with
    // each other's counts on the shared per-file table.
    const seedView = async (knex, n, createdAt) => {
        const exists = await knex.schema.hasTable('test_view');
        if (!exists) {
            await knex.schema.dropTableIfExists('test_view');
            await knex.schema.createTable('test_view', (t) => {
                t.string('id');
                t.timestamp('created_at');
            });
        }
        for (let i = 0; i < n; i++) {
            await knex('test_view').insert({ id: UUID(), created_at: createdAt });
        }
    };

    it('fetchViewData() reads the view rows from the replica (filterDate path)', async () => {
        repo = new KnexCsvExportViewRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        await seedView(repo.writer, 3, '2026-01-15 10:00:00');

        const timeFilter = new ValueObjectTimeFilter('time_filter', {
            field: 'created_at',
            interval: 12,
            unit: 'hours',
            reference: 'now',
        });

        pools.reset();
        expect(await repo.fetchViewData('test_view', timeFilter, '2026-01-15')).toHaveLength(3);
        expect(pools.lastPool()).toBe('reader');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.fetchViewData('test_view', timeFilter, '2026-01-15');
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite).toHaveLength(3);
    });

    it('fetchViewData() reads from the replica via the raw interval fragment (no filterDate)', async () => {
        repo = new KnexCsvExportViewRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const nowIso = new Date().toISOString().slice(0, 19).replace('T', ' ');
        await seedView(repo.writer, 2, nowIso);

        const timeFilter = new ValueObjectTimeFilter('time_filter', {
            field: 'created_at',
            interval: 12,
            unit: 'hours',
            reference: 'now',
        });

        // Recent rows survive the "> now - 12h" filter; the raw fragment must build/execute on
        // the reader without a binding/dialect error. The fixed-date rows seeded by the previous
        // test are far outside this window and don't interfere.
        pools.reset();
        expect(await repo.fetchViewData('test_view', timeFilter)).toHaveLength(2);
        expect(pools.lastPool()).toBe('reader');
    });
});
