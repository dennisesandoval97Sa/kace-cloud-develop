import { KnexRoleRepository } from '../../../src/role/infrastructure/persistence/KnexRoleRepository.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const stubCriteria = { convertToKnex: (qb) => qb };
const countVal = (r) => Number(Object.values(r)[0]);

// count() (repo override) reads via this.read and returns a plain row (no Role construction).
// find()/search() route through the identical facade. save() is a direct insert guarded by markWrite.
// The per-file database is cloned once for the whole file (see tests/knexfile.js), not per `it()`,
// so fixture ids must stay unique across every test in this file.
let idSeq = 0;
const nextIds = (n) => Array.from({ length: n }, () => `role-${idSeq++}`);

const seed = async (knex, ids) => {
    for (const id of ids) await knex('roles').insert({ id, deleted_at: null });
};

const stubToSave = {
    id: { value: 'role-new-1' },
    descripcion: { value: 'rol' },
    permisos: { value: null },
    status: { value: 1 },
    created_at: { value: null },
    created_by: { value: null },
};

describe('KnexRoleRepository — reader wiring (Oleada 9)', () => {
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
        repo = new KnexRoleRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexRoleRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('count() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexRoleRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = countVal(await repo.count(stubCriteria));
        const ids = nextIds(2);
        await seed(repo.writer, ids);

        pools.reset();
        expect(countVal(await repo.count(stubCriteria))).toBe(baseline + 2);
        expect(pools.lastPool()).toBe('reader');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.count(stubCriteria);
        });
        expect(pools.lastPool()).toBe('writer');
        expect(countVal(afterWrite)).toBe(baseline + 2);
    });

    it('save() marks the request as written', async () => {
        repo = new KnexRoleRepository(makeWriterConfig(), makeReaderConfig());

        const wrote = await DbRequestContext.run(async () => {
            await repo.save(stubToSave);
            return DbRequestContext.hasWritten();
        });
        expect(wrote).toBe(true);
    });
});
