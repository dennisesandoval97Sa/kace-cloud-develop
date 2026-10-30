import { KnexOneScriptRepository } from '../../../src/one-script/infrastructure/persistence/KnexOneScriptRepository.js';
import { OneScript } from '../../../src/one-script/domain/OneScript.js';
import { Criteria } from '../../../src/shared/criteria/Criteria.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const buildCriteria = () => new Criteria(undefined, undefined, null, 0, null, 'one-script');

const countValue = (row) => Number(Object.values(row)[0]);

// The per-file database is cloned once for the whole file (see tests/knexfile.js), not per
// `it()`, so fixture ids must stay unique across every test in this file.
let idSeq = 0;
const nextUuid = () => `00000000-0000-4000-8000-${(idSeq++).toString(16).padStart(12, '0')}`;

const seedRows = async (knex, n) => {
    const rows = Array.from({ length: n }, () => ({
        id: nextUuid(),
        name: 'one-script-seeded',
        url: 'https://example.test/seeded',
        url_api: 'https://api.example.test/seeded',
        schema_id: null,
        onescript_reference_id: null,
        created_at: new Date().toISOString(),
        created_by: nextUuid(),
        deleted_at: null,
        deleted_by: null,
    }));
    if (rows.length) await knex('one-script').insert(rows);
};

// Tier C: one_script admin CRUD → list/count reads route to the replica, while
// find() (OneScriptUpdater read-before-write) stays on the writer.
describe('KnexOneScriptRepository — reader wiring (Oleada 16)', () => {
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
        repo = new KnexOneScriptRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexOneScriptRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('search() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexOneScriptRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = (await repo.search(buildCriteria())).length;
        await seedRows(repo.writer, 3);

        pools.reset();
        expect(await repo.search(buildCriteria())).toHaveLength(baseline + 3);
        expect(pools.lastPool()).toBe('reader');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.search(buildCriteria());
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite).toHaveLength(baseline + 3);
    });

    it('count() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexOneScriptRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = countValue(await repo.count(buildCriteria()));
        await seedRows(repo.writer, 3);

        pools.reset();
        expect(countValue(await repo.count(buildCriteria()))).toBe(baseline + 3);
        expect(pools.lastPool()).toBe('reader');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.count(buildCriteria());
        });
        expect(pools.lastPool()).toBe('writer');
        expect(countValue(afterWrite)).toBe(baseline + 3);
    });

    // find() lee por this.table() a proposito: lo usa OneScriptUpdater como read-before-write, y
    // servirlo desde la replica podria validar contra una version anterior de la fila. El titulo
    // promete las dos clausulas -"con o sin reader configurado"-, asi que se ejercitan las dos.
    it('find() always reads via the writer pool, with or without a reader configured', async () => {
        const insertRow = async (knex, id) =>
            knex('one-script').insert({
                id,
                name: 'one-script-find',
                url: 'https://example.test/find',
                url_api: 'https://api.example.test/find',
                schema_id: null,
                onescript_reference_id: null,
                created_at: new Date().toISOString(),
                created_by: nextUuid(),
                deleted_at: null,
                deleted_by: null,
            });

        repo = new KnexOneScriptRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const withReaderId = nextUuid();
        await insertRow(repo.writer, withReaderId);

        pools.reset();
        const withReader = await repo.find({ value: withReaderId });
        expect(pools.lastPool()).toBe('writer');
        expect(withReader).toBeInstanceOf(OneScript);
        expect(withReader.id.value).toBe(withReaderId);

        pools.stop();
        await repo.destroyConnection();

        repo = new KnexOneScriptRepository(makeWriterConfig());
        pools = watchPools(repo);
        expect(pools.sharedPool).toBe(true);
        const noReaderId = nextUuid();
        await insertRow(repo.writer, noReaderId);

        pools.reset();
        const noReader = await repo.find({ value: noReaderId });
        expect(pools.lastPool()).toBe('writer');
        expect(noReader).toBeInstanceOf(OneScript);
        expect(noReader.id.value).toBe(noReaderId);
    });

    it('save() marks the request as written so subsequent reads fall to the writer', async () => {
        repo = new KnexOneScriptRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = countValue(await repo.count(buildCriteria()));
        await seedRows(repo.writer, 3);

        const afterWrite = await DbRequestContext.run(async () => {
            const oneScript = new OneScript({
                id: nextUuid(),
                name: 'one-script-created',
                url: 'https://example.test/created',
                url_api: 'https://api.example.test/created',
                created_at: new Date().toISOString(),
                created_by: nextUuid(),
            });
            await repo.save(oneScript);
            expect(DbRequestContext.hasWritten()).toBe(true);
            pools.reset();
            return repo.count(buildCriteria());
        });
        expect(pools.lastPool()).toBe('writer');
        // 3 seeded + 1 created, on top of whatever the cloned template already carried.
        expect(countValue(afterWrite)).toBe(baseline + 4);
    });
});
