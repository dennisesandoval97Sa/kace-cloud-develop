import { KnexCaseSessionDurationRepository } from '../../../src/case_session_durations/infraestructure/KnexCaseSessionDurationRepository.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const stubCriteria = { convertToKnex: (qb) => qb };
const num = (r) => Number(r && typeof r === 'object' ? Object.values(r)[0] : r);

const markWriteOnCall = async (repo, method, ...args) =>
    DbRequestContext.run(async () => {
        try {
            await repo[method](...args);
        } catch {
            // markWrite() fired before the DB op.
        }
        return DbRequestContext.hasWritten();
    });

let idSeq = 0;
const nextIds = (n) => Array.from({ length: n }, () => `sd${idSeq++}`);

// case_session_durations.case_id/user_id are FK-constrained (cases, usuarios); real parent rows
// are seeded so the inserts satisfy those constraints.
const seedParents = async (knex, caseId, userId) => {
    await knex('cases').insert({ id: caseId });
    await knex('usuarios').insert({ id: userId });
};

// Tier C (satélite de cases): search/count → réplica; find/findByCaseAndUser/findDuplicate + cases → writer.
// No hay tabla history → cada write directo (save/update/softDelete/delete) marca write manualmente.
describe('KnexCaseSessionDurationRepository — reader wiring (Oleada 13 Tier C)', () => {
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

    const seed = async (knex, n) => {
        const [caseId] = nextIds(1);
        const [userId] = nextIds(1);
        await seedParents(knex, caseId, userId);
        const ids = nextIds(n);
        const now = new Date();
        for (const id of ids) {
            await knex('case_session_durations').insert({
                id,
                case_id: caseId,
                user_id: userId,
                started_at: now,
                deleted_at: null,
            });
        }
    };

    it('opens a separate reader pool with a distinct reader config', () => {
        repo = new KnexCaseSessionDurationRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexCaseSessionDurationRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('count() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexCaseSessionDurationRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = num(await repo.count(stubCriteria));
        await seed(repo.writer, 2);

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

    it('save/update/softDelete/delete mark the request as written', async () => {
        repo = new KnexCaseSessionDurationRepository(makeWriterConfig(), makeReaderConfig());
        const [id] = nextIds(1);
        const agg = { id: { value: id } };
        expect(await markWriteOnCall(repo, 'save', agg)).toBe(true);
        expect(await markWriteOnCall(repo, 'update', agg)).toBe(true);
        expect(await markWriteOnCall(repo, 'softDelete', agg, { value: 'u' })).toBe(true);
        expect(await markWriteOnCall(repo, 'delete', agg)).toBe(true);
    });
});
