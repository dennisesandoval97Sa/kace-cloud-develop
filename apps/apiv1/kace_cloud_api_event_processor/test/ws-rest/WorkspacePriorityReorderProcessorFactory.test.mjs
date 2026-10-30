import { describe, expect, it, jest } from '@jest/globals';
import {
    createWorkspacePriorityReorderHandler,
    WorkspacePriorityReorderProcessorFactory,
} from '../../src/ws-rest/WorkspacePriorityReorderProcessorFactory.mjs';

const createRecordingDependencies = (records) => {
    class ChannelHubRegistrationFlowValidator {
        constructor(repository) {
            this.repository = repository;
            records.registrationFlowValidators.push(this);
        }
    }

    class KnexChannelHubAccountRepository {
        constructor(writerConfig, readerConfig) {
            this.writerConfig = writerConfig;
            this.readerConfig = readerConfig;
            records.accountRepositories.push(this);
        }

        async destroyConnection() {
            records.destroyedRepositories.push(this);
        }
    }

    class ChannelHubWorkspacePriorityManager {
        constructor(dependencies) {
            this.dependencies = dependencies;
            records.priorityManagers.push(this);
        }
    }

    class ChannelHubWorkspacePriorityReorderProcessor {
        constructor(dependencies) {
            this.dependencies = dependencies;
            records.processors.push(this);
        }
    }

    class ChannelHubMailRulesRestFlowAdapter {
        constructor(workflowExecutor) {
            this.workflowExecutor = workflowExecutor;
            records.mailRuleAdapters.push(this);
        }
    }

    class KnexChannelHubWorkspacePriorityReorderRepository {
        constructor(writerConfig, readerConfig) {
            this.writerConfig = writerConfig;
            this.readerConfig = readerConfig;
            records.operationRepositories.push(this);
        }

        async destroyConnection() {
            records.destroyedOperationRepositories.push(this);
        }
    }

    class KnexWorkspacesRepository {
        constructor(writerConfig, readerConfig) {
            this.writerConfig = writerConfig;
            this.readerConfig = readerConfig;
            records.workspaceRepositories.push(this);
        }

        async destroyConnection() {
            records.destroyedRepositories.push(this);
        }
    }

    class KnexWSRestFlowRepository {
        constructor(writerConfig, readerConfig) {
            this.writerConfig = writerConfig;
            this.readerConfig = readerConfig;
            records.restFlowRepositories.push(this);
        }

        async destroyConnection() {
            records.destroyedRepositories.push(this);
        }
    }

    return {
        ChannelHubRegistrationFlowValidator,
        KnexChannelHubAccountRepository,
        ChannelHubWorkspacePriorityManager,
        ChannelHubWorkspacePriorityReorderProcessor,
        ChannelHubMailRulesRestFlowAdapter,
        KnexChannelHubWorkspacePriorityReorderRepository,
        KnexWorkspacesRepository,
        KnexWSRestFlowRepository,
    };
};

describe('WorkspacePriorityReorderProcessorFactory', () => {
    it('composes the production processor graph with bounded workflow and processor timeouts', async () => {
        const records = {
            accountRepositories: [],
            mailRuleAdapters: [],
            operationRepositories: [],
            destroyedOperationRepositories: [],
            destroyedRepositories: [],
            priorityManagers: [],
            processors: [],
            registrationFlowValidators: [],
            restFlowRepositories: [],
            workspaceRepositories: [],
            workflowExecutors: [],
        };
        const dependencies = createRecordingDependencies(records);
        const currentUser = { id: { value: 'user-001' } };
        const workflowExecutor = { name: 'workflow-executor' };
        const factory = new WorkspacePriorityReorderProcessorFactory({
            createWorkflowExecutor: (...args) => {
                records.workflowExecutors.push(args);
                return workflowExecutor;
            },
            loadDependencies: async () => dependencies,
        });

        const writerConfig = { client: 'pg', connection: { host: 'writer' }, schema: 'tenant-a' };
        const readerConfig = { client: 'pg', connection: { host: 'reader' }, schema: 'tenant-a' };
        let remainingTimeMs = 50_000;
        const processorUnit = await factory.create({
            writerConfig,
            readerConfig,
            currentUser,
            getRemainingTimeInMillis: () => remainingTimeMs,
        });

        expect(records.workflowExecutors).toEqual([]);
        const boundedConfigs = {
            writerConfig: { ...writerConfig, pool: { min: 0, max: 1 } },
            readerConfig: { ...readerConfig, pool: { min: 0, max: 1 } },
        };
        expect(records.accountRepositories[0]).toMatchObject(boundedConfigs);
        expect(records.workspaceRepositories[0]).toMatchObject(boundedConfigs);
        expect(records.restFlowRepositories[0]).toMatchObject(boundedConfigs);
        expect(records.operationRepositories[0]).toMatchObject(boundedConfigs);
        expect(records.registrationFlowValidators[0].repository).toBe(records.restFlowRepositories[0]);
        expect(records.mailRuleAdapters[0].workflowExecutor).toEqual(expect.any(Function));
        expect(records.mailRuleAdapters[0].workflowExecutor()).toMatchObject({
            execute: expect.any(Function),
            destroy: expect.any(Function),
        });
        expect(records.workflowExecutors).toEqual([
            [
                {
                    ...boundedConfigs,
                    currentUser,
                    requestTimeoutMs: 30_000,
                    requestTimeoutResolver: expect.any(Function),
                },
            ],
        ]);
        const requestTimeoutResolver = records.workflowExecutors[0][0].requestTimeoutResolver;
        expect(requestTimeoutResolver()).toBe(30_000);
        remainingTimeMs = 20_000;
        expect(requestTimeoutResolver()).toBe(5_000);
        remainingTimeMs = 15_000;
        expect(requestTimeoutResolver()).toBe(0);
        remainingTimeMs = 50_000;
        expect(writerConfig).not.toHaveProperty('pool');
        expect(readerConfig).not.toHaveProperty('pool');
        expect(records.priorityManagers[0].dependencies).toEqual({
            accountRepository: records.accountRepositories[0],
            workspaceRepository: records.workspaceRepositories[0],
            mailRules: records.mailRuleAdapters[0],
            restFlowValidator: records.registrationFlowValidators[0],
        });
        expect(processorUnit.processor).toBe(records.processors[0]);
        expect(records.processors[0].dependencies).toEqual({
            priorityManager: records.priorityManagers[0],
            operationRepository: records.operationRepositories[0],
            maxDurationMs: 300_000,
            hasTimeForRemoteCall: expect.any(Function),
        });
        expect(records.processors[0].dependencies.hasTimeForRemoteCall()).toBe(true);
        remainingTimeMs = 44_999;
        expect(records.processors[0].dependencies.hasTimeForRemoteCall()).toBe(false);
        expect(() => records.mailRuleAdapters[0].workflowExecutor()).toThrow(
            'Workspace priority reorder reached the Lambda cleanup buffer'
        );
        expect(records.workflowExecutors).toHaveLength(1);

        const executionsBeforeCleanupBuffer = records.workflowExecutors.length;
        const processorNearTimeoutUnit = await factory.create({
            writerConfig,
            readerConfig,
            currentUser,
            getRemainingTimeInMillis: () => 15_500,
        });
        expect(processorNearTimeoutUnit.processor.dependencies.hasTimeForRemoteCall()).toBe(false);
        expect(() => records.mailRuleAdapters.at(-1).workflowExecutor()).toThrow(
            'Workspace priority reorder reached the Lambda cleanup buffer'
        );
        expect(records.workflowExecutors).toHaveLength(executionsBeforeCleanupBuffer);
        await processorUnit.dispose();
        await processorNearTimeoutUnit.dispose();
        expect(records.destroyedOperationRepositories).toEqual(records.operationRepositories);
        expect(records.destroyedRepositories).toEqual([
            records.accountRepositories[0],
            records.workspaceRepositories[0],
            records.restFlowRepositories[0],
            records.accountRepositories[1],
            records.workspaceRepositories[1],
            records.restFlowRepositories[1],
        ]);
    });

    it.each([
        ['success', null],
        ['failure', new Error('reconciliation failed')],
    ])('disposes the owned operation repository after processing %s', async (_outcome, processingError) => {
        const processor = { execute: jest.fn() };
        if (processingError) processor.execute.mockRejectedValue(processingError);
        const dispose = jest.fn().mockResolvedValue(undefined);
        const processorFactory = {
            create: jest.fn().mockResolvedValue({ processor, dispose }),
        };
        const EventHandler = class {
            constructor(subject) {
                this.subject = subject;
            }

            handle(event) {
                return this.subject.execute(event.payload.operationId);
            }
        };
        const currentUser = { id: { value: 'user-001' } };
        const handler = createWorkspacePriorityReorderHandler({
            processorFactory,
            EventHandler,
            findCurrentUser: jest.fn().mockResolvedValue(currentUser),
        });
        const context = {
            userRepository: { connection: 'writer-read-connection' },
            writerConfig: { client: 'pg', connection: { host: 'writer' } },
            readerConfig: { client: 'pg', connection: { host: 'reader' } },
            getRemainingTimeInMillis: () => 60_000,
        };
        const event = { payload: { operationId: 'operation-001' } };

        if (processingError) {
            await expect(handler(context, event)).rejects.toThrow(processingError.message);
        } else {
            await expect(handler(context, event)).resolves.toBeUndefined();
        }

        expect(processorFactory.create).toHaveBeenCalledWith({
            writerConfig: context.writerConfig,
            readerConfig: context.readerConfig,
            currentUser,
            getRemainingTimeInMillis: context.getRemainingTimeInMillis,
        });
        expect(dispose).toHaveBeenCalledTimes(1);
    });
});
