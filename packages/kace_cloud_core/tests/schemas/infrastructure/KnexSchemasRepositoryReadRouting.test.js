import { KnexSchemasRepository } from '../../../src/schemas/infrastructure/persistence/KnexSchemasRepository.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const CREATED_BY = '44444444-4444-4444-8444-444444444444';
const CREATED_AT = '2026-01-01T00:00:00.000Z';

// The per-file database is cloned once for the whole file (see tests/knexfile.js), not per
// `it()`, so fixture ids must stay unique across every test in this file.
let idSeq = 0;
const nextId = (prefix) => `${prefix}-${idSeq++}`;

// aux_definitions.schema_id and "one-script".schema_id are FK-constrained to schemas(id); a real
// parent schemas row is seeded so the relation inserts satisfy that constraint.
const seedSchema = async (knex, id) => {
    await knex('schemas').insert({ id, name: `schema-${id}`, is_active: true });
};

const seedRelations = async (knex, schemaId, { aux, oneScript }) => {
    for (const id of aux) await knex('aux_definitions').insert({ id, schema_id: schemaId });
    for (const id of oneScript) await knex('one-script').insert({ id, schema_id: schemaId });
};

const stubToSave = (id) => ({
    id: { value: id },
    name: { value: 'NEW' },
    is_active: { value: true },
    data_structure: { value: '{}' },
    created_at: { value: CREATED_AT },
    created_by: { value: CREATED_BY },
    updated_at: { value: null },
    updated_by: { value: null },
    deleted_at: { value: null },
    deleted_by: { value: null },
});

// countRelationsBySchemaId() returns a number (no Schema construction) and reads both aux_definitions
// and one-script via this.read — ideal to prove reader routing + read-after-write.
describe('KnexSchemasRepository — reader wiring (Oleada 7 Tier B)', () => {
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
        repo = new KnexSchemasRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexSchemasRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('countRelationsBySchemaId() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexSchemasRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const schemaId = nextId('schema');
        await seedSchema(repo.writer, schemaId);

        expect(await repo.countRelationsBySchemaId({ value: schemaId })).toBe(0);

        await seedRelations(repo.writer, schemaId, { aux: [nextId('aux'), nextId('aux')], oneScript: [nextId('one')] });

        pools.reset();
        expect(await repo.countRelationsBySchemaId({ value: schemaId })).toBe(3);
        expect(pools.lastPool()).toBe('reader');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.countRelationsBySchemaId({ value: schemaId });
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite).toBe(3);
    });

    it('save() marks the request as written', async () => {
        repo = new KnexSchemasRepository(makeWriterConfig(), makeReaderConfig());

        const wrote = await DbRequestContext.run(async () => {
            await repo.save(stubToSave(nextId('schema')));
            return DbRequestContext.hasWritten();
        });
        expect(wrote).toBe(true);
    });
});
