import { KnexTemplatesRepository } from '../../../src/templates/infrastructure/persistence/KnexTemplatesRepository.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const CREATED_BY = '44444444-4444-4444-8444-444444444444';
const CREATED_AT = '2026-01-01T00:00:00.000Z';

// The per-file database is cloned once for the whole file (see tests/knexfile.js), not per
// `it()`, so fixture ids/descripciones must stay unique across every test in this file
// (plantillas.descripcion is UNIQUE and NOT NULL in the real schema).
let idSeq = 0;
const nextIds = (n) => Array.from({ length: n }, () => `tpl-${idSeq++}`);

// count() reads via this.read and returns a scalar (no Template value-object construction, which is
// heavy) — ideal to prove reader routing + read-after-write. find/search route via the same facade.
const seed = async (knex, ids) => {
    for (const id of ids) await knex('plantillas').insert({ id, descripcion: `desc-${id}`, deleted_by: null });
};

const stubToSave = (id) => ({
    id: { value: id },
    descripcion: { value: `desc-${id}` },
    ruta: { value: 'ruta' },
    tipo: { value: 1 },
    destinatario: { value: 'to@x.com' },
    copia: { value: '' },
    copia_oculta: { value: '' },
    asunto: { value: 'asunto' },
    cuerpo: { value: 'cuerpo' },
    incluye_adjuntos: { value: false },
    enviar_adjuntos_del_caso: { value: false },
    status: { value: 1 },
    created_at: { value: CREATED_AT },
    updated_at: { value: null },
    created_by: { value: CREATED_BY },
    updated_by: { value: null },
});

describe('KnexTemplatesRepository — reader wiring (Oleada 8)', () => {
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
        repo = new KnexTemplatesRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexTemplatesRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('count() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexTemplatesRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = Number(await repo.count({ convertToKnex: (qb) => qb }));
        const ids = nextIds(2);
        await seed(repo.writer, ids);

        pools.reset();
        expect(Number(await repo.count({ convertToKnex: (qb) => qb }))).toBe(baseline + 2);
        expect(pools.lastPool()).toBe('reader');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.count({ convertToKnex: (qb) => qb });
        });
        expect(pools.lastPool()).toBe('writer');
        expect(Number(afterWrite)).toBe(baseline + 2);
    });

    it('save() marks the request as written', async () => {
        repo = new KnexTemplatesRepository(makeWriterConfig(), makeReaderConfig());
        const [id] = nextIds(1);

        const wrote = await DbRequestContext.run(async () => {
            await repo.save(stubToSave(id));
            return DbRequestContext.hasWritten();
        });
        expect(wrote).toBe(true);
    });

    it('update() marks the request as written', async () => {
        repo = new KnexTemplatesRepository(makeWriterConfig(), makeReaderConfig());
        const [id] = nextIds(1);
        await seed(repo.writer, [id]);

        const wrote = await DbRequestContext.run(async () => {
            await repo.update({ changedAttributes: { descripcion: `desc-${id}-x` }, id: { value: id } });
            return DbRequestContext.hasWritten();
        });
        expect(wrote).toBe(true);
    });

    it('delete() marks the request as written', async () => {
        repo = new KnexTemplatesRepository(makeWriterConfig(), makeReaderConfig());
        const [id] = nextIds(1);
        await seed(repo.writer, [id]);

        const wrote = await DbRequestContext.run(async () => {
            await repo.delete({ changedAttributes: { deleted_by: 'x' }, id: { value: id } });
            return DbRequestContext.hasWritten();
        });
        expect(wrote).toBe(true);
    });
});
