import { KnexCustomListsRepository } from '../../../src/custom-lists/infrastructure/persistence/KnexCustomListsRepository.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

let idSeq = 0;
const nextId = () => `11111111-1111-4111-8111-11111111${String(idSeq++).padStart(4, '0')}`;
const CREATED_BY = '44444444-4444-4444-8444-444444444444';
const CREATED_AT = '2026-01-01T00:00:00.000Z';

const row = (id, name) => ({
    id,
    name,
    is_active: true,
    aux_entity: 'cases',
    created_at: CREATED_AT,
    created_by: CREATED_BY,
    updated_at: null,
    updated_by: null,
    deleted_at: null,
    deleted_by: null,
});

const seed = async (knex, rows) => {
    if (rows.length) await knex('custom_lists').insert(rows);
};

describe('KnexCustomListsRepository — reader wiring (Oleada 7 Tier B)', () => {
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
        repo = new KnexCustomListsRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexCustomListsRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('findById() reads through the resolved reader pool, then the writer after a write', async () => {
        repo = new KnexCustomListsRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const id = nextId();
        await seed(repo.writer, [row(id, 'SEEDED')]);

        pools.reset();
        const fromReplica = await repo.findById(id);
        expect(pools.lastPool()).toBe('reader');
        expect(fromReplica.name).toBe('SEEDED');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.findById(id);
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite.name).toBe('SEEDED');
    });

    it('save() marks the request as written', async () => {
        repo = new KnexCustomListsRepository(makeWriterConfig(), makeReaderConfig());
        const id = nextId();
        const stubToSave = {
            id,
            name: 'NEW',
            is_active: true,
            aux_entity: 'cases',
            created_at: CREATED_AT,
            created_by: CREATED_BY,
            aux_items: [],
            groups: [],
        };

        const wrote = await DbRequestContext.run(async () => {
            await repo.save(stubToSave);
            return DbRequestContext.hasWritten();
        });
        expect(wrote).toBe(true);
    });

    it('update() marks the request as written', async () => {
        repo = new KnexCustomListsRepository(makeWriterConfig(), makeReaderConfig());
        const id = nextId();
        await seed(repo.writer, [row(id, 'WRITER')]);

        const wrote = await DbRequestContext.run(async () => {
            await repo.update({ id: { value: id }, getchangedAttributes: () => ({ name: 'CHANGED' }) });
            return DbRequestContext.hasWritten();
        });
        expect(wrote).toBe(true);
    });
});
