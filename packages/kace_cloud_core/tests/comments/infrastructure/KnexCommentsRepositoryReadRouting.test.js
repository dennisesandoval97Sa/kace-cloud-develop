import { KnexCommentsRepository } from '../../../src/comments/infrastructure/persistence/KnexCommentsRepository.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const stubCriteria = { convertToKnex: (qb) => qb };
const num = (r) => Number(r && typeof r === 'object' ? Object.values(r)[0] : r);

// The per-file database is cloned once for the whole file (see tests/knexfile.js), not per
// `it()`, so fixture ids must stay unique across every test in this file.
let idSeq = 0;
const nextIds = (n) => Array.from({ length: n }, () => `com${idSeq++}`);

// comentarios.caso_id is FK-constrained (cases) and NOT NULL; a real parent row is seeded so the
// inserts satisfy that constraint.
const seedCase = async (knex, id) => {
    await knex('cases').insert({ id });
};

// count() (repo override) reads via this.read and returns a scalar (no Comment construction).
// find/search route through the identical facade. Direct writes are guarded by markWrite (fired
// before the query, so the try/catch still proves the write flag).
const seed = async (knex, ids, casoId) => {
    for (const id of ids) await knex('comentarios').insert({ id, caso_id: casoId });
};

const stubToSave = {
    id: { value: 'c-new' },
    descripcion: { value: 'd' },
    calificacion: { value: 5 },
    caso_id: { value: null },
    created_at: { value: null },
    updated_at: { value: null },
    created_by: { value: null },
    updated_by: { value: null },
};

describe('KnexCommentsRepository — reader wiring (Oleada 11)', () => {
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
        repo = new KnexCommentsRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexCommentsRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('count() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexCommentsRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = num(await repo.count(stubCriteria));
        const [casoId] = nextIds(1);
        await seedCase(repo.writer, casoId);
        const ids = nextIds(2);
        await seed(repo.writer, ids, casoId);

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

    it('save() marks the request as written', async () => {
        repo = new KnexCommentsRepository(makeWriterConfig(), makeReaderConfig());
        const wrote = await DbRequestContext.run(async () => {
            try {
                await repo.save(stubToSave);
            } catch {
                // markWrite() fired before the insert.
            }
            return DbRequestContext.hasWritten();
        });
        expect(wrote).toBe(true);
    });

    it('update() marks the request as written', async () => {
        repo = new KnexCommentsRepository(makeWriterConfig(), makeReaderConfig());
        const wrote = await DbRequestContext.run(async () => {
            try {
                await repo.update({ changedAttributes: { descripcion: 'x' }, id: { value: 'c0' } });
            } catch {
                // markWrite() fired before the update.
            }
            return DbRequestContext.hasWritten();
        });
        expect(wrote).toBe(true);
    });

    it('delete() marks the request as written', async () => {
        repo = new KnexCommentsRepository(makeWriterConfig(), makeReaderConfig());
        const wrote = await DbRequestContext.run(async () => {
            try {
                await repo.delete({ changedAttributes: { deleted_by: 'x' }, id: { value: 'c0' } });
            } catch {
                // markWrite() fired before the update.
            }
            return DbRequestContext.hasWritten();
        });
        expect(wrote).toBe(true);
    });
});
