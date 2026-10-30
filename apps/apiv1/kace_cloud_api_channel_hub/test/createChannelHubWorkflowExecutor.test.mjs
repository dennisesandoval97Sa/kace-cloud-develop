import { describe, expect, it } from '@jest/globals';
import { ChannelHubWorkflowExecutorFactory } from '../src/createChannelHubWorkflowExecutor.mjs';

const calls = [];

class RepositoryFake {
    constructor(writerConfig, readerConfig) {
        this.writerConfig = writerConfig;
        this.readerConfig = readerConfig;
        this.destroyCalls = 0;
    }

    async destroyConnection() {
        this.destroyCalls += 1;
    }
}

class WorkflowExecutorFake {
    constructor(...arguments_) {
        calls.push(arguments_);
    }
}

describe('ChannelHubWorkflowExecutorFactory', () => {
    it('uses tenant configs, a bounded timeout, and exposes cleanup for every owned pool', async () => {
        const writerConfig = { client: 'pg', connection: { host: 'writer' } };
        const readerConfig = { client: 'pg', connection: { host: 'reader' } };
        const authenticatedUser = { id: { value: 'user-id' } };
        const factory = new ChannelHubWorkflowExecutorFactory({
            WorkflowExecutorClass: WorkflowExecutorFake,
            WorkflowStepRepositoryClass: RepositoryFake,
            AllowedConnectionsRepositoryClass: RepositoryFake,
            SecretsVaultRepositoryClass: RepositoryFake,
        });

        const executor = await factory.create({ writerConfig, readerConfig, authenticatedUser });

        expect(executor).toBeInstanceOf(WorkflowExecutorFake);
        expect(calls).toEqual([
            [
                expect.objectContaining({
                    writerConfig: expect.objectContaining({ pool: { min: 0, max: 1 } }),
                    readerConfig: expect.objectContaining({ pool: { min: 0, max: 1 } }),
                }),
                expect.objectContaining({
                    writerConfig: expect.objectContaining({ pool: { min: 0, max: 1 } }),
                    readerConfig: expect.objectContaining({ pool: { min: 0, max: 1 } }),
                }),
                expect.objectContaining({
                    writerConfig: expect.objectContaining({ pool: { min: 0, max: 1 } }),
                    readerConfig: expect.objectContaining({ pool: { min: 0, max: 1 } }),
                }),
                authenticatedUser,
                { requestTimeoutMs: 10_000 },
            ],
        ]);

        await executor.destroy();
        expect(calls[0].slice(0, 3).map(({ destroyCalls }) => destroyCalls)).toEqual([1, 1, 1]);
        expect(writerConfig).not.toHaveProperty('pool');
        expect(readerConfig).not.toHaveProperty('pool');
    });

    it('settles cleanup for repositories created before a later constructor fails', async () => {
        const createdRepositories = [];
        class RecordingRepository extends RepositoryFake {
            constructor(...arguments_) {
                super(...arguments_);
                createdRepositories.push(this);
            }
        }
        class FailingRepository {
            constructor() {
                throw new Error('repository construction failed');
            }
        }
        const factory = new ChannelHubWorkflowExecutorFactory({
            WorkflowExecutorClass: WorkflowExecutorFake,
            WorkflowStepRepositoryClass: RecordingRepository,
            AllowedConnectionsRepositoryClass: FailingRepository,
            SecretsVaultRepositoryClass: RepositoryFake,
        });

        await expect(factory.create({ writerConfig: { client: 'pg' }, authenticatedUser: {} })).rejects.toThrow(
            'repository construction failed'
        );
        expect(createdRepositories[0].destroyCalls).toBe(1);
    });
});
