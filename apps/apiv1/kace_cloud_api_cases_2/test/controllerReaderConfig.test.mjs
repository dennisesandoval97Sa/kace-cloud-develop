import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { jest } from '@jest/globals';

const caseRepoArgs = { value: undefined };
const viewFactoryArgs = { value: undefined };

const casesBarrel = readFileSync(
    fileURLToPath(new URL('../../../../packages/kace_cloud_core/src/cases/index.js', import.meta.url)),
    'utf8'
);
const casesExportNames = [...casesBarrel.matchAll(/^export\s+\{([^}]+)\}/gm)].map((match) => {
    const [exported, alias] = match[1].split(/\s+as\s+/);
    return (alias ?? exported).trim();
});

jest.unstable_mockModule('@kace/core/src/cases', () => {
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
        viewFactoryArgs.value = args;
        this.create = jest.fn(async () => ({ destroyConnection: jest.fn(async () => {}) }));
    });
    return mod;
});

/*
 * The remaining @kace/core imports the Controller pulls in are stubbed minimally; extend as
 * the import graph requires (the test only needs the constructor to run far enough to build the repo).
 */
const { Controller } = await import('../src/controller.mjs');
const { ViewController } = await import('../src/caseViewController.mjs');
const { VisibleController } = await import('../src/caseVisibleController.mjs');

const baseEvent = (knexConfig, readerConfig) => ({
    resource: '/search',
    httpMethod: 'POST',
    headers: {},
    requestContext: { http: { method: 'POST' } },
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

describe('cases Controller — reader config wiring', () => {
    it('builds KnexCaseRepository from writer + reader config objects (not the instance)', () => {
        const knexConfig = { client: 'pg', connection: { host: 'writer.local' }, schema: 's' };
        const readerConfig = { client: 'pg', connection: { host: 'reader.local' }, schema: 's' };

        const controller = new Controller(baseEvent(knexConfig, readerConfig), knexConfig, readerConfig);

        expect(controller).toBeInstanceOf(Controller);
        expect(caseRepoArgs.value[0]).toBe(knexConfig);
        expect(caseRepoArgs.value[1]).toEqual(expect.objectContaining({ connection: { host: 'reader.local' } }));
        expect(typeof caseRepoArgs.value[0]).not.toBe('function');
    });

    it('VisibleController builds KnexCaseRepository from writer + reader config objects (not the instance)', () => {
        const knexConfig = { client: 'pg', connection: { host: 'writer.local' }, schema: 's' };
        const readerConfig = { client: 'pg', connection: { host: 'reader.local' }, schema: 's' };
        caseRepoArgs.value = undefined;

        const controller = new VisibleController(baseEvent(knexConfig, readerConfig), knexConfig, readerConfig);

        expect(controller).toBeInstanceOf(VisibleController);
        expect(caseRepoArgs.value[0]).toBe(knexConfig);
        expect(caseRepoArgs.value[1]).toEqual(expect.objectContaining({ connection: { host: 'reader.local' } }));
        expect(typeof caseRepoArgs.value[0]).not.toBe('function');
    });

    it('VisibleController.destroyDbConnection() destroys the constructor-built repository', async () => {
        const knexConfig = { client: 'pg', connection: { host: 'writer.local' }, schema: 's' };
        const readerConfig = { client: 'pg', connection: { host: 'reader.local' }, schema: 's' };
        caseRepoArgs.value = undefined;

        const controller = new VisibleController(baseEvent(knexConfig, readerConfig), knexConfig, readerConfig);

        // controller.repository is the mock KnexCaseRepository instance
        const repoDestroyFn = controller.repository.destroyConnection;
        await controller.destroyDbConnection();

        expect(repoDestroyFn).toHaveBeenCalledTimes(1);
    });

    it('ViewController hands writer + reader config objects to the view repository factory', () => {
        const knexConfig = { client: 'pg', connection: { host: 'writer.local' }, schema: 's' };
        const readerConfig = { client: 'pg', connection: { host: 'reader.local' }, schema: 's' };
        viewFactoryArgs.value = undefined;

        const controller = new ViewController(baseEvent(knexConfig, readerConfig), knexConfig, readerConfig);

        expect(viewFactoryArgs.value[0]).toBe(controller.database_connection);
        expect(viewFactoryArgs.value[1]).toEqual(
            expect.objectContaining({
                knexConfig,
                readerConfig: expect.objectContaining({ connection: { host: 'reader.local' } }),
            })
        );
    });

    it('ViewController.destroyDbConnection() does not throw when the view repository has not been built yet', async () => {
        const knexConfig = { client: 'pg', connection: { host: 'writer.local' }, schema: 's' };
        const readerConfig = { client: 'pg', connection: { host: 'reader.local' }, schema: 's' };
        viewFactoryArgs.value = undefined;

        const controller = new ViewController(baseEvent(knexConfig, readerConfig), knexConfig, readerConfig);

        // #repository is null (no action has been dispatched), null-guard must not throw
        await expect(controller.destroyDbConnection()).resolves.toBeUndefined();
    });
});
