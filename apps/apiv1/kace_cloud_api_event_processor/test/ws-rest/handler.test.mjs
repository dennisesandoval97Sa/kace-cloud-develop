import { jest } from '@jest/globals';

const mockConnection = { mock: 'knex-connection' };
const mockWriterConfig = { client: 'pg', connection: { host: 'writer' }, schema: 'tenant-a' };
const mockReaderConfig = { client: 'pg', connection: { host: 'reader' }, schema: 'tenant-a' };
const mockGetRemainingTimeInMillis = jest.fn().mockReturnValue(60_000);
const mockCurrentUser = { id: { value: 'user-001' } };
const mockUserRepository = {
    connection: mockConnection,
    find: jest.fn().mockResolvedValue(mockCurrentUser),
};

const mockExecutionRepository = { mock: 'ws-rest-flow-execution-repository' };
const mockWorkflowStepRepository = { mock: 'workflow-step-repository', destroyConnection: jest.fn() };
const mockAllowedConnectionsRepository = { mock: 'allowed-connections-repository', destroyConnection: jest.fn() };
const mockSecretsVaultRepository = { mock: 'secrets-vault-repository', destroyConnection: jest.fn() };
const mockWorkflowExecutor = { mock: 'workflow-executor' };
const mockHandle = jest.fn().mockResolvedValue(undefined);

const mockCreateEventLambdaHandler = jest.fn((config) => {
    return jest.fn(async (incomingEvent) => {
        const record = incomingEvent.Records[0];
        const domainEvent = JSON.parse(record.body);
        const factory = config.handlerFactories.get(domainEvent.eventName);

        await factory(
            {
                userRepository: mockUserRepository,
                writerConfig: mockWriterConfig,
                readerConfig: mockReaderConfig,
                getRemainingTimeInMillis: mockGetRemainingTimeInMillis,
            },
            domainEvent
        );

        return { batchItemFailures: [] };
    });
});

jest.unstable_mockModule('../../src/shared/createEventLambdaHandler.mjs', () => ({
    createEventLambdaHandler: mockCreateEventLambdaHandler,
}));

jest.unstable_mockModule(
    '@kace/core/src/ws-rest-flow-executions/domain/events/WSRestFlowExecutionRequested.js',
    () => ({
        WSRestFlowExecutionRequested: { EVENT_NAME: 'kace.core.ws_rest_flow_execution.requested' },
    })
);

const MockExecuteWSRestFlowOnExecutionRequested = jest.fn().mockImplementation(() => ({
    handle: mockHandle,
}));
jest.unstable_mockModule(
    '@kace/core/src/ws-rest-flow-executions/application/event-handlers/ExecuteWSRestFlowOnExecutionRequested.js',
    () => ({
        ExecuteWSRestFlowOnExecutionRequested: MockExecuteWSRestFlowOnExecutionRequested,
    })
);

const MockKnexWSRestFlowExecutionRepository = jest.fn().mockImplementation(() => mockExecutionRepository);
jest.unstable_mockModule(
    '@kace/core/src/ws-rest-flow-executions/infrastructure/persistence/KnexWSRestFlowExecutionRepository.js',
    () => ({
        KnexWSRestFlowExecutionRepository: MockKnexWSRestFlowExecutionRepository,
    })
);

const MockWorkflowExecutor = jest.fn().mockImplementation(() => mockWorkflowExecutor);
jest.unstable_mockModule('@kace/core/src/ws-rest-workflow-step/application/executor/WorkflowExecutor', () => ({
    WorkflowExecutor: MockWorkflowExecutor,
}));

const MockKnexWSRestWorkflowStepRepository = jest.fn().mockImplementation(() => mockWorkflowStepRepository);
jest.unstable_mockModule(
    '@kace/core/src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository',
    () => ({
        KnexWSRestWorkflowStepRepository: MockKnexWSRestWorkflowStepRepository,
    })
);

const MockKnexAllowedConnectionsRepository = jest.fn().mockImplementation(() => mockAllowedConnectionsRepository);
jest.unstable_mockModule('@kace/core/src/allowed-conections', () => ({
    KnexAllowedConnectionsRepository: MockKnexAllowedConnectionsRepository,
}));

const MockKnexSecretsVaultRepository = jest.fn().mockImplementation(() => mockSecretsVaultRepository);
jest.unstable_mockModule('@kace/core/src/secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository', () => ({
    KnexSecretsVaultRepository: MockKnexSecretsVaultRepository,
}));

const { createWorkspacePriorityRecordFailureHandler, handler } = await import('../../src/ws-rest/handler.mjs');

describe('ws-rest-events handler wiring', () => {
    beforeEach(() => {
        mockUserRepository.find.mockClear();
        MockExecuteWSRestFlowOnExecutionRequested.mockClear();
        MockKnexWSRestFlowExecutionRepository.mockClear();
        MockWorkflowExecutor.mockClear();
        MockKnexWSRestWorkflowStepRepository.mockClear();
        MockKnexAllowedConnectionsRepository.mockClear();
        MockKnexSecretsVaultRepository.mockClear();
        mockHandle.mockClear();
        mockWorkflowStepRepository.destroyConnection.mockClear();
        mockAllowedConnectionsRepository.destroyConnection.mockClear();
        mockSecretsVaultRepository.destroyConnection.mockClear();
    });

    it('exports a function (Lambda handler)', () => {
        expect(handler).toEqual(expect.any(Function));
    });

    it('shortens retry visibility for workspace-priority failures to resume after lease expiry', async () => {
        const send = jest.fn().mockResolvedValue(undefined);
        class TestChangeMessageVisibilityCommand {
            constructor(input) {
                this.input = input;
            }
        }
        const onRecordFailure = createWorkspacePriorityRecordFailureHandler({
            sqsClient: { send },
            ChangeMessageVisibilityCommandClass: TestChangeMessageVisibilityCommand,
        });

        await onRecordFailure({
            record: { receiptHandle: 'receipt-1' },
            domainEvent: { eventName: 'kace.core.channel_hub_workspace_priority_reorder.requested' },
            tenant: { aws_ws_rest_events_queue_url: { value: 'https://sqs.test/ws-rest.fifo' } },
        });

        expect(send).toHaveBeenCalledWith(
            expect.objectContaining({
                input: {
                    QueueUrl: 'https://sqs.test/ws-rest.fifo',
                    ReceiptHandle: 'receipt-1',
                    VisibilityTimeout: 450,
                },
            })
        );
    });

    it('does not alter visibility for unrelated WS Rest events', async () => {
        const send = jest.fn().mockResolvedValue(undefined);
        const onRecordFailure = createWorkspacePriorityRecordFailureHandler({
            sqsClient: { send },
            ChangeMessageVisibilityCommandClass: class {},
        });

        await onRecordFailure({
            record: { receiptHandle: 'receipt-1' },
            domainEvent: { eventName: 'kace.core.ws_rest_flow_execution.requested' },
            tenant: { aws_ws_rest_events_queue_url: { value: 'https://sqs.test/ws-rest.fifo' } },
        });

        expect(send).not.toHaveBeenCalled();
    });

    it('registers and runs the generic RestFlow execution handler', async () => {
        const eventPayload = {
            eventId: 'event-001',
            eventName: 'kace.core.ws_rest_flow_execution.requested',
            aggregateId: '550e8400-e29b-41d4-a716-446655440099',
            occurredOn: new Date().toISOString(),
            payload: {
                flowId: '550e8400-e29b-41d4-a716-446655440088',
                initialContext: {
                    source: 'generic.restflow.execution',
                },
            },
            metadata: {
                tenant_id: 'tenant-acme',
                user_id: 'user-001',
            },
        };

        const result = await handler({
            Records: [
                {
                    messageId: 'msg-001',
                    body: JSON.stringify(eventPayload),
                },
            ],
        });

        expect(result.batchItemFailures).toEqual([]);
        expect(mockCreateEventLambdaHandler).toHaveBeenCalledWith(
            expect.objectContaining({
                lambdaName: 'WSRestEventProcessor',
                handlerFactories: expect.any(Map),
            })
        );
        expect(mockUserRepository.find).toHaveBeenCalledWith({ value: 'user-001' });
        expect(MockKnexWSRestFlowExecutionRepository).toHaveBeenCalledWith(mockConnection);
        const boundedWriterConfig = { ...mockWriterConfig, pool: { min: 0, max: 1 } };
        const boundedReaderConfig = { ...mockReaderConfig, pool: { min: 0, max: 1 } };
        expect(MockKnexWSRestWorkflowStepRepository).toHaveBeenCalledWith(boundedWriterConfig, boundedReaderConfig);
        expect(MockKnexAllowedConnectionsRepository).toHaveBeenCalledWith(boundedWriterConfig, boundedReaderConfig);
        expect(MockKnexSecretsVaultRepository).toHaveBeenCalledWith(boundedWriterConfig, boundedReaderConfig);
        expect(MockWorkflowExecutor).toHaveBeenCalledWith(
            mockWorkflowStepRepository,
            mockAllowedConnectionsRepository,
            mockSecretsVaultRepository,
            mockCurrentUser,
            {}
        );
        expect(MockExecuteWSRestFlowOnExecutionRequested).toHaveBeenCalledWith(
            mockExecutionRepository,
            mockWorkflowExecutor
        );
        expect(mockHandle).toHaveBeenCalledWith(
            expect.objectContaining({
                eventName: 'kace.core.ws_rest_flow_execution.requested',
                aggregateId: '550e8400-e29b-41d4-a716-446655440099',
            })
        );
        expect(mockWorkflowStepRepository.destroyConnection).toHaveBeenCalledTimes(1);
        expect(mockAllowedConnectionsRepository.destroyConnection).toHaveBeenCalledTimes(1);
        expect(mockSecretsVaultRepository.destroyConnection).toHaveBeenCalledTimes(1);
    });

    it('cleans repositories created before workflow composition fails', async () => {
        MockKnexAllowedConnectionsRepository.mockImplementationOnce(() => {
            throw new Error('allowed-connections construction failed');
        });
        const eventPayload = {
            eventName: 'kace.core.ws_rest_flow_execution.requested',
            metadata: { tenant_id: 'tenant-acme', user_id: 'user-001' },
        };

        await expect(
            handler({ Records: [{ messageId: 'msg-construction-failure', body: JSON.stringify(eventPayload) }] })
        ).rejects.toThrow('allowed-connections construction failed');
        expect(mockWorkflowStepRepository.destroyConnection).toHaveBeenCalledTimes(1);
    });
});
