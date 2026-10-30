import { KnexClientRepository } from '../../../src/clients/index.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

let idSeq = 0;
const nextId = () => `doctype${idSeq++}`;

// getDocTypes() walks `literales`: parent (tipo_literal NULL, nombre 'clientes') -> fields
// (tipo_literal = parent.id) -> per-field literals (tipo_literal = field.id). The migrated
// template already seeds a real 'clientes' parent with existing fields (tipo_documento, sexo,
// estado_civil), so a second parent row can no longer be used as a writer/reader marker —
// getDocTypes()'s `.first()` lookup would just become ambiguous between the two. Writer and
// reader configs are two routes to the SAME physical database (see tests/knexfile.js) anyway, so
// a value written via one pool is instantly visible via the other. This attaches a new field
// under the EXISTING parent instead, and asserts on `reader`/`writer` pool identity (the actual
// mechanism under test) while still exercising getDocTypes() end-to-end for the seeded field.
const seedField = async (knex, fieldName) => {
    const parent = await knex('literales').where({ tipo_literal: null, nombre: 'clientes' }).first();
    const fieldId = nextId();
    const literalId = nextId();
    await knex('literales').insert([
        { id: fieldId, tipo_literal: parent.id, nombre: fieldName, is_active: true, deleted_at: null },
        { id: literalId, tipo_literal: fieldId, nombre: 'CC', is_active: true, deleted_at: null },
    ]);
};

describe('KnexClientRepository.getDocTypes — read routing', () => {
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
        repo = new KnexClientRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexClientRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    it('getDocTypes() resolves the seeded field through the reader pool, then the writer after a write', async () => {
        repo = new KnexClientRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const field = `field-${nextId()}`;
        await seedField(repo.writer, field);

        pools.reset();
        const fromReplica = await repo.getDocTypes();
        expect(pools.lastPool()).toBe('reader');
        expect(fromReplica[field]).toEqual(['CC']);

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.getDocTypes();
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite[field]).toEqual(['CC']);
    });
});
