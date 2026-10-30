import { WorkflowExecutor } from '@kace/core/src/ws-rest-workflow-step/application/executor/WorkflowExecutor.js';
import { KnexWSRestWorkflowStepRepository } from '@kace/core/src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository.js';
import { KnexAllowedConnectionsRepository } from '@kace/core/src/allowed-conections/infrastructure/persistence/KnexAllowedConnectionsRepository.js';
import { KnexSecretsVaultRepository } from '@kace/core/src/secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository.js';

const boundedPoolConfig = (config) => (config ? { ...config, pool: { ...config.pool, min: 0, max: 1 } } : null);

export class ChannelHubWorkflowExecutorFactory {
    constructor({
        WorkflowExecutorClass = WorkflowExecutor,
        WorkflowStepRepositoryClass = KnexWSRestWorkflowStepRepository,
        AllowedConnectionsRepositoryClass = KnexAllowedConnectionsRepository,
        SecretsVaultRepositoryClass = KnexSecretsVaultRepository,
    } = {}) {
        this.WorkflowExecutorClass = WorkflowExecutorClass;
        this.WorkflowStepRepositoryClass = WorkflowStepRepositoryClass;
        this.AllowedConnectionsRepositoryClass = AllowedConnectionsRepositoryClass;
        this.SecretsVaultRepositoryClass = SecretsVaultRepositoryClass;
    }

    async create({ writerConfig, readerConfig, authenticatedUser }) {
        const boundedWriterConfig = boundedPoolConfig(writerConfig);
        const boundedReaderConfig = boundedPoolConfig(readerConfig);
        const repositories = [];
        let executor;
        try {
            repositories.push(new this.WorkflowStepRepositoryClass(boundedWriterConfig, boundedReaderConfig));
            repositories.push(new this.AllowedConnectionsRepositoryClass(boundedWriterConfig, boundedReaderConfig));
            repositories.push(new this.SecretsVaultRepositoryClass(boundedWriterConfig, boundedReaderConfig));
            executor = new this.WorkflowExecutorClass(...repositories, authenticatedUser, {
                requestTimeoutMs: 10_000,
            });
        } catch (error) {
            await Promise.allSettled(repositories.map((repository) => repository.destroyConnection?.()));
            throw error;
        }
        executor.destroy = async () => {
            const results = await Promise.allSettled(
                repositories.map((repository) => repository.destroyConnection?.())
            );
            const failure = results.find(({ status }) => status === 'rejected');
            if (failure) throw failure.reason;
        };
        return executor;
    }
}

const workflowExecutorFactory = new ChannelHubWorkflowExecutorFactory();

export const createChannelHubWorkflowExecutor = (arguments_) => workflowExecutorFactory.create(arguments_);
