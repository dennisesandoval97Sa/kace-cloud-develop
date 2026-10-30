import { KnexGeolocationRepository } from '../../../src/geolocation/infrastructure/persistence/KnexGeolocationRepository.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const CREATED_BY = '44444444-4444-4444-8444-444444444444';
const CREATED_AT = '2026-01-01T00:00:00.000Z';

// The per-file database is cloned once for the whole file (see tests/knexfile.js), not per
// `it()`, so fixture ids must stay unique across every test in this file.
let idSeq = 0;
const nextUuid = () => `00000000-0000-4000-8000-${(idSeq++).toString(16).padStart(12, '0')}`;

// geolocation.user_id is FK-constrained (usuarios); a real parent row is seeded so inserts
// satisfy that constraint.
const seedUser = async (knex) => {
    const id = nextUuid();
    await knex('usuarios').insert({ id });
    return id;
};

const seed = async (knex, n, userId) => {
    const rows = [];
    for (let i = 0; i < n; i++) {
        rows.push({
            id: nextUuid(),
            user_id: userId,
            action_type: 'CREATE',
            latitud: '1.0',
            longitud: '2.0',
            ip4_address: '1.2.3.4',
            metadata: null,
            created_at: CREATED_AT,
            created_by: CREATED_BY,
            deleted_at: null,
            deleted_by: null,
        });
    }
    if (rows.length) await knex('geolocation').insert(rows);
};

describe('KnexGeolocationRepository — reader wiring (Oleada 7 Tier B)', () => {
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
        repo = new KnexGeolocationRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexGeolocationRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('findAll() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexGeolocationRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const userId = await seedUser(repo.writer);
        const baseline = (await repo.findAll()).length;
        await seed(repo.writer, 2, userId);

        pools.reset();
        expect(await repo.findAll()).toHaveLength(baseline + 2);
        expect(pools.lastPool()).toBe('reader');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.findAll();
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite).toHaveLength(baseline + 2);
    });

    it('save() marks the request as written', async () => {
        repo = new KnexGeolocationRepository(makeWriterConfig(), makeReaderConfig());
        const userId = await seedUser(repo.writer);
        const id = nextUuid();

        const wrote = await DbRequestContext.run(async () => {
            await repo.save({
                id: { value: id },
                user_id: { value: userId },
                action_type: { value: 'CREATE' },
                latitud: { value: '1.0' },
                longitud: { value: '2.0' },
                ip4_address: { value: '1.2.3.4' },
                metadata: { value: '{}' },
                created_at: { value: CREATED_AT },
                created_by: { value: CREATED_BY },
            });
            return DbRequestContext.hasWritten();
        });
        expect(wrote).toBe(true);
    });

    it('update() marks the request as written', async () => {
        repo = new KnexGeolocationRepository(makeWriterConfig(), makeReaderConfig());
        const userId = await seedUser(repo.writer);
        await seed(repo.writer, 1, userId);
        const [{ id }] = await repo.writer('geolocation').select('id').where({ user_id: userId });

        const wrote = await DbRequestContext.run(async () => {
            await repo.update({ id: { value: id }, changedAttributes: { action_type: 'UPDATED' } });
            return DbRequestContext.hasWritten();
        });
        expect(wrote).toBe(true);
    });
});
