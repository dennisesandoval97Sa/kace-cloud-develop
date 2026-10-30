import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { jest } from '@jest/globals';

const caseRepoArgs = { value: undefined };

const casesBarrel = readFileSync(
    fileURLToPath(new URL('../../../../packages/kace_cloud_core/src/cases/index.js', import.meta.url)),
    'utf8'
);
const casesExportNames = [...casesBarrel.matchAll(/^export\s+\{([^}]+)\}/gm)].map((match) => {
    const [exported, alias] = match[1].split(/\s+as\s+/);
    return (alias ?? exported).trim();
});

jest.unstable_mockModule('@kace/core/src/cases/index.js', () => {
    const mod = {};
    for (const name of casesExportNames) {
        mod[name] = jest.fn();
    }
    mod.KnexCaseRepository = jest.fn(function (...args) {
        caseRepoArgs.value = args;
        this.connection = () => this.connection;
        this.connection.client = { config: { client: 'pg' }, on: () => {} };
        this.qualifiedName = (n) => n;
        this.destroyConnection = jest.fn(async () => {});
    });
    mod.ConfiguredViewCaseRepositoryFactory = jest.fn(function (...args) {
        this.create = jest.fn(async () => ({ destroyConnection: jest.fn(async () => {}) }));
    });
    return mod;
});

const { Controller } = await import('../src/controller.mjs');

const baseEvent = (knexConfig, readerConfig) => ({
    resource: '/{id}',
    httpMethod: 'GET',
    headers: {},
    requestContext: { http: { method: 'GET' } },
    tenantContext: {
        tenant: {
            aws_cognito_user_pool_id: { value: 'us-east-1_abcd1234' },
            aws_cognito_app_client_id: { value: 'client123' },
            id: { value: 't' },
        },
        knexConfig,
        readerConfig,
    },
});

describe('case-count-by-group Controller — reader config wiring', () => {
    it('builds KnexCaseRepository from writer + reader config objects (not the instance)', () => {
        const knexConfig = { client: 'pg', connection: { host: 'writer.local' }, schema: 's' };
        const readerConfig = { client: 'pg', connection: { host: 'reader.local' }, schema: 's' };

        const controller = new Controller(baseEvent(knexConfig, readerConfig), knexConfig, readerConfig);

        expect(caseRepoArgs.value[0]).toBe(knexConfig);
        expect(caseRepoArgs.value[1]).toEqual(expect.objectContaining({ connection: { host: 'reader.local' } }));
        expect(typeof caseRepoArgs.value[0]).not.toBe('function');
    });

    it('destroyDbConnection() destroys the constructor-built repository', async () => {
        const knexConfig = { client: 'pg', connection: { host: 'writer.local' }, schema: 's' };
        const readerConfig = { client: 'pg', connection: { host: 'reader.local' }, schema: 's' };
        caseRepoArgs.value = undefined;

        const controller = new Controller(baseEvent(knexConfig, readerConfig), knexConfig, readerConfig);

        const repoDestroyFn = controller.repository.destroyConnection;
        await controller.destroyDbConnection();

        expect(repoDestroyFn).toHaveBeenCalledTimes(1);
    });
});
