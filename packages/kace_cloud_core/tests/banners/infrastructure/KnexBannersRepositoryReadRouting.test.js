import { KnexBannersRepository } from '../../../src/banners/infrastructure/persistence/KnexBannersRepository.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const stubCriteria = { convertToKnex: (qb) => qb };

let idSeq = 0;
const nextIds = (n) => Array.from({ length: n }, () => `dddddddd-dddd-4ddd-8ddd-${String(idSeq++).padStart(12, '0')}`);

// Banner has heavy value objects (JSON propiedades/especificaciones, required status enum, date
// validation). count() exercises the SAME this.read.table('banners') facade + read-after-write
// without constructing a Banner, so it proves reader wiring robustly. find()/search() route
// through the identical facade (one-line change, verified by inspection).
const seed = async (knex, n) => {
    const ids = nextIds(n);
    if (ids.length) await knex('banners').insert(ids.map((id) => ({ id, deleted_by: null })));
    return ids;
};

describe('KnexBannersRepository — reader wiring (Oleada 7 Tier B)', () => {
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
        repo = new KnexBannersRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexBannersRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('count() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexBannersRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = Number(await repo.count(stubCriteria));
        await seed(repo.writer, 2);

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
        repo = new KnexBannersRepository(makeWriterConfig(), makeReaderConfig());
        const [id] = nextIds(1);
        const stubToSave = {
            id: { value: id },
            descripcion: { value: 'NEW' },
            propiedades: { value: {} },
            fecha_inicio: { value: '2026-01-01T00:00:00.000Z' },
            fecha_fin: { value: '2026-01-02T00:00:00.000Z' },
            especificaciones: { value: {} },
            status: { value: 1 },
            created_at: { value: '2026-01-01T00:00:00.000Z' },
            updated_at: { value: '2026-01-01T00:00:00.000Z' },
            created_by: { value: '44444444-4444-4444-8444-444444444444' },
            updated_by: { value: '44444444-4444-4444-8444-444444444444' },
        };

        const wrote = await DbRequestContext.run(async () => {
            await repo.save(stubToSave);
            return DbRequestContext.hasWritten();
        });
        expect(wrote).toBe(true);
    });

    it('update() marks the request as written', async () => {
        repo = new KnexBannersRepository(makeWriterConfig(), makeReaderConfig());
        const [id] = await seed(repo.writer, 1);

        const wrote = await DbRequestContext.run(async () => {
            await repo.update({ changedAttributes: { deleted_by: null }, id: { value: id } });
            return DbRequestContext.hasWritten();
        });
        expect(wrote).toBe(true);
    });

    it('delete() marks the request as written', async () => {
        repo = new KnexBannersRepository(makeWriterConfig(), makeReaderConfig());
        const [id] = await seed(repo.writer, 1);

        const wrote = await DbRequestContext.run(async () => {
            await repo.delete({ changedAttributes: { deleted_by: 'x' }, id: { value: id } });
            return DbRequestContext.hasWritten();
        });
        expect(wrote).toBe(true);
    });
});
