import { KnexWorkspacesRepository } from '../../../src/workspaces/infrastructure/persistence/KnexWorkspacesRepository.js';
import { Criteria } from '../../../src/shared/criteria/Criteria.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const buildCriteria = () => new Criteria(undefined, undefined, null, 0, null, 'workspaces');

const countValue = (row) => Number(Object.values(row)[0]);

// The per-file database is cloned once for the whole file (see tests/knexfile.js), not per
// `it()`, so fixture ids must stay unique across every test in this file.
let idSeq = 0;
const nextUUIDs = (n) =>
    Array.from({ length: n }, () => `5${String(idSeq++).padStart(7, '0')}-5555-4555-8555-555555555555`);

const CREATED_BY = '59999999-5555-4555-8555-555555555555';

const seedWorkspaces = async (knex, ids) => {
    for (const id of ids) {
        await knex('workspaces').insert({
            id,
            description: `workspace-${id}`,
            is_active: true,
            tag: `tag-${id}`,
            rules: null,
            mails_accounts: null,
            created_at: new Date().toISOString(),
            updated_at: null,
            deleted_at: null,
            created_by: CREATED_BY,
            updated_by: null,
            deleted_by: null,
        });
    }
};

// Tier C: workspaces admin CRUD → list reads (search/count) route to the replica,
// while find() (shared by actionRead AND the read-before-write / uniqueness guard in
// WorkspaceUpdater/WorkspaceDeleter) stays on the writer.
describe('KnexWorkspacesRepository — reader wiring (Oleada 16)', () => {
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
        repo = new KnexWorkspacesRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexWorkspacesRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('search() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexWorkspacesRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = (await repo.search(buildCriteria())).length;
        const ids = nextUUIDs(3);
        await seedWorkspaces(repo.writer, ids);

        pools.reset();
        expect(await repo.search(buildCriteria())).toHaveLength(baseline + 3);
        // OJO: search() NO va entera por la replica. La consulta principal y las relaciones de
        // mails_accounts y de grupos salen por `this.read` (reader), pero las relaciones de
        // channel_hub las lee `this.table()`, que es el writer. Por eso se afirma sobre la
        // PRIMERA consulta -la lectura principal- y no sobre la ultima: `lastPool()` seria el
        // writer aun con el enrutamiento intacto. Si algun dia se quiere search() 100% replica,
        // hay que cambiar esa consulta en KnexWorkspacesRepository#search.
        expect(pools.pools()[0]).toBe('reader');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.search(buildCriteria());
        });
        // Tras la escritura ninguna consulta de search() puede salir por la replica.
        expect(pools.pools()).not.toContain('reader');
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite).toHaveLength(baseline + 3);
    });

    it('count() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexWorkspacesRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = countValue(await repo.count(buildCriteria()));
        const ids = nextUUIDs(3);
        await seedWorkspaces(repo.writer, ids);

        pools.reset();
        expect(countValue(await repo.count(buildCriteria()))).toBe(baseline + 3);
        expect(pools.lastPool()).toBe('reader');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.count(buildCriteria());
        });
        expect(pools.lastPool()).toBe('writer');
        expect(countValue(afterWrite)).toBe(baseline + 3);
    });

    // find() lee siempre por this.table(), nunca por this.read: lo comparten actionRead y el
    // read-before-write / guarda de unicidad de WorkspaceUpdater y WorkspaceDeleter, y servirlo
    // desde la replica podria decidir sobre una version anterior de la fila. La garantia es que
    // el pool observado sea el writer AUNQUE haya reader configurado.
    it('find() stays on the writer even with a reader configured', async () => {
        repo = new KnexWorkspacesRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const [id] = nextUUIDs(1);
        await seedWorkspaces(repo.writer, [id]);

        pools.reset();
        const workspace = await repo.find({ value: id });

        expect(pools.pools()).not.toContain('reader');
        expect(pools.lastPool()).toBe('writer');
        expect(workspace).not.toBeNull();
        expect(workspace.id.value).toBe(id);
    });

    it('save() marks the request as written so subsequent reads fall to the writer', async () => {
        repo = new KnexWorkspacesRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = countValue(await repo.count(buildCriteria()));
        const [id, createdBy] = nextUUIDs(2);

        const afterWrite = await DbRequestContext.run(async () => {
            await repo.save({
                id: { value: id },
                description: { value: 'workspace-created' },
                is_active: { value: true },
                tag: { value: 'created-tag' },
                rules: { value: null },
                tag_creation_flow_id: { value: null },
                tag_update_flow_id: { value: null },
                tag_deletion_flow_id: { value: null },
                created_by: { value: createdBy },
                created_at: { value: new Date().toISOString() },
            });
            expect(DbRequestContext.hasWritten()).toBe(true);
            pools.reset();
            return repo.count(buildCriteria());
        });
        expect(pools.lastPool()).toBe('writer');
        expect(countValue(afterWrite)).toBe(baseline + 1);
    });

    it('update() marks the request as written so subsequent reads fall to the writer', async () => {
        repo = new KnexWorkspacesRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const [id] = nextUUIDs(1);
        await seedWorkspaces(repo.writer, [id]);
        const baseline = countValue(await repo.count(buildCriteria()));

        const afterWrite = await DbRequestContext.run(async () => {
            await repo.update({
                id: { value: id },
                changedAttributes: {
                    description: 'updated-desc',
                    is_active: true,
                    tag: 'updated-tag',
                    rules: null,
                    updated_at: new Date().toISOString(),
                    updated_by: CREATED_BY,
                    deleted_at: null,
                    deleted_by: null,
                },
            });
            expect(DbRequestContext.hasWritten()).toBe(true);
            pools.reset();
            return repo.count(buildCriteria());
        });
        // El count no cambia con un update -por eso comparar con `baseline` no probaria nada-:
        // lo que hay que comprobar es QUE POOL sirvio esa lectura posterior a la escritura, y
        // que el update aterrizo de verdad en la fila.
        expect(pools.lastPool()).toBe('writer');
        expect(countValue(afterWrite)).toBe(baseline);

        const [row] = await repo.writer('workspaces').where({ id }).select('description', 'tag');
        expect(row.description).toBe('updated-desc');
        expect(row.tag).toBe('updated-tag');
    });
});
