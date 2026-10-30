import { KnexViewCaseRepository } from '../../../../src/cases/infrastructure/persistence/KnexViewCaseRepository.js';
import { DbRequestContext } from '../../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../../knexfile.js';
import { watchPools } from '../../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

// mv_dashboard_* ARE real materialized views in the migrated schema (refreshed periodically
// by a dashboard lambda in prod, computed from live `cases` data) — unlike an ordinary table,
// postgres rejects direct INSERT/DELETE against a matview ("cannot change materialized
// view"), so they cannot be seeded the way the old sqlite ad-hoc tables were. This uses a
// custom, never-real matview prefix instead (mirroring how ConfiguredViewCaseRepositoryFactory
// tests use mv_view_casos_ans_counts for a per-tenant custom view): the `_ans_counts`/
// `_state_counts`/`_group_counts` tables for that prefix genuinely don't exist in the base
// schema, so creating them as ordinary tables is safe and mirrors production shape.
//
// Writer and reader configs are two routes to the SAME physical database (see
// tests/knexfile.js), so a row written via one pool is instantly visible via the other — a
// writer/reader marker split can no longer prove which pool served a read. These helpers
// reset each matview table to a single known row (written through the writer), and the tests
// assert on `reader`/`writer` pool identity (the actual mechanism under test) while still
// exercising each getXFromView() method end-to-end.
const PREFIX = 'mv_readrouting_test';

const ensureTable = async (knex, name, builder) => {
    const exists = await knex.schema.hasTable(name);
    if (!exists) await knex.schema.createTable(name, builder);
};

const seedAns = async (knex, pending) => {
    await ensureTable(knex, `${PREFIX}_ans_counts`, (t) => {
        t.integer('pending');
        t.integer('to_overcome');
        t.integer('defeated');
        t.integer('managed');
    });
    await knex(`${PREFIX}_ans_counts`).del();
    await knex(`${PREFIX}_ans_counts`).insert({ pending, to_overcome: 0, defeated: 0, managed: 0 });
};

const seedState = async (knex, estadoNombre) => {
    await ensureTable(knex, `${PREFIX}_state_counts`, (t) => {
        t.string('estado_id');
        t.string('estado_nombre');
        t.string('icon_class');
        t.bigInteger('total');
    });
    await knex(`${PREFIX}_state_counts`).del();
    await knex(`${PREFIX}_state_counts`).insert({
        estado_id: '1',
        estado_nombre: estadoNombre,
        icon_class: 'ic',
        total: 5,
    });
};

const seedGroup = async (knex, grupoNombre) => {
    await ensureTable(knex, `${PREFIX}_group_counts`, (t) => {
        t.string('grupo_id');
        t.string('grupo_nombre');
        t.string('estado_id');
        t.string('estado_nombre');
        t.bigInteger('total');
    });
    await knex(`${PREFIX}_group_counts`).del();
    await knex(`${PREFIX}_group_counts`).insert({
        grupo_id: '1',
        grupo_nombre: grupoNombre,
        estado_id: '1',
        estado_nombre: 'abierto',
        total: 3,
    });
};

// Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos ya no
// distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query` de knex, que
// se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools y cada test
// asegura que la lectura del matview salio por la replica, asercion que muere si el enrutamiento
// se apaga en el origen.
describe('KnexViewCaseRepository — matview reads hit the replica', () => {
    let repo;
    let pools;

    const build = async () => {
        const r = new KnexViewCaseRepository(makeWriterConfig(), 'view_case_details', makeReaderConfig(), PREFIX);
        pools = watchPools(r);
        await seedAns(r.writer, 11);
        await seedState(r.writer, 'DASHBOARD_STATE');
        await seedGroup(r.writer, 'DASHBOARD_GROUP');
        return r;
    };

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

    it('getAnsCountsFromView reads through the resolved reader pool', async () => {
        repo = await build();

        pools.reset();
        const result = await repo.getAnsCountsFromView();

        expect(pools.lastPool()).toBe('reader');
        expect(result.pending).toBe(11);
    });

    it('getStateCountsFromView reads through the resolved reader pool', async () => {
        repo = await build();

        pools.reset();
        const rows = await repo.getStateCountsFromView();

        expect(pools.lastPool()).toBe('reader');
        expect(rows[0].nombre).toBe('DASHBOARD_STATE');
    });

    it('getGroupCountsFromView reads through the resolved reader pool (covers #getEntityCountsFromMatview)', async () => {
        repo = await build();

        pools.reset();
        const entities = await repo.getGroupCountsFromView();

        expect(pools.lastPool()).toBe('reader');
        expect(entities[1].nombre).toBe('DASHBOARD_GROUP');
    });

    it('matview reads pin to the writer pool identity after a write in the same request (read-after-write)', async () => {
        repo = await build();
        const result = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.getAnsCountsFromView();
        });

        expect(pools.lastPool()).toBe('writer');
        expect(result.pending).toBe(11);
    });
});
