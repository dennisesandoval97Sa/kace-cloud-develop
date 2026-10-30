import { KnexGroupsRepository } from '../../../src/grupos/infrastructure/persistence/KnexGroupsRepository.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const stubCriteria = { convertToKnex: (qb) => qb };
const countVal = (r) => Number(Object.values(r)[0]);

// The per-file database is cloned once for the whole file (see tests/knexfile.js), not per
// `it()`, so fixture ids must stay unique across every test in this file.
let idSeq = 0;
const nextUuid = () => `00000000-0000-4000-8000-${(idSeq++).toString(16).padStart(12, '0')}`;

// count() (repo override) reads via this.read and returns a plain row (no Groups value-object
// construction). find/search route through the identical facade. save() is a direct insert guarded
// by markWrite (fired before the insert, so the try/catch below still proves the write flag).
// Uses a baseline delta, not an absolute count: the cloned per-file database is a clone of a
// migrated+seeded template, so grupos may already carry rows before this test inserts.
const seed = async (knex, n) => {
    const rows = Array.from({ length: n }, () => ({ id: nextUuid(), deleted_at: null }));
    if (rows.length) await knex('grupos').insert(rows);
};

describe('KnexGroupsRepository — reader wiring (Oleada 9)', () => {
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
        repo = new KnexGroupsRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexGroupsRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('count() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexGroupsRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = countVal(await repo.count(stubCriteria));
        await seed(repo.writer, 2);

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
        repo = new KnexGroupsRepository(makeWriterConfig(), makeReaderConfig());
        const stubToSave = {
            id: { value: nextUuid() },
            nombre: { value: 'Grupo' },
            status: { value: 1 },
            horario_id: { value: null },
            descripcion: { value: 'desc' },
            rol_id: { value: null },
            configuration_id: { value: null },
            codigo_externo: { value: null },
            codigos_externos: { value: null },
            permisos: { value: null },
            layouts: { value: null },
            comportamientos: { value: null },
            filter_order: { value: null },
            data: { value: null },
            ips_allowed: { value: null },
            created_by: { value: null },
            created_at: { value: null },
        };

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
});
