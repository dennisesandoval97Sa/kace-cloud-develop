import { KnexEmailsRepository } from '../../../src/emails/infrastructure/persistence/KnexEmailsRepository.js';
import { KnexEmailsBodyRepository } from '../../../src/emails/infrastructure/persistence/KnexEmailsBodyRepository.js';
import { KnexEmailAttachmentRepository } from '../../../src/emails/infrastructure/persistence/KnexEmailAttachmentRepository.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const stubCriteria = { convertToKnex: (qb) => qb };
const num = (r) => Number(r && typeof r === 'object' ? Object.values(r)[0] : r);

let idSeq = 0;
const nextIds = (n) => Array.from({ length: n }, () => `e${idSeq++}`);

// Emails split across 3 tables. count() (repo override on KnexEmailsRepository) proves reader routing
// + read-after-write without Email construction; the other repos' reads use the identical facade.
// Every direct write across the 3 repos is guarded by markWrite (fired before the query).
const markWriteOnCall = async (repo, method, arg) => {
    return DbRequestContext.run(async () => {
        try {
            await repo[method](arg);
        } catch {
            // markWrite() fired before the DB op.
        }
        return DbRequestContext.hasWritten();
    });
};

describe('KnexEmailsRepository — reader wiring (Oleada 11)', () => {
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
        const ids = nextIds(n);
        for (const id of ids) await knex('emails').insert({ id });
    };

    it('opens a separate reader pool with a distinct reader config', () => {
        repo = new KnexEmailsRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexEmailsRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('count() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexEmailsRepository(makeWriterConfig(), makeReaderConfig());
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
        repo = new KnexEmailsRepository(makeWriterConfig(), makeReaderConfig());
        const [id] = nextIds(1);
        const email = { id: { value: id } };
        expect(await markWriteOnCall(repo, 'save', email)).toBe(true);
        expect(await markWriteOnCall(repo, 'update', email)).toBe(true);
    });
});

describe('KnexEmailsBodyRepository — reader wiring (Oleada 11)', () => {
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

    it('opens a separate reader pool; save()/update() mark write', async () => {
        repo = new KnexEmailsBodyRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        expect(repo.reader).not.toBe(repo.writer);
        const [id] = nextIds(1);

        // El pool no basta con abrirlo: hay que comprobar que las lecturas del repositorio salen
        // de verdad por el, y `find()` es la que va por `this.read`.
        pools.reset();
        await repo.find({ value: id });
        expect(pools.lastPool()).toBe('reader');

        const body = { id: { value: id } };
        expect(await markWriteOnCall(repo, 'save', body)).toBe(true);
        expect(await markWriteOnCall(repo, 'update', body)).toBe(true);
    });
});

describe('KnexEmailAttachmentRepository — reader wiring (Oleada 11)', () => {
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

    it('opens a separate reader pool; save()/update()/deleteByEmailId() mark write', async () => {
        repo = new KnexEmailAttachmentRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        expect(repo.reader).not.toBe(repo.writer);
        const [id] = nextIds(1);

        // Igual que en emails_body: la lectura real tiene que ejecutarse en la replica.
        pools.reset();
        await repo.findAllByEmailId(id);
        expect(pools.lastPool()).toBe('reader');

        const att = { id: { value: id } };
        expect(await markWriteOnCall(repo, 'save', att)).toBe(true);
        expect(await markWriteOnCall(repo, 'update', att)).toBe(true);
        expect(await markWriteOnCall(repo, 'deleteByEmailId', 'e0')).toBe(true);
    });
});
