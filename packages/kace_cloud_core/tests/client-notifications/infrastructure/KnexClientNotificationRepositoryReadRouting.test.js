import { KnexClientNotificationRepository } from '../../../src/client-notifications/infrastructure/persistence/KnexClientNotificationRepository.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const stubCriteria = { convertToKnex: (qb) => qb };

// The per-file database is cloned once for the whole file (see tests/knexfile.js), not per
// `it()`, so fixture ids must stay unique across every test in this file.
let idSeq = 0;
const nextIds = (n) => Array.from({ length: n }, () => `cn${idSeq++}`);

// client_notifications.client_id is FK-constrained (clients) and NOT NULL; a real parent row is
// seeded so the inserts satisfy that constraint.
const seedParent = async (knex, id) => {
    await knex('clients').insert({ id });
};

// count() (repo override) reads via this.read and returns a plain row (no ClientNotification
// construction). find/search route through the identical facade. save() is a direct insert guarded
// by markWrite (fired before the insert, so the try/catch still proves the write flag).
const seed = async (knex, ids, clientId) => {
    for (const id of ids) await knex('client_notifications').insert({ id, client_id: clientId, deleted_by: null });
};

const stubToSave = {
    id: { value: 'cn-new' },
    client_id: { value: null },
    subject: { value: 's' },
    message: { value: 'm' },
    start_date: { value: null },
    end_date: { value: null },
    is_read: { value: false },
    read_by: { value: null },
    is_active: { value: true },
    created_at: { value: null },
    created_by: { value: null },
    deleted_at: { value: null },
    deleted_by: { value: null },
};

describe('KnexClientNotificationRepository — reader wiring (Oleada 10)', () => {
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
        repo = new KnexClientNotificationRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexClientNotificationRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('count() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexClientNotificationRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = Number(await repo.count(stubCriteria));
        const [clientId] = nextIds(1);
        await seedParent(repo.writer, clientId);
        const ids = nextIds(2);
        await seed(repo.writer, ids, clientId);

        pools.reset();
        expect(Number(await repo.count(stubCriteria))).toBe(baseline + 2);
        expect(pools.lastPool()).toBe('reader');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.count(stubCriteria);
        });
        expect(pools.lastPool()).toBe('writer');
        expect(Number(afterWrite)).toBe(baseline + 2);
    });

    it('save() marks the request as written', async () => {
        repo = new KnexClientNotificationRepository(makeWriterConfig(), makeReaderConfig());

        const wrote = await DbRequestContext.run(async () => {
            try {
                await repo.save(stubToSave);
            } catch {
                // insert may fail on the minimal schema; markWrite() already fired first.
            }
            return DbRequestContext.hasWritten();
        });
        expect(wrote).toBe(true);
    });

    it('update() marks the request as written', async () => {
        repo = new KnexClientNotificationRepository(makeWriterConfig(), makeReaderConfig());

        const wrote = await DbRequestContext.run(async () => {
            try {
                await repo.update({ changedAttributes: { subject: 'x' }, id: { value: 'cn0' } });
            } catch {
                // table may be absent; markWrite() already fired first.
            }
            return DbRequestContext.hasWritten();
        });
        expect(wrote).toBe(true);
    });
});
