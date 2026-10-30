import { KnexAgendasGroupsRepository } from '../../../src/agendas-groups/infrastructure/persistence/KnexAgendasGroupsRepository.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const stubCriteria = { convertToKnex: (qb) => qb };
const num = (r) => Number(r && typeof r === 'object' ? Object.values(r)[0] : r);

const markWriteOnCall = async (repo, method, arg) =>
    DbRequestContext.run(async () => {
        try {
            await repo[method](arg);
        } catch {
            // markWrite() fired before the DB op.
        }
        return DbRequestContext.hasWritten();
    });

// agendas_groups is a hard-delete pivot table (no deleted_at, no history) — every write is
// marked via manual markWrite(). count() (relationship table → no deleted_at filter) proves reader routing.
describe('KnexAgendasGroupsRepository — reader wiring (Oleada 12 pivot)', () => {
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

    // The per-file database is cloned once for the whole file (see tests/knexfile.js), not
    // per `it()`, so fixture ids must stay unique across every test in this file.
    let idSeq = 0;
    const nextIds = (n) => Array.from({ length: n }, () => `ag${idSeq++}`);

    // agendas_groups.agenda_id/group_id are FK-constrained (agendas, grupos); real parent
    // rows are seeded so the pivot inserts satisfy those constraints.
    const seedParents = async (knex, ids) => {
        for (const id of ids) {
            await knex('agendas').insert({ id, description: `agenda ${id}`, is_active: true, daily_limit: 1 });
            await knex('grupos').insert({ id });
        }
    };

    const seed = async (knex, ids) => {
        for (const id of ids) await knex('agendas_groups').insert({ agenda_id: id, group_id: id });
    };

    it('opens a separate reader pool with a distinct reader config', () => {
        repo = new KnexAgendasGroupsRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexAgendasGroupsRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('count() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexAgendasGroupsRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = num(await repo.count(stubCriteria));
        const ids = nextIds(2);
        await seedParents(repo.writer, ids);
        await seed(repo.writer, ids);

        pools.reset();
        expect(num(await repo.count(stubCriteria))).toBe(baseline + 2);
        expect(pools.lastPool()).toBe('reader');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.count(stubCriteria);
        });
        expect(pools.lastPool()).toBe('writer');
        expect(num(afterWrite)).toBe(baseline + 2);
    });

    it('save() and delete() mark the request as written', async () => {
        repo = new KnexAgendasGroupsRepository(makeWriterConfig(), makeReaderConfig());
        const [id] = nextIds(1);
        await seedParents(repo.writer, [id]);
        const pivot = { agenda_id: { value: id }, group_id: { value: id } };
        expect(await markWriteOnCall(repo, 'save', pivot)).toBe(true);
        expect(await markWriteOnCall(repo, 'delete', pivot)).toBe(true);
    });

    it('startTransaction() marks the request as written', async () => {
        repo = new KnexAgendasGroupsRepository(makeWriterConfig(), makeReaderConfig());
        const wrote = await DbRequestContext.run(async () => {
            const trx = await repo.startTransaction();
            const flag = DbRequestContext.hasWritten();
            await trx.rollback();
            return flag;
        });
        expect(wrote).toBe(true);
    });
});
