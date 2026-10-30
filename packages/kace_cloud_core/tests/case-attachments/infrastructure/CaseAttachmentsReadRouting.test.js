import { KnexCaseAttachmentRepository } from '../../../src/case-attachments/infrastructure/KnexCaseAttachmentRepository.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const stubCriteria = { convertToKnex: (qb) => qb };
const num = (r) => Number(r && typeof r === 'object' ? Object.values(r)[0] : r);

const markWriteOnCall = async (repo, method, arg) =>
    DbRequestContext.run(async () => {
        try {
            await repo[method](arg);
        } catch {
            // markWrite() fired before the DB op.
        }
        return DbRequestContext.hasWritten();
    });

let idSeq = 0;
const nextIds = (n) => Array.from({ length: n }, () => `att${idSeq++}`);

// case_attachments has no FK on case_id in the real schema, so a bare string id is enough.
const seed = async (knex, n) => {
    const ids = nextIds(n);
    for (const id of ids) await knex('case_attachments').insert({ id, case_id: 'case-x', deleted_at: null });
};

// Tier B (satélite de cases): search/count → réplica; find + toda lectura del agregado cases → writer.
describe('KnexCaseAttachmentRepository — reader wiring (Oleada 13)', () => {
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
        repo = new KnexCaseAttachmentRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexCaseAttachmentRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('count() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexCaseAttachmentRepository(makeWriterConfig(), makeReaderConfig());
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

    it('save() marks the request as written', async () => {
        repo = new KnexCaseAttachmentRepository(makeWriterConfig(), makeReaderConfig());
        const [id] = nextIds(1);
        expect(await markWriteOnCall(repo, 'save', { id: { value: id } })).toBe(true);
    });
});
