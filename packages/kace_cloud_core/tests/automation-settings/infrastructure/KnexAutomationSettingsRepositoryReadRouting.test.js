import { KnexAutomationSettingsRepository } from '../../../src/automation-settings/infrastructure/persistence/KnexAutomationSettingsRepository.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const CREATED_BY = '44444444-4444-4444-8444-444444444444';
const CREATED_AT = '2026-01-01T00:00:00.000Z';
const CRON = '0 0 * * *';

const stubCriteria = { convertToKnex: (qb) => qb };

let idSeq = 0;
const nextIds = (n) => Array.from({ length: n }, () => `bbbbbbbb-bbbb-4bbb-8bbb-${String(idSeq++).padStart(12, '0')}`);

const row = (id, description) => ({
    id,
    description,
    frequency: CRON,
    start_date: CREATED_AT,
    end_date: CREATED_AT,
    created_at: CREATED_AT,
    created_by: CREATED_BY,
    deleted_at: null,
    deleted_by: null,
});

const seed = async (knex, rows) => {
    if (rows.length) await knex('automation_settings').insert(rows);
};

describe('KnexAutomationSettingsRepository — reader wiring (Oleada 7 Tier B)', () => {
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
        repo = new KnexAutomationSettingsRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexAutomationSettingsRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('find() resolves through the reader pool, then the writer pool after a write', async () => {
        repo = new KnexAutomationSettingsRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const [id] = nextIds(1);
        await seed(repo.writer, [row(id, 'ONLY SETTING')]);

        pools.reset();
        const fromReplica = await repo.find({ value: id });
        expect(pools.lastPool()).toBe('reader');
        expect(fromReplica.description.value).toBe('ONLY SETTING');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.find({ value: id });
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite.description.value).toBe('ONLY SETTING');
    });

    it('search() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexAutomationSettingsRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = (await repo.search(stubCriteria)).length;
        const [idX, idY] = nextIds(2);
        await seed(repo.writer, [row(idX, 'SETTING ONE'), row(idY, 'SETTING TWO')]);

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
        repo = new KnexAutomationSettingsRepository(makeWriterConfig(), makeReaderConfig());
        const [id] = nextIds(1);
        const stubToSave = {
            id: { value: id },
            description: { value: 'NEW SETTING' },
            frequency: { value: CRON },
            start_date: { value: CREATED_AT },
            end_date: { value: CREATED_AT },
            created_at: { value: CREATED_AT },
            created_by: { value: CREATED_BY },
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
