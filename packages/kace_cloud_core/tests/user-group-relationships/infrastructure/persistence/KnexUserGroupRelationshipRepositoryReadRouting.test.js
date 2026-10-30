import { KnexUserGroupRelationshipRepository } from '../../../../src/user-group-relationships/infrastructure/persistence/KnexUserGroupRelationshipRepository.js';
import { DbRequestContext } from '../../../../src/shared/infrastructure/context/DbRequestContext.js';
import { StatusEnum } from '../../../../src/shared/domain/enum/StatusEnum.js';
import { buildReaderConfig, buildWriterConfig } from '../../../knexfile.js';
import { watchPools } from '../../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const stubCriteria = { convertToKnex: (qb) => qb };
const countVal = (r) => Number(Object.values(r)[0]);

// The per-file database is cloned once for the whole file (see tests/knexfile.js), not per
// `it()`, so fixture ids must stay unique across every test in this file.
let idSeq = 0;
const nextIds = (n) => Array.from({ length: n }, () => `ugr-${idSeq++}`);

// rel_usuarios_grupos.usuario_id/grupo_id are FK-constrained (usuarios, grupos); real parent rows
// are seeded so the pivot inserts satisfy those constraints.
const seed = async (knex, ids) => {
    for (const id of ids) {
        await knex('usuarios').insert({ id, deleted_at: null, is_active: String(StatusEnum.ACTIVE.value) });
        await knex('grupos').insert({ id, deleted_at: null, status: StatusEnum.ACTIVE.value });
        await knex('rel_usuarios_grupos').insert({ usuario_id: id, grupo_id: id });
    }
};

describe('KnexUserGroupRelationshipRepository — reader wiring', () => {
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
        repo = new KnexUserGroupRelationshipRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexUserGroupRelationshipRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('count reads from the replica and returns to the writer after a write', async () => {
        repo = new KnexUserGroupRelationshipRepository(makeWriterConfig(), makeReaderConfig());
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
});
