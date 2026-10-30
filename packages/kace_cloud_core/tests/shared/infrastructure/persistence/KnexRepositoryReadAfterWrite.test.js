import { KnexRepository } from '../../../../src/shared/infrastructure/persistence/KnexRepository.js';
import { DbRequestContext } from '../../../../src/shared/infrastructure/context/DbRequestContext.js';
import { knexConfig } from '../../../knexfile.js';

const pgConfig = {
    client: 'pg',
    connection: {},
    schema: '',
};

describe('KnexRepository — read-after-write routing', () => {
    it('reader returns the replica pool before any write', async () => {
        const writerCfg = { ...pgConfig, connection: { host: 'w.example.com' } };
        const readerCfg = { ...pgConfig, connection: { host: 'r.example.com' } };
        const repo = new KnexRepository(writerCfg, 'cases', readerCfg);

        await DbRequestContext.run(async () => {
            expect(repo.reader).not.toBe(repo.writer);
        });

        await repo.destroyConnection();
    });

    it('reader returns the writer pool after markWrite() (read-after-write)', async () => {
        const writerCfg = { ...pgConfig, connection: { host: 'w.example.com' } };
        const readerCfg = { ...pgConfig, connection: { host: 'r.example.com' } };
        const repo = new KnexRepository(writerCfg, 'cases', readerCfg);

        await DbRequestContext.run(async () => {
            DbRequestContext.markWrite();
            expect(repo.reader).toBe(repo.writer);
        });

        await repo.destroyConnection();
    });

    describe('withTransaction', () => {
        const repo = new KnexRepository(knexConfig, 'shift_management');

        afterAll(async () => {
            await repo.destroyConnection();
        });

        it('marks the request as written, so later reads go to the writer', async () => {
            await DbRequestContext.run(async () => {
                await repo.withTransaction(async () => undefined);

                expect(DbRequestContext.hasWritten()).toBe(true);
            });
        });

        it('commits and returns the callback result', async () => {
            await expect(
                repo.withTransaction(async (trx) => (await trx.raw('select 41 + 1 as n')).rows[0].n)
            ).resolves.toBe(42);
        });

        it('rolls back the writes when the callback throws', async () => {
            const failure = new Error('rollback');

            await expect(
                repo.withTransaction(async (trx) => {
                    await trx.raw('create temp table tx_probe (id int) on commit preserve rows');
                    await trx.raw('insert into tx_probe values (1)');
                    throw failure;
                })
            ).rejects.toBe(failure);

            const { rows } = await repo.connection.raw("select to_regclass('pg_temp.tx_probe') as probe");
            expect(rows[0].probe).toBeNull();
        });
    });
});
