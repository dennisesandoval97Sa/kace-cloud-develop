import { KnexInteractionRepository } from '../../../src/interactions/infrastructure/persistence/KnexInteractionRepository.js';
import { KnexAssociateInteractionToCasoRepo } from '../../../src/interactions/infrastructure/persistence/KnexAssociateInteractionToCasoRepo.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const stubCriteria = { convertToKnex: (qb) => qb };
const ADMIN_SEARCH_MARKER = 'admin-active-workspace-routing';
const adminSearchCriteria = {
    convertToKnex: (qb) => qb.where('interactions.description', ADMIN_SEARCH_MARKER),
};
const countFromRow = (row) => Number(Object.values(row)[0]);

// The per-file database is cloned once for the whole file (see tests/knexfile.js), not per
// `it()`, so fixture ids must stay unique across every test in this file, and shared across the
// two describe blocks below.
let idSeq = 0;
const nextUuid = () => `00000000-0000-4000-8000-${(idSeq++).toString(16).padStart(12, '0')}`;

const markWriteOnCall = async (repo, method, arg) =>
    DbRequestContext.run(async () => {
        try {
            await repo[method](arg);
        } catch {
            // markWrite() fired before the DB op.
        }
        return DbRequestContext.hasWritten();
    });

describe('KnexInteractionRepository — reader wiring (Oleada 11 Tier C)', () => {
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

    const seed = async (knex, n) => {
        const rows = Array.from({ length: n }, () => ({ id: nextUuid(), channel_id: nextUuid(), deleted_at: null }));
        if (rows.length) await knex('interactions').insert(rows);
    };

    const seedAdminEligible = async (knex, n) => {
        const rows = [];
        for (let i = 0; i < n; i++) {
            const workspaceId = nextUuid();
            await knex('workspaces').insert({
                id: workspaceId,
                is_active: true,
                deleted_at: null,
                deleted_by: null,
            });
            rows.push({
                id: nextUuid(),
                channel_id: 'email',
                client_identifier: nextUuid(),
                external_identifier: nextUuid(),
                description: ADMIN_SEARCH_MARKER,
                priority: 'normal',
                workspace_id: workspaceId,
                email_id: null,
                start_review_at: null,
                start_review_by: null,
                conversation_id: nextUuid(),
                receipt_at: new Date().toISOString(),
                closed_at: null,
                closed_by: null,
                is_closed: false,
                in_review: false,
                is_migrated: false,
                created_at: new Date().toISOString(),
                created_by: nextUuid(),
                deleted_at: null,
                deleted_by: null,
            });
        }
        if (rows.length) await knex('interactions').insert(rows);
    };

    it('opens a separate reader pool with a distinct reader config', () => {
        repo = new KnexInteractionRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexInteractionRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    // Writer y reader apuntan a la MISMA base fisica (ver tests/knexfile.js), asi que los datos
    // ya no distinguen que pool sirvio una lectura. Lo que si la distingue es el evento `query`
    // de knex, que se emite en la instancia que ejecuta: `watchPools` lo engancha en ambos pools
    // y la asercion pasa a ser "esta lectura la ejecuto el reader", que muere si el enrutamiento
    // se apaga en el origen.
    it('count() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexInteractionRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = countFromRow(await repo.count(stubCriteria));
        await seed(repo.writer, 2);

        pools.reset();
        expect(countFromRow(await repo.count(stubCriteria))).toBe(baseline + 2);
        expect(pools.lastPool()).toBe('reader');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.count(stubCriteria);
        });
        expect(pools.lastPool()).toBe('writer');
        expect(countFromRow(afterWrite)).toBe(baseline + 2);
    });

    it('searchForAdminActiveWorkspaces() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexInteractionRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = (await repo.searchForAdminActiveWorkspaces(adminSearchCriteria)).length;
        await seedAdminEligible(repo.writer, 2);

        pools.reset();
        expect(await repo.searchForAdminActiveWorkspaces(adminSearchCriteria)).toHaveLength(baseline + 2);
        expect(pools.lastPool()).toBe('reader');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.searchForAdminActiveWorkspaces(adminSearchCriteria);
        });
        expect(pools.lastPool()).toBe('writer');
        expect(afterWrite).toHaveLength(baseline + 2);
    });

    it('countForAdminActiveWorkspaces() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexInteractionRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = countFromRow(await repo.countForAdminActiveWorkspaces(adminSearchCriteria));
        await seedAdminEligible(repo.writer, 2);

        pools.reset();
        expect(countFromRow(await repo.countForAdminActiveWorkspaces(adminSearchCriteria))).toBe(baseline + 2);
        expect(pools.lastPool()).toBe('reader');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.countForAdminActiveWorkspaces(adminSearchCriteria);
        });
        expect(pools.lastPool()).toBe('writer');
        expect(countFromRow(afterWrite)).toBe(baseline + 2);
    });

    it('save() marks the request as written', async () => {
        repo = new KnexInteractionRepository(makeWriterConfig(), makeReaderConfig());
        expect(await markWriteOnCall(repo, 'save', { id: { value: nextUuid() } })).toBe(true);
    });
});

describe('KnexAssociateInteractionToCasoRepo — reader wiring (Oleada 11 Tier C)', () => {
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

    // search() returns raw pivot rows (no aggregate construction) and reads via this.read.
    // interaction_casos.interaction_id/caso_id are FK-constrained (interactions, cases); real
    // parent rows are seeded so the pivot inserts satisfy those constraints.
    const seedParents = async (knex, ids) => {
        for (const id of ids) {
            await knex('interactions').insert({ id, channel_id: nextUuid() });
            await knex('cases').insert({ id });
        }
    };

    const seed = async (knex, n) => {
        const rows = [];
        for (let i = 0; i < n; i++) {
            const id = nextUuid();
            await seedParents(knex, [id]);
            rows.push({ interaction_id: id, caso_id: id, deleted_by: null });
        }
        if (rows.length) await knex('interaction_casos').insert(rows);
    };

    it('search() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexAssociateInteractionToCasoRepo(makeWriterConfig(), makeReaderConfig());
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

    it('save() marks the request as written (direct pivot insert, no history table)', async () => {
        repo = new KnexAssociateInteractionToCasoRepo(makeWriterConfig(), makeReaderConfig());
        const id = nextUuid();
        await seedParents(repo.writer, [id]);
        const wrote = await markWriteOnCall(repo, 'save', {
            interaction_id: id,
            caso_id: id,
            created_by: 'z',
            created_at: null,
        });
        expect(wrote).toBe(true);
    });
});
