import { KnexRepository } from '../../../../src/shared/infrastructure/persistence/KnexRepository.js';

const pgConfig = {
    client: 'pg',
    connection: {},
    schema: '',
};

describe('KnexRepository — dual writer/reader connections', () => {
    it('writer equals connection (back-compat)', () => {
        const repo = new KnexRepository(pgConfig, 'cases');

        expect(repo.writer).toBe(repo.connection);

        return repo.destroyConnection();
    });

    it('reuses a single pool when no readerConfig is provided', () => {
        const repo = new KnexRepository(pgConfig, 'cases');

        expect(repo.reader).toBe(repo.writer);

        return repo.destroyConnection();
    });

    it('reuses a single pool when reader host equals writer host', () => {
        const writerCfg = { ...pgConfig, connection: { host: 'same.example.com' } };
        const readerCfg = { ...pgConfig, connection: { host: 'same.example.com' } };
        const repo = new KnexRepository(writerCfg, 'cases', readerCfg);

        expect(repo.reader).toBe(repo.writer);

        return repo.destroyConnection();
    });

    it('opens a second pool when reader host differs from writer host', () => {
        const writerCfg = { ...pgConfig, connection: { host: 'writer.example.com' } };
        const readerCfg = { ...pgConfig, connection: { host: 'reader.example.com' } };
        const repo = new KnexRepository(writerCfg, 'cases', readerCfg);

        expect(repo.reader).not.toBe(repo.writer);

        return repo.destroyConnection();
    });
});
