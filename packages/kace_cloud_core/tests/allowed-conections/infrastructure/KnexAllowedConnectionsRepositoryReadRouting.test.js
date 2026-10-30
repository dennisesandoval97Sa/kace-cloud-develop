import { KnexAllowedConnectionsRepository } from '../../../src/allowed-conections/infrastructure/persistence/KnexAllowedConnectionsRepository.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const CREATED_BY = '44444444-4444-4444-8444-444444444444';
const CREATED_AT = '2026-01-01T00:00:00.000Z';

const stubCriteria = { convertToKnex: (qb) => qb };
const countVal = (r) => Number(r && typeof r === 'object' ? Object.values(r)[0] : r);

// AllowedConnection wraps id in ValueObjectUuid, which validates strict UUID format.
let idSeq = 0;
const nextIds = (n) => Array.from({ length: n }, () => `aaaaaaaa-aaaa-4aaa-8aaa-${String(idSeq++).padStart(12, '0')}`);

const row = (id, description, connection = 'example.com') => ({
    id,
    description,
    connection,
    certificate: null,
    is_active: true,
    has_ssl: false,
    created_at: CREATED_AT,
    created_by: CREATED_BY,
    deleted_at: null,
    deleted_by: null,
});

const seed = async (knex, rows) => {
    if (rows.length) await knex('allowed_connections').insert(rows);
};

describe('KnexAllowedConnectionsRepository — reader wiring (Oleada 7 Tier B)', () => {
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
        repo = new KnexAllowedConnectionsRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexAllowedConnectionsRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('find() and findByConnection() resolve through the reader pool, then the writer pool after a write', async () => {
        repo = new KnexAllowedConnectionsRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const [id] = nextIds(1);
        await seed(repo.writer, [row(id, 'ONLY', 'host.example.com')]);

        pools.reset();
        const fromReplica = await repo.find({ value: id });
        expect(pools.lastPool()).toBe('reader');
        expect(fromReplica.description.value).toBe('ONLY');
        const foundByConnection = await repo.findByConnection({ value: 'https://host.example.com/path' });
        expect(foundByConnection.description.value).toBe('ONLY');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.find({ value: id });
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite.description.value).toBe('ONLY');
    });

    it('search() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexAllowedConnectionsRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = (await repo.search(stubCriteria)).length;
        const [idX, idY] = nextIds(2);
        await seed(repo.writer, [row(idX, 'CONN-A'), row(idY, 'CONN-B')]);

        pools.reset();
        expect(await repo.search(stubCriteria)).toHaveLength(baseline + 2);
        expect(pools.lastPool()).toBe('reader');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.search(stubCriteria);
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite).toHaveLength(baseline + 2);
    });

    it('save() marks the request as written', async () => {
        repo = new KnexAllowedConnectionsRepository(makeWriterConfig(), makeReaderConfig());
        const [id] = nextIds(1);
        const stubToSave = {
            id: { value: id },
            description: { value: 'NEW' },
            connection: { value: 'new.example.com' },
            certificate: { value: null },
            is_active: { value: true },
            has_ssl: { value: false },
            created_at: { value: CREATED_AT },
            created_by: { value: CREATED_BY },
            deleted_at: { value: null },
            deleted_by: { value: null },
        };

        const wrote = await DbRequestContext.run(async () => {
            await repo.save(stubToSave);
            return DbRequestContext.hasWritten();
        });
        expect(wrote).toBe(true);
    });

    it('persists and reopens a cleared certificate when HTTPS is disabled', async () => {
        repo = new KnexAllowedConnectionsRepository(makeWriterConfig());
        const [id] = nextIds(1);
        await seed(repo.writer, [
            {
                ...row(id, 'HTTPS CONNECTION'),
                certificate: 'existing-fingerprint',
                has_ssl: true,
            },
        ]);

        const allowedConnection = await repo.find({ value: id });
        allowedConnection.update({ has_ssl: false, certificate: '' });
        await repo.update(allowedConnection);

        const reopened = await repo.find({ value: id });
        expect(reopened.has_ssl.value).toBe(false);
        expect(reopened.certificate.value).toBe('');
    });
});
