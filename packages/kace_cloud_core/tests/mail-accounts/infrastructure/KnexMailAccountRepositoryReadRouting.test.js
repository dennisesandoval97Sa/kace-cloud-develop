import { KnexMailAccountRepository } from '../../../src/mail-accounts/infrastructure/persistence/KnexMailAccountRepository.js';
import { DbRequestContext } from '../../../src/shared/infrastructure/context/DbRequestContext.js';
import { buildReaderConfig, buildWriterConfig } from '../../knexfile.js';
import { watchPools } from '../../support/poolWatcher.js';

const makeWriterConfig = () => ({ ...buildWriterConfig(), pool: { min: 1, max: 1 } });
const makeReaderConfig = () => ({ ...buildReaderConfig(), pool: { min: 1, max: 1 } });

const stubCriteria = { convertToKnex: (qb) => qb };

// The per-file database is cloned once for the whole file (see tests/knexfile.js), not per
// `it()`, so fixture ids must stay unique across every test in this file.
let idSeq = 0;
const nextUuid = () => `00000000-0000-4000-8000-${(idSeq++).toString(16).padStart(12, '0')}`;

// count() (repo override) reads via this.read and returns a scalar (no MailAccount construction,
// which has many value objects). find/search route through the identical facade. save() is a direct
// insert guarded by markWrite. findIdByEmailAccount() (mail-sync worker) stays on the writer by design.
// Uses a baseline delta, not an absolute count: the cloned per-file database is a clone of a
// migrated+seeded template, so mail_accounts may already carry rows before this test inserts.
const seed = async (knex, n) => {
    const rows = Array.from({ length: n }, () => ({ id: nextUuid(), deleted_by: null }));
    if (rows.length) await knex('mail_accounts').insert(rows);
};

describe('KnexMailAccountRepository — reader wiring (Oleada 10)', () => {
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
        repo = new KnexMailAccountRepository(makeWriterConfig(), makeReaderConfig());
        expect(repo.reader).not.toBe(repo.writer);
    });

    it('reuses the writer pool with no reader config (fail-safe)', () => {
        repo = new KnexMailAccountRepository(makeWriterConfig());
        expect(repo.reader).toBe(repo.writer);
    });

    it('count() reads from the replica, then from the writer after a write', async () => {
        repo = new KnexMailAccountRepository(makeWriterConfig(), makeReaderConfig());
        pools = watchPools(repo);
        const baseline = Number(await repo.count(stubCriteria));
        await seed(repo.writer, 2);

        pools.reset();
        expect(Number(await repo.count(stubCriteria))).toBe(baseline + 2);
        expect(pools.lastPool()).toBe('reader');

        const afterWrite = await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            pools.reset();
            return repo.count(stubCriteria);
        });
        expect(pools.lastPool()).toBe('writer');
        expect(Number(afterWrite)).toBe(baseline + 2);
    });

    it('save() marks the request as written', async () => {
        repo = new KnexMailAccountRepository(makeWriterConfig(), makeReaderConfig());
        const stubToSave = {
            id: { value: nextUuid() },
            description: { value: 'd' },
            type: { value: 't' },
            host: { value: 'h' },
            port: { value: 993 },
            protocol: { value: 'imap' },
            encryption: { value: 'ssl' },
            username: { value: 'u' },
            password: { value: 'p' },
            from_address: { value: 'a@x.com' },
            from_name: { value: 'n' },
            tenant_id: { value: null },
            client_id: { value: null },
            client_secret: { value: null },
            code: { value: null },
            refresh_token: { value: null },
            mails_download_limit: { value: null },
            login_endpoint: { value: null },
            graph_scope: { value: null },
            start_syncing_from: { value: null },
            last_synchronization: { value: null },
            folders: { value: [] },
            access_token: { value: null },
            email_account: { value: null },
            vault: { value: null },
            vault_data: { value: {} },
            channel_hub_error: { value: {} },
            is_active: { value: true },
            created_at: { value: null },
            updated_at: { value: null },
            created_by: { value: null },
            updated_by: { value: null },
        };

        const wrote = await DbRequestContext.run(async () => {
            try {
                await repo.save(stubToSave);
            } catch {
                // insert may fail on the minimal schema; markWrite() already fired first.
            }
            return DbRequestContext.hasWritten();
        });
        expect(wrote).toBe(true);
    });
});
