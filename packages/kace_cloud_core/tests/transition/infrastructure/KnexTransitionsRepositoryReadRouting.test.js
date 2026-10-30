import { KnexTransitionsRepository } from '../../../src/transition/infrastructure/persistance/KnexTransitionsRepository.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const ID = '11111111-1111-4111-8111-111111111111';
const CREATED_BY = '44444444-4444-4444-8444-444444444444';
const CREATED_AT = '2026-01-01T00:00:00.000Z';

// Only save() is a direct write here (update goes through super.update). search() is the routed read;
// find()/findByStateId() stay on the writer by design (EntityCache + state delete write-flow).
// estado_actual_id/siguiente_estado_id/flujo_id/rule_id are FK-constrained in the real schema and
// nullable, so they're left null here rather than seeding parent rows this test doesn't otherwise need.
const stubToSave = {
    id: { value: ID },
    estado_actual_id: { value: null },
    siguiente_estado_id: { value: null },
    flujo_id: { value: null },
    status: { value: 1 },
    created_at: { value: CREATED_AT },
    created_by: { value: CREATED_BY },
    ans_id: { value: null },
    is_visible: { value: true },
    rule_id: { value: null },
};

describe('KnexTransitionsRepository — reader wiring (Oleada 8)', () => {
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
        repo = new KnexTransitionsRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexTransitionsRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // El comentario de arriba dice que search() es la lectura enrutada, pero el archivo no lo
    // ejercitaba: se comprueba mirando en que instancia de knex se emitio la consulta. No hacen
    // falta fixtures, basta con que la consulta salga por el pool correcto.
    it('search() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexTransitionsRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const noopCriteria = { convertToKnex: (qb) => qb };

        pools.reset();
        await repo.search(noopCriteria);
        expect(pools.lastPool()).toBe('reader');

        await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            await repo.search(noopCriteria);
        });
        expect(pools.lastPool()).toBe('writer');
    });

    it('save() marks the request as written', async () => {
        repo = new KnexTransitionsRepository(makeWriterConfig(), makeReaderConfig());

        const wrote = await DbRequestContext.run(async () => {
            await repo.save(stubToSave);
            return DbRequestContext.hasWritten();
        });
        expect(wrote).toBe(true);
    });
});
