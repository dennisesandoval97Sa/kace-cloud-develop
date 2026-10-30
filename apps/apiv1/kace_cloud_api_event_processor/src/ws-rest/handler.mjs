import { WSRestFlowExecutionRequested } from '@kace/core/src/ws-rest-flow-executions/domain/events/WSRestFlowExecutionRequested.js';
import { ExecuteWSRestFlowOnExecutionRequested } from '@kace/core/src/ws-rest-flow-executions/application/event-handlers/ExecuteWSRestFlowOnExecutionRequested.js';
import { KnexWSRestFlowExecutionRepository } from '@kace/core/src/ws-rest-flow-executions/infrastructure/persistence/KnexWSRestFlowExecutionRepository.js';
import { WorkflowExecutor } from '@kace/core/src/ws-rest-workflow-step/application/executor/WorkflowExecutor';
import { KnexWSRestWorkflowStepRepository } from '@kace/core/src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository';
import { KnexAllowedConnectionsRepository } from '@kace/core/src/allowed-conections';
import { KnexSecretsVaultRepository } from '@kace/core/src/secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository';
import { ChannelHubWorkspacePriorityReorderRequested } from '@kace/core/src/channel-hub-workspace-priorities/domain/events/ChannelHubWorkspacePriorityReorderRequested.js';
import { ProcessWorkspacePriorityReorderOnRequested } from '@kace/core/src/channel-hub-workspace-priorities/application/event-handlers/ProcessWorkspacePriorityReorderOnRequested.js';
import { ChangeMessageVisibilityCommand, SQSClient } from '@aws-sdk/client-sqs';
import { createEventLambdaHandler } from '../shared/createEventLambdaHandler.mjs';
import {
    createWorkspacePriorityReorderHandler,
    WorkspacePriorityReorderProcessorFactory,
} from './WorkspacePriorityReorderProcessorFactory.mjs';
import { createWsRestHandlerFactories } from './createWsRestHandlerFactories.mjs';

const WORKSPACE_PRIORITY_RETRY_VISIBILITY_SECONDS = 450;
const boundedPoolConfig = (config) => (config ? { ...config, pool: { ...config.pool, min: 0, max: 1 } } : null);

export const createWorkspacePriorityRecordFailureHandler = ({
    sqsClient,
    ChangeMessageVisibilityCommandClass = ChangeMessageVisibilityCommand,
}) =>
    async function handleWorkspacePriorityRecordFailure({ record, domainEvent, tenant }) {
        if (domainEvent.eventName !== ChannelHubWorkspacePriorityReorderRequested.EVENT_NAME) return;
        const queueUrl = tenant.aws_ws_rest_events_queue_url?.value;
        if (!record.receiptHandle || !queueUrl) return;

        await sqsClient.send(
            new ChangeMessageVisibilityCommandClass({
                QueueUrl: queueUrl,
                ReceiptHandle: record.receiptHandle,
                VisibilityTimeout: WORKSPACE_PRIORITY_RETRY_VISIBILITY_SECONDS,
            })
        );
    };

const createWorkflowExecutor = async ({
    writerConfig,
    readerConfig,
    currentUser,
    requestTimeoutMs,
    requestTimeoutResolver,
}) => {
    const boundedWriterConfig = boundedPoolConfig(writerConfig);
    const boundedReaderConfig = boundedPoolConfig(readerConfig);
    const repositories = [];
    let executor;
    try {
        repositories.push(new KnexWSRestWorkflowStepRepository(boundedWriterConfig, boundedReaderConfig));
        repositories.push(new KnexAllowedConnectionsRepository(boundedWriterConfig, boundedReaderConfig));
        repositories.push(new KnexSecretsVaultRepository(boundedWriterConfig, boundedReaderConfig));
        const options = {};
        if (requestTimeoutMs !== undefined) options.requestTimeoutMs = requestTimeoutMs;
        if (requestTimeoutResolver !== undefined) options.requestTimeoutResolver = requestTimeoutResolver;
        executor = new WorkflowExecutor(...repositories, currentUser, options);
    } catch (error) {
        await Promise.allSettled(repositories.map((repository) => repository.destroyConnection?.()));
        throw error;
    }
    executor.destroy = async () => {
        const results = await Promise.allSettled(repositories.map((repository) => repository.destroyConnection?.()));
        const failure = results.find(({ status }) => status === 'rejected');
        if (failure) throw failure.reason;
    };
    return executor;
};

const findEventUser = async (userRepository, event) => {
    const userId = event.metadata?.user_id;
    return userId ? userRepository.find({ value: userId }) : null;
};

const workspacePriorityReorderProcessorFactory = new WorkspacePriorityReorderProcessorFactory({
    createWorkflowExecutor,
});

const restFlowHandler = async ({ userRepository, writerConfig, readerConfig }, event) => {
    const knexInstance = userRepository.connection;
    const executionRepository = new KnexWSRestFlowExecutionRepository(knexInstance);

    const currentUser = await findEventUser(userRepository, event);
    const workflowExecutor = await createWorkflowExecutor({ writerConfig, readerConfig, currentUser });
    const eventHandler = new ExecuteWSRestFlowOnExecutionRequested(executionRepository, workflowExecutor);
    try {
        await eventHandler.handle(event);
    } finally {
        await workflowExecutor.destroy();
    }
};

const workspacePriorityReorderHandler = createWorkspacePriorityReorderHandler({
    processorFactory: workspacePriorityReorderProcessorFactory,
    EventHandler: ProcessWorkspacePriorityReorderOnRequested,
    findCurrentUser: findEventUser,
});

const handlerFactories = createWsRestHandlerFactories({
    restFlowEventName: WSRestFlowExecutionRequested.EVENT_NAME,
    restFlowHandler,
    workspacePriorityReorderEventName: ChannelHubWorkspacePriorityReorderRequested.EVENT_NAME,
    workspacePriorityReorderHandler,
});
const onRecordFailure = createWorkspacePriorityRecordFailureHandler({ sqsClient: new SQSClient({}) });

export const handler = createEventLambdaHandler({
    handlerFactories,
    lambdaName: 'WSRestEventProcessor',
    onRecordFailure,
});
