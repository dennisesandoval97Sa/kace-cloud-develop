import { KnexAuxDefinitionsRepository } from '../../../src/aux_definitions/infrastructure/persitance/KnexAuxDefinitionsRepository.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const CREATED_BY = '44444444-4444-4444-8444-444444444444';
const CREATED_AT = '2026-01-01T00:00:00.000Z';

// search() distinguishes reader vs writer by row count (no distinguishing value has to survive the
// AuxDefinition value objects). DDL (createTables/hasTable) stays on the writer and is not tested here.
const stubCriteria = { convertToKnex: (qb) => qb };

let idSeq = 0;
const nextIds = (n) => Array.from({ length: n }, () => `cccccccc-cccc-4ccc-8ccc-${String(idSeq++).padStart(12, '0')}`);

// aux_definitions.schema_id/restflow_id are FK-constrained (schemas, ws_rest_flows) AND, unlike
// most FK columns here, are read back through AuxDefinition's ValueObjectUuid, which rejects
// null — so real parent rows must be seeded and referenced on every insert.
const seedParents = async (knex, schemaId, restflowId) => {
    await knex('schemas').insert({ id: schemaId });
    await knex('ws_rest_flows').insert({ id: restflowId });
};

const seed = async (knex, n) => {
    const [schemaId] = nextIds(1);
    const [restflowId] = nextIds(1);
    await seedParents(knex, schemaId, restflowId);
    const ids = nextIds(n);
    for (const [i, id] of ids.entries()) {
        await knex('aux_definitions').insert({
            id,
            name: `auxdef${i}`,
            tablename: `aux_table_${id.slice(-8)}`,
            logs_tablename: `aux_table_${id.slice(-8)}_logs`,
            schema_id: schemaId,
            restflow_id: restflowId,
            is_active: true,
            created_at: CREATED_AT,
            created_by: CREATED_BY,
            updated_at: null,
            updated_by: null,
            deleted_at: null,
            deleted_by: null,
        });
    }
};

describe('KnexAuxDefinitionsRepository — reader wiring (Oleada 7 Tier B)', () => {
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
        repo = new KnexAuxDefinitionsRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexAuxDefinitionsRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('search() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexAuxDefinitionsRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = (await repo.search(stubCriteria)).length;
        await seed(repo.writer, 2);

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
        repo = new KnexAuxDefinitionsRepository(makeWriterConfig(), makeReaderConfig());
        const [schemaId] = nextIds(1);
        const [restflowId] = nextIds(1);
        await repo.writer('schemas').insert({ id: schemaId });
        await repo.writer('ws_rest_flows').insert({ id: restflowId });
        const [id] = nextIds(1);
        const stubToSave = {
            id: { value: id },
            name: { value: 'auxnew' },
            tablename: { value: `aux_new_${id.slice(-8)}` },
            logs_tablename: { value: `aux_new_${id.slice(-8)}_logs` },
            schema_id: { value: schemaId },
            restflow_id: { value: restflowId },
            is_active: { value: true },
            created_at: { value: CREATED_AT },
            created_by: { value: CREATED_BY },
            updated_at: { value: null },
            updated_by: { value: null },
            deleted_at: { value: null },
            deleted_by: { value: null },
        };

        const wrote = await DbRequestContext.run(async () => {
            await repo.save(stubToSave);
            return DbRequestContext.hasWritten();
        });
        expect(wrote).toBe(true);
    });
});
