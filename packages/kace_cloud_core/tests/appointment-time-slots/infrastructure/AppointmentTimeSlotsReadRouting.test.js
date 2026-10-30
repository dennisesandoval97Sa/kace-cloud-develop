import { KnexAppointmentTimeSlotsRepository } from '../../../src/appointment-time-slots/infraestructure/persistence/KnexAppointmentTimeSlots.js';
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
const nextIds = (n) => Array.from({ length: n }, () => `s${idSeq++}`);

// appointment_time_slots.agenda_id is FK-constrained (agendas); a real parent row is seeded so
// the slot inserts satisfy that constraint.
const seedParent = async (knex, agendaId) => {
    await knex('agendas').insert({ id: agendaId, description: `agenda ${agendaId}`, is_active: true, daily_limit: 1 });
};

// Tier C: findAll/search/count route to the replica; the anti-double-booking guards
// (getOverlaps, find, getDailyLimitByAgendaId) stay on the writer and are not exercised here.
describe('KnexAppointmentTimeSlotsRepository — reader wiring (Oleada 12 Tier C)', () => {
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
        const [agendaId] = nextIds(1);
        await seedParent(knex, agendaId);
        const ids = nextIds(n);
        for (const id of ids) {
            await knex('appointment_time_slots').insert({
                id,
                agenda_id: agendaId,
                start_time: '08:00:00',
                end_time: '09:00:00',
                deleted_at: null,
            });
        }
    };

    it('opens a separate reader pool with a distinct reader config', () => {
        repo = new KnexAppointmentTimeSlotsRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexAppointmentTimeSlotsRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('count() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexAppointmentTimeSlotsRepository(makeWriterConfig(), makeReaderConfig());
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
        repo = new KnexAppointmentTimeSlotsRepository(makeWriterConfig(), makeReaderConfig());
        const [id] = nextIds(1);
        const slot = { id: { value: id } };
        expect(await markWriteOnCall(repo, 'save', slot)).toBe(true);
        expect(await markWriteOnCall(repo, 'update', slot)).toBe(true);
    });
});
