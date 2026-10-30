import { KnexUserNotificationRepository } from '../../../../src/user-notifications/infrastructure/persistence/KnexUserNotificationRepository.js';
import { DbRequestContext } from '../../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../../knexfile.js';
import { watchPools } from '../../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const makeId = (value) => ({ value });

const FIXED_USER_ID = '22222222-2222-4222-a222-222222222222';
const FIXED_CREATED_BY = '33333333-3333-4333-a333-333333333333';

const row = (id) => ({
    id,
    asunto: 'a',
    mensaje: 'm',
    fecha_inicio: '2026-01-01',
    fecha_fin: '2026-01-02',
    leida: false,
    leida_por: null,
    user_id: FIXED_USER_ID,
    is_active: true,
    created_at: '2026-01-01',
    created_by: FIXED_CREATED_BY,
    deleted_at: null,
    deleted_by: null,
});

describe('KnexUserNotificationRepository — reader wiring', () => {
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
        repo = new KnexUserNotificationRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexUserNotificationRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('find() executes against the resolved reader pool, then the writer after a write', async () => {
        repo = new KnexUserNotificationRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const id = '11111111-1111-4111-a111-111111111111';
        await repo.writer('user_notifications').insert(row(id));

        pools.reset();
        const fromReplica = await repo.find(makeId(id));
        expect(pools.lastPool()).toBe('reader');
        expect(fromReplica).not.toBeNull();

        const fromWriter = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.find(makeId(id));
        });
        expect(pools.lastPool()).toBe('writer');
        expect(fromWriter).not.toBeNull();
    });
});
