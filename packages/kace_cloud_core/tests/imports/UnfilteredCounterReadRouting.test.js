import { KnexS3ImportFiles } from '../../src/imports/infrastructure/persistence/KnexS3ImportFiles.js';
import { UnfilteredCounter } from '../../src/imports/domain/UnfilteredCounter.js';
import { DbRequestContext } from '../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../knexfile.js';
import { watchPools } from '../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

// The per-file database is cloned once for the whole file (see tests/knexfile.js), not per
// `it()`, so fixture ids must stay unique across every test in this file.
let idSeq = 0;
const nextUuid = () => `00000000-0000-4000-8000-${(idSeq++).toString(16).padStart(12, '0')}`;

const seed = async (knex, count) => {
    const rows = Array.from({ length: count }, () => ({
        id: nextUuid(),
        created_by: nextUuid(),
        file_path: 'imports/file.csv',
        status: 'DONE',
        target_table: 'cases',
    }));
    if (rows.length) await knex('s3_import_files').insert(rows);
};

const minimalDtoCriteria = { filter: [], relationship: undefined };

const extractCount = (rows) => {
    const row = Array.isArray(rows) ? rows[0] : rows;
    return parseInt(Object.values(row)[0], 10);
};

describe('UnfilteredCounter — read routing', () => {
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
        repo = new KnexS3ImportFiles(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexS3ImportFiles(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('execute() counts from the replica, then from the writer after a write', async () => {
        repo = new KnexS3ImportFiles(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const counter = new UnfilteredCounter(repo);
        const baseline = extractCount(await counter.execute(minimalDtoCriteria));
        await seed(repo.writer, 2);

        pools.reset();
        expect(extractCount(await counter.execute(minimalDtoCriteria))).toBe(baseline + 2);
        expect(pools.lastPool()).toBe('reader');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return counter.execute(minimalDtoCriteria);
        });
        expect(pools.lastPool()).toBe('writer');
        expect(extractCount(afterWrite)).toBe(baseline + 2);
    });
});
