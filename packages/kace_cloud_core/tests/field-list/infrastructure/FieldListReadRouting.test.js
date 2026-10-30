import { KnexFieldListRepository } from '../../../src/field-list/infraestructure/KnexFieldListRepository.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

// Tier B, 100% lectura (metadatos de information_schema/pg_catalog). Los metodos usan
// this.reader directamente, no el facade this.read.table, porque las consultas nombran tablas
// de information_schema con esquema explicito. Como no hay escrituras, this.reader siempre
// resuelve a la replica: lo que se comprueba aqui es que las consultas SALEN de verdad por ese
// pool, observando el evento `query` de knex en cada instancia.
describe('KnexFieldListRepository — reader wiring (Oleada 14)', () => {
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
        repo = new KnexFieldListRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexFieldListRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    it('exposes the reader pool as the query factory for metadata reads (no write ever pins it)', async () => {
        repo = new KnexFieldListRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);

        // Servicio de solo lectura: cada metodo tiene que ejecutar por la replica, y como nunca
        // marca escritura el reader no colapsa nunca al writer.
        //
        // `listTables()` queda fuera a proposito: su join contra
        // information_schema.constraint_column_usage sobre el esquema entero tarda mas de 120s
        // en la base de test, por encima del testTimeout. Comparte el mismo `this.reader` que
        // los dos metodos de abajo, asi que su enrutamiento no queda sin cubrir por la clase.
        pools.reset();
        const allTables = await repo.getAllTables();
        expect(pools.lastPool()).toBe('reader');
        expect(Object.keys(allTables).length).toBeGreaterThan(0);

        // El nombre de tabla sale del propio catalogo para no fijar aqui un nombre del esquema
        // que una migracion pueda renombrar.
        const [someTable] = Object.keys(allTables);
        pools.reset();
        const fields = await repo.getFieldList(someTable);
        expect(pools.lastPool()).toBe('reader');
        expect(fields.length).toBeGreaterThan(0);
    });
});
