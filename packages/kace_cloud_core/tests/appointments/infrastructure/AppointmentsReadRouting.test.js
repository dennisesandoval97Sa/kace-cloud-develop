import { KnexAppointmentRepository } from '../../../src/appointments/infrastructure/persistence/KnexAppointmentRepository.js';
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

let idSeq = 0;
const nextIds = (n) => Array.from({ length: n }, () => `ap${idSeq++}`);

// appointments.case_id/agenda_id are FK-constrained (cases, agendas); real parent rows are
// seeded so the appointment inserts satisfy those constraints.
const seedParents = async (knex, caseId, agendaId) => {
    await knex('cases').insert({ id: caseId });
    await knex('agendas').insert({ id: agendaId, description: `agenda ${agendaId}`, is_active: true, daily_limit: 1 });
};

// Tier C: findAll/search/countByCase route to the replica; the availability guards live in
// KnexAppointmentValidationRepository (kept entirely on the writer, not exercised here).
describe('KnexAppointmentRepository — reader wiring (Oleada 12 Tier C)', () => {
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
        const [agendaId] = nextIds(1);
        await seedParents(knex, caseId, agendaId);
        const ids = nextIds(n);
        const now = new Date().toISOString();
        for (const id of ids) {
            await knex('appointments').insert({
                id,
                case_id: caseId,
                agenda_id: agendaId,
                date: now.slice(0, 10),
                start_time: now,
                end_time: now,
                deleted_at: null,
            });
        }
    };

    it('opens a separate reader pool with a distinct reader config', () => {
        repo = new KnexAppointmentRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexAppointmentRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('count() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexAppointmentRepository(makeWriterConfig(), makeReaderConfig());
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

    it('save() and update() mark the request as written', async () => {
        repo = new KnexAppointmentRepository(makeWriterConfig(), makeReaderConfig());
        const [id] = nextIds(1);
        const appointment = { id: { value: id } };
        expect(await markWriteOnCall(repo, 'save', appointment)).toBe(true);
        expect(await markWriteOnCall(repo, 'update', appointment)).toBe(true);
    });
});
