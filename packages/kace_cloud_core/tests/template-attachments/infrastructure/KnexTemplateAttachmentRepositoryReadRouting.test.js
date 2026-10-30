import { KnexTemplateAttachmentRepository } from '../../../src/template-attachments/infrastructure/KnexTemplateAttachmentRepository.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const TEMPLATE_ID = '22222222-2222-4222-8222-222222222222';
const CREATED_BY = '44444444-4444-4444-8444-444444444444';
const CREATED_AT = '2026-01-01T00:00:00.000Z';

const stubCriteria = { convertToKnex: (qb) => qb };

// The per-file database is cloned once for the whole file (see tests/knexfile.js), not per
// `it()`, so fixture ids must stay unique across every test in this file.
let idSeq = 0;
const nextIds = (n) => Array.from({ length: n }, () => `${idSeq++}1111111-1111-4111-8111-111111111111`);

const seed = async (knex, ids) => {
    for (const id of ids) {
        await knex('template_attachments').insert({
            id,
            template_id: TEMPLATE_ID,
            path: `archivo-${id}.pdf`,
            type: 'application/pdf',
            is_active: true,
            created_at: CREATED_AT,
            created_by: CREATED_BY,
            deleted_by: null,
        });
    }
};

const stubToSave = (id) => ({
    id: { value: id },
    template_id: { value: TEMPLATE_ID },
    path: { value: 'nuevo.pdf' },
    type: { value: 'application/pdf' },
    is_active: { value: true },
    // Not a value object: KnexTemplateAttachmentRepository#save reads `.usage_type` directly
    // (unlike the other fields, which read `.value`). usage_type is NOT NULL in the real schema
    // with a default, but an explicit null bypasses the column default in Postgres, so a real
    // value is required here.
    usage_type: 'attachment',
    created_at: { value: CREATED_AT },
    created_by: { value: CREATED_BY },
});

describe('KnexTemplateAttachmentRepository — reader wiring (Oleada 8)', () => {
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
        repo = new KnexTemplateAttachmentRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexTemplateAttachmentRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('search() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexTemplateAttachmentRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = (await repo.search(stubCriteria)).length;
        const ids = nextIds(2);
        await seed(repo.writer, ids);

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
        repo = new KnexTemplateAttachmentRepository(makeWriterConfig(), makeReaderConfig());
        const [id] = nextIds(1);

        const wrote = await DbRequestContext.run(async () => {
            await repo.save(stubToSave(id));
            return DbRequestContext.hasWritten();
        });
        expect(wrote).toBe(true);
    });
});
