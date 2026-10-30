import { v4 as uuid } from 'uuid';
import { WSRestWorkflowStepMother } from '../../../ws-rest-workflow-step/domain/WSRestWorkflowStepMother.js';
import WSRestEndpointMother from '../../../ws-rest-endpoints/domain/WSRestEndpointMother.js';
import WSRestFlowMother from '../../../ws-rest-flows/domain/WSRestFlowMother.js';
import WSRestFunctionMother from '../../../ws_rest_functions/domain/WSRestFunctionMother.js';
import { WSRestFlowCreator } from '../../../../src/ws-rest-flows/index.js';
import { AxiosHttpClient } from '../../../../src/shared/infrastructure/http/AxiosHttpClient.js';
import { SecretReplacer } from '../../../../src/secrets-vault/application/replacer/SecretReplacer.js';
import { WSRestWorkflowStepFinderService } from '../../../../src/ws-rest-workflow-step/domain/services/WSRestWorkflowStepFinderService.js';
import { knexConfig } from '../../../knexfile.js';
import { WorkflowStepExecutorService } from '../../../../src/shared/domain/services/WorkflowStepExecutorService.js';
import { KnexWSRestWorkflowStepRepository } from '../../../../src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository.js';
import { KnexWSRestEndpointRepository } from '../../../../src/ws-rest-endpoints/infrastructure/persistence/KnexWSRestEndpointRepository.js';
import { KnexWSRestFunctionRepository } from '../../../../src/ws_rest_functions/infrastructure/persistence/KnexWSRestFunctionRepository.js';
import { KnexWSRestFlowRepository } from '../../../../src/ws-rest-flows/infrastructure/persistence/KnexWSRestFlowRepository.js';
import { KnexWSRestConditionalRepository } from '../../../../src/ws-rest-conditionals/infrastructure/persistence/KnexWSRestConditionalRepository.js';
import WSRestConditionalMother from '../../../ws-rest-conditionals/domain/WSRestConditionalMother.js';
import { expect, jest } from '@jest/globals';
import { TenantContext } from '../../../../src/shared/infrastructure/context/TenantContext.js';
import LocalTenantRepository from '../../../../src/tenant/infrastructure/local/LocalTenantRepository.js';
import { KnexAllowedConnectionsRepository } from '../../../../src/allowed-conections/index.js';
import AllowedConnectionsMother from '../../../allowed-conections/domain/AllowedConnectionsMother.js';
import { EventLogger } from '../../../../src/shared/EventLogger.js';
import { EventPublisher } from '../../../../src/shared/application/events/EventPublisher.js';
import { User } from '../../../../src/users/index.js';
import UsersMother from '../../../users/domain/UsersMother.js';
import * as jwt from 'jsonwebtoken';

describe('WorkflowStepExecutorService Integration', () => {
    const repo = new KnexWSRestWorkflowStepRepository(knexConfig);
    const endpointRepo = new KnexWSRestEndpointRepository(knexConfig);
    const functionRepo = new KnexWSRestFunctionRepository(knexConfig);
    const flowRepo = new KnexWSRestFlowRepository(knexConfig);
    const conditionalRepo = new KnexWSRestConditionalRepository(knexConfig);
    const allowedConnectionRepository = new KnexAllowedConnectionsRepository(knexConfig);

    let finderService;
    let httpClient;
    let secretReplacer;
    let executor;
    let tenant;

    beforeAll(async () => {
        // Sin `await`, el INSERT de la conexion permitida seguia vivo cuando arrancaba el
        // `beforeEach` de `perFileDatabase`, que sostiene un `AccessExclusiveLock` mientras
        // trunca: postgres mata a una de las dos partes y el fallo cae sobre un `it` inocente.
        await AllowedConnectionsMother.createAllowedConnection(allowedConnectionRepository, {
            connection: 'jsonplaceholder.typicode.com',
        });

        secretReplacer = new SecretReplacer();
        finderService = new WSRestWorkflowStepFinderService(repo);
        httpClient = new AxiosHttpClient(allowedConnectionRepository);
        tenant = await new LocalTenantRepository().find();
    });

    beforeEach(async () => {
        executor = new WorkflowStepExecutorService(
            httpClient,
            secretReplacer,
            finderService,
            new EventLogger(repo),
            new User(UsersMother.dto())
        );
    });

    afterEach(async () => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    it('executes an endpoint step without variables or secrets', async () => {
        await TenantContext.run(tenant, async () => {
            const flow = await WSRestFlowMother.create(flowRepo);
            const endpoint = await WSRestEndpointMother.create(endpointRepo, {
                url: 'https://jsonplaceholder.typicode.com/todos/1',
                method: 'GET',
                body: { body: {} },
                authorization_id: null,
            });

            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                endpoint_id: endpoint.id.value,
                order: 1,
            });

            jest.spyOn(httpClient, 'request').mockResolvedValue({
                status: 200,
                data: { userId: 1, id: 1, title: 'delectus aut autem', completed: false },
                headers: {},
            });

            const context = await executor.execute({ flow_id: flow.id.value });

            expect(httpClient.request).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'GET',
                    url: 'https://jsonplaceholder.typicode.com/todos/1',
                    timeout: 600000,
                    headers: {
                        'content-type': 'application/json',
                    },
                })
            );

            expect(context.get()).toHaveProperty('context');
        });
    });

    it('replaces variables in url, headers and body', async () => {
        await TenantContext.run(tenant, async () => {
            const flow = await WSRestFlowMother.create(flowRepo);
            const endpoint = await WSRestEndpointMother.create(endpointRepo, {
                url: 'https://example.com/users/context.userId/posts',
                method: 'POST',
                headers: { headers: { Authorization: 'Bearer context.token' } },
                body: { body: { title: 'context.title', body: 'content' } },
                is_dynamic_url: true,
                is_dynamic_header: true,
                is_dynamic_body: true,
            });
            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                endpoint_id: endpoint.id.value,
                order: 1,
            });

            jest.spyOn(httpClient, 'request').mockResolvedValue({
                status: 200,
                data: { ok: true },
                headers: {},
            });

            await executor.execute({
                flow_id: flow.id.value,
                initial_context: { userId: 99, token: 'abc123', title: 'Hello' },
            });

            expect(httpClient.request).toHaveBeenCalledWith({
                method: 'POST',
                url: 'https://example.com/users/99/posts',
                timeout: 600000,
                headers: { Authorization: 'Bearer abc123' },
                data: { title: 'Hello', body: 'content' },
            });
        });
    });

    it('replaces secrets coming from SecretReplacer', async () => {
        await TenantContext.run(tenant, async () => {
            const flow = await WSRestFlowMother.create(flowRepo);
            const endpoint = await WSRestEndpointMother.create(endpointRepo, {
                url: 'https://example.com/secret/SECRET_API_KEY',
                headers: { headers: { 'X-Secret': 'SECRET_TOKEN' } },
                body: { body: { key: 'SECRET_KEY' } },
            });
            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                endpoint_id: endpoint.id.value,
                order: 1,
            });

            jest.spyOn(secretReplacer, 'replaceSecretsInUrl').mockResolvedValue('https://example.com/secret/123');
            jest.spyOn(secretReplacer, 'replaceSecretsInHeader').mockResolvedValue({
                headers: { 'X-Secret': 'TOKEN' },
            });
            jest.spyOn(secretReplacer, 'replaceSecretsInBody').mockResolvedValue({ body: { key: 'KEY' } });

            jest.spyOn(httpClient, 'request').mockResolvedValue({ status: 200, data: {} });

            await executor.execute({ flow_id: flow.id.value });

            expect(httpClient.request).toHaveBeenCalledWith({
                method: 'POST',
                url: 'https://example.com/secret/123',
                timeout: 600000,
                headers: { 'X-Secret': 'TOKEN' },
                data: { key: 'KEY' },
            });
        });
    });

    it('publishes a flow-execution event for the success hook when status matches', async () => {
        await TenantContext.run(tenant, async () => {
            const flow = await WSRestFlowMother.create(flowRepo);
            const endpoint = await WSRestEndpointMother.create(endpointRepo, {
                url: 'https://example.com/test',
                method: 'GET',
                on_success: { on_success: { 200: 'hook-external-ok' } },
            });
            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                endpoint_id: endpoint.id.value,
                order: 1,
            });

            jest.spyOn(httpClient, 'request').mockResolvedValue({ status: 200, data: {} });
            const publishSpy = jest.spyOn(EventPublisher.prototype, 'publish').mockResolvedValue(undefined);

            await executor.execute({ flow_id: flow.id.value });

            // The success hook requests the configured flow via a domain event, not an HTTP call.
            const hookEvent = publishSpy.mock.calls
                .map((call) => call[0])
                .find((event) => event?.payload?.externalCode === 'hook-external-ok');
            expect(hookEvent).toBeDefined();
            expect(hookEvent.eventName).toBe('kace.core.ws_rest_flow_execution.requested');
            expect(hookEvent.payload.initialContext).toEqual(
                expect.objectContaining({
                    trigger_success: { endpoint_id: endpoint.id.value, status: 200 },
                })
            );
        });
    });

    it('correctly adds initial_context to global context', async () => {
        await TenantContext.run(tenant, async () => {
            const flow = await WSRestFlowMother.create(flowRepo);
            const endpoint = await WSRestEndpointMother.create(endpointRepo, {
                url: 'https://jsonplaceholder.typicode.com/todos/1',
                method: 'GET',
                body: { body: {} },
                authorization_id: null,
            });

            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                endpoint_id: endpoint.id.value,
                order: 1,
            });

            jest.spyOn(httpClient, 'request').mockResolvedValue({
                status: 200,
                data: { userId: 1, id: 1, title: 'delectus aut autem', completed: false },
                headers: {},
            });

            const initialContext = {
                case: {
                    id: 'f7baf539-16fd-4026-b6c1-ce9558dd4089',
                },
            };

            const context = await executor.execute({
                flow_id: flow.id.value,
                initial_context: initialContext,
            });

            const contextData = context.get();

            expect(contextData.context).toHaveProperty('case');
            expect(contextData.context.case).toEqual(initialContext.case);

            expect(httpClient.request).toHaveBeenCalled();
        });
    });

    it('stores non-object response (string) in default key', async () => {
        await TenantContext.run(tenant, async () => {
            const flow = await WSRestFlowMother.create(flowRepo);
            const endpoint = await WSRestEndpointMother.create(endpointRepo, {
                url: 'https://example.com/notification',
                method: 'POST',
                body: { body: { message: 'Test' } },
                context_position: 'default',
                filter_input: { filter_input: [] },
            });

            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                endpoint_id: endpoint.id.value,
                order: 1,
            });

            jest.spyOn(httpClient, 'request').mockResolvedValue({
                status: 200,
                data: 'Notificación enviada con éxito',
                headers: {},
            });

            const context = await executor.execute({ flow_id: flow.id.value });

            expect(context.get().context).toEqual({
                default: 'Notificación enviada con éxito',
            });
        });
    });

    it('stores object response in root context when in default key', async () => {
        await TenantContext.run(tenant, async () => {
            const flow = await WSRestFlowMother.create(flowRepo);
            const endpoint = await WSRestEndpointMother.create(endpointRepo, {
                url: 'https://example.com/notification',
                method: 'POST',
                context_position: 'default',
                filter_input: { filter_input: [] },
            });

            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                endpoint_id: endpoint.id.value,
                order: 1,
            });

            jest.spyOn(httpClient, 'request').mockResolvedValue({
                status: 200,
                data: {
                    message: 'Notificación enviada con éxito',
                    code: 'SUCCESS',
                },
                headers: {},
            });

            const context = await executor.execute({ flow_id: flow.id.value });

            expect(context.get().context).toEqual({
                default: {
                    message: 'Notificación enviada con éxito',
                    code: 'SUCCESS',
                },
            });
        });
    });

    it('executes a step with dynamic body based on input parameters', async () => {
        await TenantContext.run(tenant, async () => {
            const flow = await WSRestFlowMother.create(flowRepo);

            const endpoint = await WSRestEndpointMother.create(endpointRepo, {
                url: 'https://example.com/filter',
                method: 'POST',
                body: {
                    body: {
                        type: 'filter',
                        action_id: '90d6b28c-da4b-40d8-b19f-3c735ad5ac0b',
                        search_filter: {
                            filter: [
                                {
                                    operator: 'like',
                                    value: 'Indemnización',
                                    type: 'AND',
                                    field: 'context.data.nivel',
                                },
                            ],
                            limit: 0,
                            offset: 0,
                        },
                        separator: ',',
                        id: 'context.fake.data.uuid',
                    },
                },
                filter_input: { filter_input: [] },
                is_dynamic_body: true,
            });

            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                endpoint_id: endpoint.id.value,
                order: 1,
            });

            jest.spyOn(httpClient, 'request').mockResolvedValue({
                status: 200,
                data: { ok: true },
                headers: {},
            });

            const initialContext = {
                data: {
                    nivel: 'Test',
                },
                fake: {
                    data: {
                        uuid: '1234-abcd-5678-efgh',
                    },
                },
            };

            const context = await executor.execute({
                flow_id: flow.id.value,
                initial_context: initialContext,
            });

            expect(httpClient.request).toHaveBeenCalledWith({
                method: 'POST',
                url: 'https://example.com/filter',
                timeout: 600000,
                headers: {
                    'content-type': 'application/json',
                },
                data: {
                    type: 'filter',
                    action_id: '90d6b28c-da4b-40d8-b19f-3c735ad5ac0b',
                    search_filter: {
                        filter: [
                            {
                                operator: 'like',
                                value: 'Indemnización',
                                type: 'AND',
                                field: 'Test',
                            },
                        ],
                        limit: 0,
                        offset: 0,
                    },
                    separator: ',',
                    id: '1234-abcd-5678-efgh',
                },
            });

            expect(context.get()).toHaveProperty('context');
            expect(context.get().context.fake.data.uuid).toBe('1234-abcd-5678-efgh');
        });
    });

    it('executes a step with dynamic body based on context search_filter', async () => {
        await TenantContext.run(tenant, async () => {
            const flow = await WSRestFlowMother.create(flowRepo);

            const endpoint = await WSRestEndpointMother.create(endpointRepo, {
                url: 'https://example.com/levels',
                method: 'POST',
                body: {
                    body: {
                        filter: 'context.search_filter.filter',
                        order: 'context.search_filter.order',
                        limit: 'context.search_filter.limit',
                        offset: 'context.search_filter.offset',
                    },
                },
                filter_input: { filter_input: [] },
                is_dynamic_body: true,
            });

            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                endpoint_id: endpoint.id.value,
                order: 1,
            });

            jest.spyOn(httpClient, 'request').mockResolvedValue({
                status: 200,
                data: { ok: true },
                headers: {},
            });

            const initialContext = {
                data: {
                    value: 'Test',
                },
                fake: {
                    data: {
                        uuid: '1234-abcd-5678-efgh',
                    },
                },
                search_filter: {
                    filter: 'active',
                    order: 'desc',
                    limit: 100,
                    offset: 0,
                },
            };

            const context = await executor.execute({
                flow_id: flow.id.value,
                initial_context: initialContext,
            });

            expect(httpClient.request).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'POST',
                    url: 'https://example.com/levels',
                    headers: {
                        'content-type': 'application/json',
                    },
                    timeout: 600000,
                    data: {
                        filter: 'active',
                        limit: 100,
                        offset: 0,
                        order: 'desc',
                    },
                })
            );

            expect(context.get()).toHaveProperty('context');
            expect(context.get().context.fake.data.uuid).toBe('1234-abcd-5678-efgh');
        });
    });

    it('should log consolidated flow event with all steps when execution is successful', async () => {
        await TenantContext.run(tenant, async () => {
            const flow = await WSRestFlowMother.create(flowRepo);

            const endpoint1 = await WSRestEndpointMother.create(endpointRepo, {
                url: 'https://api.example.com/step1',
                method: 'GET',
                context_position: 'step1_result',
            });

            const endpoint2 = await WSRestEndpointMother.create(endpointRepo, {
                url: 'https://api.example.com/step2',
                method: 'POST',
                body: { body: { data: 'test' } },
                context_position: 'step2_result',
            });

            const step1 = await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                endpoint_id: endpoint1.id.value,
                order: 1,
            });

            const step2 = await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                endpoint_id: endpoint2.id.value,
                order: 2,
            });

            jest.spyOn(httpClient, 'request')
                .mockResolvedValue({
                    status: 200,
                    data: { result: 'step1 success' },
                    headers: {},
                })
                .mockResolvedValue({
                    status: 201,
                    data: { result: 'step2 success' },
                    headers: {},
                });

            await executor.execute({ flow_id: flow.id.value });

            const flowEventLog = await repo
                .connection('event_logs')
                .where({
                    event_name: 'ws-rest-flows.executed',
                    aggregate_id: flow.id.value,
                })
                .first();

            expect(flowEventLog).toBeDefined();
            const eventBody = flowEventLog.body;

            expect(eventBody).toHaveProperty('steps_executed');
            expect(eventBody).toHaveProperty('execution_summary');
            expect(eventBody).toHaveProperty('execution_status', 'success');
            expect(eventBody.total_steps).toBe(2);

            expect(eventBody.steps_executed).toHaveLength(2);
            expect(eventBody.steps_executed[0]).toMatchObject({
                step_id: step1.id.value,
                step_type: 'endpoint',
                duration_ms: expect.any(Number),
            });
            expect(eventBody.steps_executed[1]).toMatchObject({
                step_id: step2.id.value,
                step_type: 'endpoint',
                duration_ms: expect.any(Number),
            });

            expect(eventBody.execution_summary).toMatchObject({
                successful_steps: 2,
                endpoint_steps: 2,
                function_steps: 0,
            });
        });
    });

    it('should log consolidated flow event with error information when a step fails', async () => {
        await TenantContext.run(tenant, async () => {
            const flow = await WSRestFlowMother.create(flowRepo);

            const endpoint1 = await WSRestEndpointMother.create(endpointRepo, {
                url: 'https://api.example.com/step1',
                method: 'GET',
            });

            const endpoint2 = await WSRestEndpointMother.create(endpointRepo, {
                url: 'https://api.example.com/step2',
                method: 'GET',
            });

            const step1 = await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                endpoint_id: endpoint1.id.value,
                order: 1,
            });

            const step2 = await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                endpoint_id: endpoint2.id.value,
                order: 2,
            });

            const responses = [
                Promise.resolve({
                    status: 200,
                    data: { result: 'success' },
                    headers: {},
                }),
                Promise.resolve({
                    status: 500,
                    data: { message: 'Internal Server Error' },
                    headers: {},
                }),
            ];

            let index = 0;
            jest.spyOn(httpClient, 'request').mockImplementation(() => responses[index++]);

            await expect(executor.execute({ flow_id: flow.id.value })).rejects.toThrow();

            const flowEventLog = await repo
                .connection('event_logs')
                .where({
                    event_name: 'ws-rest-flows.executed',
                    aggregate_id: flow.id.value,
                })
                .first();

            const eventBody = flowEventLog.body;

            expect(eventBody.execution_status).toBe('failed');
            expect(eventBody.steps_executed).toHaveLength(2);

            expect(eventBody.steps_executed[0]).toMatchObject({
                step_id: step1.id.value,
                step_type: 'endpoint',
                error: false,
            });

            expect(eventBody.steps_executed[1]).toMatchObject({
                step_id: step2.id.value,
                step_type: 'endpoint',
                error: true,
            });

            expect(eventBody.execution_summary).toMatchObject({
                successful_steps: 1,
                endpoint_steps: 2,
            });
        });
    });

    it('should log consolidated event with mixed step types (endpoint and function)', async () => {
        await TenantContext.run(tenant, async () => {
            const flow = await WSRestFlowMother.create(flowRepo);

            const endpoint = await WSRestEndpointMother.create(endpointRepo, {
                url: 'https://api.example.com/test',
                method: 'GET',
            });

            const mockFunction = await WSRestFunctionMother.create(functionRepo, {
                filter_input: { filter_input: [] },
                type: 'formatDate',
                context_position: 'testFunctionResult',
                value_dynamic: false,
                value_static: new Date().toISOString(),
            });

            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                endpoint_id: endpoint.id.value,
                order: 1,
            });

            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                function_id: mockFunction.id.value,
                order: 2,
            });

            jest.spyOn(httpClient, 'request').mockResolvedValue({
                status: 200,
                data: { result: 'success' },
                headers: {},
            });

            jest.spyOn(mockFunction, 'execute').mockReturnValue({ result: 'function success' });

            await executor.execute({ flow_id: flow.id.value });

            const flowEventLog = await repo
                .connection('event_logs')
                .where({
                    event_name: 'ws-rest-flows.executed',
                    aggregate_id: flow.id.value,
                })
                .first();

            expect(flowEventLog).toBeDefined();
            const eventBody = flowEventLog.body;

            expect(eventBody.execution_status).toBe('success');
            expect(eventBody.steps_executed).toHaveLength(2);

            expect(eventBody.steps_executed[0].step_type).toBe('endpoint');
            expect(eventBody.steps_executed[1].step_type).toBe('function');

            expect(eventBody.execution_summary).toMatchObject({
                successful_steps: 2,
                endpoint_steps: 1,
                function_steps: 1,
            });
        });
    });

    it('executes an authorization step and stores token in context', async () => {
        await TenantContext.run(tenant, async () => {
            const flow = await WSRestFlowMother.create(flowRepo);

            const auth = await WSRestEndpointMother.create(endpointRepo, {
                url: 'https://auth.example.com/oauth/token',
                method: 'POST',
                body: {
                    body: {
                        client_id: 'my-client-id',
                        client_secret: 'my-client-secret',
                        grant_type: 'client_credentials',
                    },
                },
                type: 'authorization',
                context_position: 'auth_data',
                filter_input: { filter_input: ['access_token', 'token_type', 'expires_in'] },
            });

            const endpoint = await WSRestEndpointMother.create(endpointRepo, {
                url: 'https://api.example.com/test',
                method: 'GET',
                authorization_id: auth.id.value,
                context_position: 'endpoint_result',
            });

            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                endpoint_id: endpoint.id.value,
                order: 1,
            });

            const responses = [
                Promise.resolve({
                    status: 200,
                    data: {
                        access_token: 'ey123abc456',
                        token_type: 'Bearer',
                        expires_in: 3600,
                    },
                    headers: {},
                }),
                Promise.resolve({
                    status: 200,
                    data: { result: 'success' },
                    headers: {},
                }),
            ];

            let index = 0;
            jest.spyOn(httpClient, 'request').mockImplementation(() => responses[index++]);

            const result = await executor.execute({
                flow_id: flow.id.value,
            });

            expect(httpClient.request).toHaveBeenCalledWith({
                method: 'POST',
                timeout: 600000,
                url: 'https://auth.example.com/oauth/token',
                headers: {
                    'content-type': 'application/json',
                },
                data: {
                    client_id: 'my-client-id',
                    client_secret: 'my-client-secret',
                    grant_type: 'client_credentials',
                },
            });

            const { context } = result.get();
            expect(context).toHaveProperty('auth_data');
            expect(context.auth_data).toMatchObject({
                access_token: 'ey123abc456',
                token_type: 'Bearer',
                expires_in: 3600,
            });
        });
    });

    it('executes complete flow: get aux cases -> find new stage -> format text -> search auxiliaries', async () => {
        await TenantContext.run(tenant, async () => {
            const flow = await WSRestFlowMother.create(flowRepo);

            const getAuxCasesEndpoint = await WSRestEndpointMother.create(endpointRepo, {
                description: 'get aux cases',
                url: 'https://indemapi.kace-cloud.com/aux-cases/7d9f1d3e-466a-4b01-bc8d-3d0f8d24d7f4',
                method: 'GET',
                body: { body: {} },
                type: 'authorization',
                context_position: 'data.aux_cases',
                filter_input: { filter_input: ['data'] },
                on_success: { on_success: {} },
                on_error: { on_error: {} },
            });

            const findNewStageFunction = await WSRestFunctionMother.create(functionRepo, {
                description: 'Buscar Nueva etapa',
                type: 'findNewElements',
                filter_input: { filter_input: ['data.aux_cases.data.responseOrbika.repair_status'] },
                context_position: 'orbika.functions.new_stage',
                value_dynamic: true,
                value_static: 'orbika.response.details.repair_status',
            });

            const formatTextFunction = await WSRestFunctionMother.create(functionRepo, {
                description: 'Tomar la etapa nueva desde el array para consultar el auxiliar',
                type: 'formatText',
                filter_input: { filter_input: ['orbika.functions.new_stage[0].stage'] },
                context_position: 'functions',
                value_dynamic: false,
                value_static: null,
            });

            const searchAuxiliariesEndpoint = await WSRestEndpointMother.create(endpointRepo, {
                description: 'Consumo Generico AUXILIAR stages_repair desde casteo',
                url: 'https://indemapi.kace-cloud.com/auxiliaries/stages_repair/search',
                method: 'POST',
                body: {
                    body: {
                        filter: [
                            {
                                field: 'data',
                                operator: 'jsonContains',
                                value: '{ "code_stage": context.functions.stage }',
                                type: 'AND',
                            },
                        ],
                        limit: 1,
                        offset: 0,
                    },
                },
                is_dynamic_body: true,
                is_dynamic_header: true,
                filter_input: { filter_input: ['data.items[0].data', 'message', 'data', 'errors'] },
                context_position: 'aux_stages_repair',
                on_success: { on_success: {} },
                on_error: { on_error: {} },
            });

            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                endpoint_id: getAuxCasesEndpoint.id.value,
                order: 1,
            });

            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                function_id: findNewStageFunction.id.value,
                order: 2,
            });

            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                function_id: formatTextFunction.id.value,
                order: 3,
            });

            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                endpoint_id: searchAuxiliariesEndpoint.id.value,
                order: 4,
            });

            const initialContext = {
                orbika: {
                    response: {
                        code: 11060,
                        description: 'Proceso ejecutado correctamente',
                        details: {
                            repair_status: [
                                {
                                    stage: 3,
                                    date: '2025-04-07',
                                },
                                {
                                    stage: 8,
                                    date: '2025-04-07',
                                },
                            ],
                        },
                        origin: 'get-sinister-status',
                    },
                },
                kace: {
                    id_token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                },
            };

            const responses = [
                Promise.resolve({
                    status: 200,
                    data: {
                        data: {
                            data: {
                                responseOrbika: {
                                    repair_status: [
                                        { stage: 6, date: '2025-04-08' },
                                        { stage: 3, date: '2025-04-07' },
                                    ],
                                },
                            },
                        },
                    },
                    headers: {},
                }),
                Promise.resolve({
                    status: 200,
                    data: {
                        data: {
                            items: [
                                {
                                    data: {
                                        code_stage: 6,
                                        description: 'Pintura',
                                        status: 'active',
                                    },
                                },
                            ],
                        },
                    },
                    headers: {},
                }),
            ];

            let index = 0;
            jest.spyOn(httpClient, 'request').mockImplementation(() => responses[index++]);

            const result = await executor.execute({
                flow_id: flow.id.value,
                initial_context: initialContext,
            });

            const resultContext = result.get();

            expect(httpClient.request).toHaveBeenCalledTimes(2);

            expect(resultContext.context).toHaveProperty('data.aux_cases');
            expect(resultContext.context).toHaveProperty('orbika.functions.new_stage');
            expect(resultContext.context).toHaveProperty('functions');

            expect(resultContext.context.orbika.functions.new_stage).toHaveLength(1);
            expect(resultContext.context.orbika.functions.new_stage[0]).toMatchObject({
                stage: 8,
            });

            expect(resultContext.context.functions).toBeDefined();
            expect(resultContext.context.functions).toHaveProperty('stage', '8');

            expect(() => {
                const jsonString = JSON.stringify(resultContext.context);
                const parsed = JSON.parse(jsonString);
                expect(parsed).toHaveProperty('functions');
                expect(parsed).toHaveProperty('orbika');
            }).not.toThrow();

            expect(httpClient.request).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({
                    method: 'POST',
                    url: 'https://indemapi.kace-cloud.com/auxiliaries/stages_repair/search',
                    data: expect.objectContaining({
                        filter: [
                            {
                                field: 'data',
                                operator: 'jsonContains',
                                value: '{ "code_stage": 8 }',
                                type: 'AND',
                            },
                        ],
                    }),
                })
            );
        });
    });

    it('debe formatear fecha con formatDate y almacenar en functions.formatted_result', async () => {
        await TenantContext.run(tenant, async () => {
            const flow = await WSRestFlowMother.create(flowRepo);

            const formatDateFunction = await WSRestFunctionMother.create(functionRepo, {
                description: 'Cambio del formato de fecha (J) (I) (C H A T T I G O)',
                type: 'formatDate',
                filter_input: {
                    filter_input: ['aux_case.data.form_indemnizacion.FechaYHoraDeLaCitaElVehiculoAlTaller'],
                },
                context_position: 'functions.formatted_result',
                value_dynamic: false,
                value_static: 'YYYY-MM-DD HH:mm:ss',
            });

            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                function_id: formatDateFunction.id.value,
                order: 1,
            });

            const initialContext = {
                aux_case: {
                    data: {
                        form_indemnizacion: {
                            FechaYHoraDeLaCitaElVehiculoAlTaller: '2025-10-29T20:28:45.378Z',
                        },
                    },
                },
            };

            const result = await executor.execute({
                flow_id: flow.id.value,
                initial_context: initialContext,
            });

            const resultContext = result.get();

            expect(resultContext.context).toHaveProperty('functions.formatted_result');
            expect(resultContext.context.functions.formatted_result.FechaYHoraDeLaCitaElVehiculoAlTaller).toBe(
                '2025-10-29 20:28:45'
            );

            expect(resultContext.context.aux_case.data.form_indemnizacion.FechaYHoraDeLaCitaElVehiculoAlTaller).toBe(
                '2025-10-29T20:28:45.378Z'
            );
        });
    });

    it('debe cambiar la zona horaria con changeTimeZone y almacenar en functions.timezone_result', async () => {
        await TenantContext.run(tenant, async () => {
            const flow = await WSRestFlowMother.create(flowRepo);

            const changeTimeZoneFunction = await WSRestFunctionMother.create(functionRepo, {
                description: 'Cambiar zona horaria de UTC a America/Mexico_City',
                type: 'convertToTimezone',
                filter_input: {
                    filter_input: ['aux_case.data.form_indemnizacion.FechaYHoraDeLaCitaElVehiculoAlTaller'],
                },
                context_position: 'functions.timezone_result',
                value_dynamic: false,
                value_static: 'America/Mexico_City',
            });

            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                function_id: changeTimeZoneFunction.id.value,
                order: 1,
            });

            const initialContext = {
                aux_case: {
                    data: {
                        form_indemnizacion: {
                            FechaYHoraDeLaCitaElVehiculoAlTaller: '2025-10-29T20:28:45.378Z',
                        },
                    },
                },
            };

            const result = await executor.execute({
                flow_id: flow.id.value,
                initial_context: initialContext,
            });

            const resultContext = result.get();

            expect(resultContext.context).toHaveProperty('functions.timezone_result');
            expect(resultContext.context.functions.timezone_result.FechaYHoraDeLaCitaElVehiculoAlTaller).toBeDefined();

            const originalDate = new Date('2025-10-29T20:28:45.378Z');
            const convertedDate = new Date(
                resultContext.context.functions.timezone_result.FechaYHoraDeLaCitaElVehiculoAlTaller
            );

            expect(convertedDate.toISOString()).not.toBe(originalDate.toISOString());

            expect(resultContext.context.aux_case.data.form_indemnizacion.FechaYHoraDeLaCitaElVehiculoAlTaller).toBe(
                '2025-10-29T20:28:45.378Z'
            );
        });
    });

    it('does NOT re-authenticate when auth token is still valid (shared auth across two steps)', async () => {
        await TenantContext.run(tenant, async () => {
            const flow = await WSRestFlowMother.create(flowRepo);

            const validToken = jwt.default.sign({ sub: 'test-user' }, 'test-secret', { expiresIn: '1h' });

            const auth = await WSRestEndpointMother.create(endpointRepo, {
                url: 'https://auth.example.com/token',
                method: 'POST',
                body: { body: { grant_type: 'client_credentials' } },
                type: 'authorization',
                context_position: 'auth_data',
                filter_input: { filter_input: ['id_token'] },
            });

            const endpoint1 = await WSRestEndpointMother.create(endpointRepo, {
                url: 'https://api.example.com/step1',
                method: 'GET',
                authorization_id: auth.id.value,
                context_position: 'step1_result',
            });

            const endpoint2 = await WSRestEndpointMother.create(endpointRepo, {
                url: 'https://api.example.com/step2',
                method: 'GET',
                authorization_id: auth.id.value,
                context_position: 'step2_result',
            });

            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                endpoint_id: endpoint1.id.value,
                order: 1,
            });

            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                endpoint_id: endpoint2.id.value,
                order: 2,
            });

            const authResponse = { status: 200, data: { id_token: validToken }, headers: {} };
            const step1Response = { status: 200, data: { step: 1 }, headers: {} };
            const step2Response = { status: 200, data: { step: 2 }, headers: {} };
            const webhookResponse = { status: 200, data: { ok: true }, headers: {} };

            const requestSpy = jest
                .spyOn(httpClient, 'request')
                .mockResolvedValueOnce(authResponse)
                .mockResolvedValueOnce(step1Response)
                .mockResolvedValueOnce(step2Response)
                .mockResolvedValue(webhookResponse); // Fallback for webhooks

            await executor.execute({ flow_id: flow.id.value });

            const calls = requestSpy.mock.calls;
            const authCalls = calls.filter(([cfg]) => cfg.url === 'https://auth.example.com/token');
            expect(authCalls).toHaveLength(1);
        });
    });

    it('re-authenticates when the cached token has expired', async () => {
        await TenantContext.run(tenant, async () => {
            const flow = await WSRestFlowMother.create(flowRepo);

            const expiredToken = jwt.default.sign(
                { sub: 'test-user', exp: Math.floor(Date.now() / 1000) - 3600 },
                'test-secret'
            );

            const auth = await WSRestEndpointMother.create(endpointRepo, {
                url: 'https://auth.example.com/token-short',
                method: 'POST',
                body: { body: { grant_type: 'client_credentials' } },
                type: 'authorization',
                context_position: 'auth_data',
                filter_input: { filter_input: ['id_token'] },
            });

            const endpoint1 = await WSRestEndpointMother.create(endpointRepo, {
                url: 'https://api.example.com/stepA',
                method: 'GET',
                authorization_id: auth.id.value,
                context_position: 'stepA_result',
            });

            const endpoint2 = await WSRestEndpointMother.create(endpointRepo, {
                url: 'https://api.example.com/stepB',
                method: 'GET',
                authorization_id: auth.id.value,
                context_position: 'stepB_result',
            });

            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                endpoint_id: endpoint1.id.value,
                order: 1,
            });

            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                endpoint_id: endpoint2.id.value,
                order: 2,
            });

            const expiredTokenResponse = { status: 200, data: { id_token: expiredToken }, headers: {} };
            const stepResponse = { status: 200, data: { ok: true }, headers: {} };
            const webhookResponse = { status: 200, data: { ok: true }, headers: {} };

            const requestSpy = jest
                .spyOn(httpClient, 'request')
                .mockResolvedValueOnce(expiredTokenResponse)
                .mockResolvedValueOnce(stepResponse)
                .mockResolvedValueOnce(expiredTokenResponse)
                .mockResolvedValueOnce(stepResponse)
                .mockResolvedValue(webhookResponse);

            await executor.execute({ flow_id: flow.id.value });

            const calls = requestSpy.mock.calls;
            const authCalls = calls.filter(([cfg]) => cfg.url === 'https://auth.example.com/token-short');

            expect(authCalls).toHaveLength(2);
        });
    });

    it('should include mapProperty metadata in function step execution log', async () => {
        await TenantContext.run(tenant, async () => {
            const flow = await WSRestFlowMother.create(flowRepo);

            const mapFn = await WSRestFunctionMother.create(functionRepo, {
                type: 'mapProperty',
                filter_input: { filter_input: [] },
                context_position: 'mapped.result',
                value_dynamic: true,
                value_static: 'case.details',
            });

            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                function_id: mapFn.id.value,
                order: 1,
            });

            await executor.execute({
                flow_id: flow.id.value,
                initial_context: { case: { details: { id: 'case-1', status: 'open' } } },
            });

            const eventLog = await repo
                .connection('event_logs')
                .where({ event_name: 'ws-rest-flows.executed', aggregate_id: flow.id.value })
                .first();

            expect(eventLog.body.steps_executed[0]).toMatchObject({
                step_type: 'function',
                type: 'mapProperty',
                metadata: {
                    map_property: {
                        from: 'case.details',
                        to: 'mapped.result',
                        found: true,
                        value: { id: 'case-1', status: 'open' },
                    },
                },
            });
        });
    });

    it('should copy the source value to context_position in global context', async () => {
        await TenantContext.run(tenant, async () => {
            const flow = await WSRestFlowMother.create(flowRepo);

            const mapFn = await WSRestFunctionMother.create(functionRepo, {
                type: 'mapProperty',
                filter_input: { filter_input: [] },
                context_position: 'notification.subject',
                value_dynamic: true,
                value_static: 'case.title',
            });

            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                function_id: mapFn.id.value,
                order: 1,
            });

            const context = await executor.execute({
                flow_id: flow.id.value,
                initial_context: { case: { title: 'Solicitud de Soporte #123' } },
            });

            expect(context.get().context.notification.subject).toBe('Solicitud de Soporte #123');
        });
    });

    it('should record found: false in metadata when source path does not exist', async () => {
        await TenantContext.run(tenant, async () => {
            const flow = await WSRestFlowMother.create(flowRepo);

            const mapFn = await WSRestFunctionMother.create(functionRepo, {
                type: 'mapProperty',
                filter_input: { filter_input: [] },
                context_position: 'output.missing',
                value_dynamic: true,
                value_static: 'case.nonexistent.field',
            });

            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                function_id: mapFn.id.value,
                order: 1,
            });

            await executor.execute({
                flow_id: flow.id.value,
                initial_context: { case: { id: '8a09ba2c-0231-4cc3-b02d-5b90054d6f90' } },
            });

            const eventLog = await repo
                .connection('event_logs')
                .where({ event_name: 'ws-rest-flows.executed', aggregate_id: flow.id.value })
                .first();

            const { map_property } = eventLog.body.steps_executed[0].metadata;

            expect(map_property.from).toBe('case.nonexistent.field');
            expect(map_property.found).toBe(false);
            expect(map_property.value).toBeUndefined();
        });
    });

    it('should extract event_logger_case_id from context when caseId is not provided in initial_context', async () => {
        await TenantContext.run(tenant, async () => {
            const flow = await WSRestFlowMother.create(flowRepo);

            const mapFn = await WSRestFunctionMother.create(functionRepo, {
                type: 'mapProperty',
                filter_input: { filter_input: [] },
                context_position: 'event_logger_case_id',
                value_dynamic: true,
                value_static: 'case.new_id',
            });

            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                function_id: mapFn.id.value,
                order: 1,
            });

            const newCaseId = '9b09ba2d-abc1-4cc3-b02d-5b90054d6f99';
            await executor.execute({
                flow_id: flow.id.value,
                initial_context: { case: { new_id: newCaseId } },
            });

            const eventLog = await repo
                .connection('event_logs')
                .where({ event_name: 'ws-rest-flows.executed', aggregate_id: flow.id.value })
                .first();

            expect(eventLog.case_id).toBe(newCaseId);
        });
    });

    it('sends plain text body with context variable correctly replaced', async () => {
        await TenantContext.run(tenant, async () => {
            const flow = await WSRestFlowMother.create(flowRepo);
            const endpoint = await WSRestEndpointMother.create(endpointRepo, {
                url: 'https://example.com/notify',
                method: 'POST',
                body: { body: 'context.data.message' },
                body_type: 'plain_text',
                is_dynamic_body: true,
                authorization_id: null,
            });

            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                endpoint_id: endpoint.id.value,
                order: 1,
            });

            jest.spyOn(httpClient, 'request').mockResolvedValue({
                status: 200,
                data: 'OK',
                headers: {},
            });

            await executor.execute({
                flow_id: flow.id.value,
                initial_context: { data: { message: 'hello world' } },
            });

            expect(httpClient.request).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'POST',
                    url: 'https://example.com/notify',
                    data: 'hello world',
                })
            );
        });
    });

    it('sends plain text body with static text (no context variable) unchanged', async () => {
        await TenantContext.run(tenant, async () => {
            const flow = await WSRestFlowMother.create(flowRepo);
            const endpoint = await WSRestEndpointMother.create(endpointRepo, {
                url: 'https://example.com/notify',
                method: 'POST',
                body: { body: 'static plain text payload' },
                body_type: 'plain_text',
                is_dynamic_body: false,
                authorization_id: null,
            });

            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                endpoint_id: endpoint.id.value,
                order: 1,
            });

            jest.spyOn(httpClient, 'request').mockResolvedValue({
                status: 200,
                data: 'OK',
                headers: {},
            });

            await executor.execute({ flow_id: flow.id.value });

            expect(httpClient.request).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'POST',
                    url: 'https://example.com/notify',
                    data: 'static plain text payload',
                })
            );
        });
    });

    describe('plain text body with array and object context values', () => {
        it('sends the full array as plain text body when context variable resolves to an array of objects', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepo);
                const endpoint = await WSRestEndpointMother.create(endpointRepo, {
                    url: 'https://example.com/bulk',
                    method: 'POST',
                    body: { body: 'context.items' },
                    body_type: 'plain_text',
                    is_dynamic_body: true,
                    authorization_id: null,
                });

                await WSRestWorkflowStepMother.createEndpointStep(repo, {
                    flow_id: flow.id.value,
                    endpoint_id: endpoint.id.value,
                    order: 1,
                });

                jest.spyOn(httpClient, 'request').mockResolvedValue({ status: 200, data: 'OK', headers: {} });

                await executor.execute({
                    flow_id: flow.id.value,
                    initial_context: {
                        items: [
                            { id: 'a1', value: 10 },
                            { id: 'a2', value: 20 },
                            { id: 'a3', value: 30 },
                        ],
                    },
                });

                expect(httpClient.request).toHaveBeenCalledWith(
                    expect.objectContaining({
                        method: 'POST',
                        url: 'https://example.com/bulk',
                        data: [
                            { id: 'a1', value: 10 },
                            { id: 'a2', value: 20 },
                            { id: 'a3', value: 30 },
                        ],
                    })
                );
            });
        });

        it('sends the full object as plain text body when context variable resolves to an object', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepo);
                const endpoint = await WSRestEndpointMother.create(endpointRepo, {
                    url: 'https://example.com/payload',
                    method: 'POST',
                    body: { body: 'context.datos' },
                    body_type: 'plain_text',
                    is_dynamic_body: true,
                    authorization_id: null,
                });

                await WSRestWorkflowStepMother.createEndpointStep(repo, {
                    flow_id: flow.id.value,
                    endpoint_id: endpoint.id.value,
                    order: 1,
                });

                jest.spyOn(httpClient, 'request').mockResolvedValue({ status: 200, data: 'OK', headers: {} });

                await executor.execute({
                    flow_id: flow.id.value,
                    initial_context: { datos: { action: 'create', priority: 1 } },
                });

                expect(httpClient.request).toHaveBeenCalledWith(
                    expect.objectContaining({
                        method: 'POST',
                        url: 'https://example.com/payload',
                        data: { action: 'create', priority: 1 },
                    })
                );
            });
        });
    });

    it('normalizes Channel Hub tag rules before sending the create-tag endpoint body', async () => {
        await TenantContext.run(tenant, async () => {
            const flow = await WSRestFlowMother.create(flowRepo);

            const normalizer = await WSRestFunctionMother.create(functionRepo, {
                type: 'normalizeChannelHubRule',
                filter_input: { filter_input: ['channel_hub_tag'] },
                context_position: 'channel_hub_tag_request',
                value_dynamic: false,
                value_static: null,
            });

            const endpoint = await WSRestEndpointMother.create(endpointRepo, {
                url: 'https://api.konecta.cloud/one-channel-hub/tst/v1/channel/email/rule',
                method: 'POST',
                headers: { headers: { Authorization: 'Bearer token' } },
                body: { body: 'context.channel_hub_tag_request' },
                body_type: 'json',
                is_dynamic_body: true,
                authorization_id: null,
                filter_input: { filter_input: [] },
                context_position: 'channel_hub_tag.response',
            });

            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                function_id: normalizer.id.value,
                order: 1,
            });
            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                endpoint_id: endpoint.id.value,
                order: 2,
            });

            jest.spyOn(httpClient, 'request').mockResolvedValue({ status: 201, data: { id: 'rule-id' }, headers: {} });

            const context = await executor.execute({
                flow_id: flow.id.value,
                initial_context: {
                    channel_hub_tag: {
                        connectionId: 'connection-id',
                        ruleName: 'support',
                        subjectContains: ['billing'],
                        subjectEquals: ['Billing exact'],
                        bodyContains: [],
                        bodyEquals: ['urgent'],
                        actionRules: { classifyAs: 'support' },
                    },
                },
            });

            expect(context.get().context.channel_hub_tag_request).toEqual({
                connectionId: 'connection-id',
                ruleName: 'support',
                subjectContains: ['billing'],
                bodyEquals: ['urgent'],
                actionRules: { classifyAs: 'support' },
            });

            expect(httpClient.request).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'POST',
                    url: 'https://api.konecta.cloud/one-channel-hub/tst/v1/channel/email/rule',
                    data: {
                        connectionId: 'connection-id',
                        ruleName: 'support',
                        subjectContains: ['billing'],
                        bodyEquals: ['urgent'],
                        actionRules: { classifyAs: 'support' },
                    },
                })
            );
        });
    });

    describe('stringEmpty / stringNotEmpty conditional operators', () => {
        it('stringEmpty evaluates to true when value is empty string', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepo);
                const conditional = await WSRestConditionalMother.create(conditionalRepo, {
                    operator: 'stringEmpty',
                    input_path_a: 'str_value',
                    input_path_b: null,
                });
                await WSRestWorkflowStepMother.createEndpointStep(repo, {
                    flow_id: flow.id.value,
                    conditional_id: conditional.id.value,
                    order: 1,
                });

                await executor.execute({ flow_id: flow.id.value, initial_context: { str_value: '' } });

                const eventLog = await repo
                    .connection('event_logs')
                    .where({ event_name: 'ws-rest-flows.executed', aggregate_id: flow.id.value })
                    .first();
                expect(eventLog.body.steps_executed[0]).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: true, operator: 'stringEmpty' },
                });
            });
        });

        it('stringEmpty evaluates to false when value is a non-empty string', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepo);
                const conditional = await WSRestConditionalMother.create(conditionalRepo, {
                    operator: 'stringEmpty',
                    input_path_a: 'str_value',
                    input_path_b: null,
                });
                await WSRestWorkflowStepMother.createEndpointStep(repo, {
                    flow_id: flow.id.value,
                    conditional_id: conditional.id.value,
                    order: 1,
                });

                await executor.execute({ flow_id: flow.id.value, initial_context: { str_value: 'hello' } });

                const eventLog = await repo
                    .connection('event_logs')
                    .where({ event_name: 'ws-rest-flows.executed', aggregate_id: flow.id.value })
                    .first();
                expect(eventLog.body.steps_executed[0]).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: false, operator: 'stringEmpty' },
                });
            });
        });

        it('stringEmpty evaluates to true when value is null', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepo);
                const conditional = await WSRestConditionalMother.create(conditionalRepo, {
                    operator: 'stringEmpty',
                    input_path_a: 'str_value',
                    input_path_b: null,
                });
                await WSRestWorkflowStepMother.createEndpointStep(repo, {
                    flow_id: flow.id.value,
                    conditional_id: conditional.id.value,
                    order: 1,
                });

                await executor.execute({ flow_id: flow.id.value, initial_context: { str_value: null } });

                const eventLog = await repo
                    .connection('event_logs')
                    .where({ event_name: 'ws-rest-flows.executed', aggregate_id: flow.id.value })
                    .first();
                expect(eventLog.body.steps_executed[0]).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: true, operator: 'stringEmpty' },
                });
            });
        });

        it('stringNotEmpty evaluates to true when value is a non-empty string', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepo);
                const conditional = await WSRestConditionalMother.create(conditionalRepo, {
                    operator: 'stringNotEmpty',
                    input_path_a: 'str_value',
                    input_path_b: null,
                });
                await WSRestWorkflowStepMother.createEndpointStep(repo, {
                    flow_id: flow.id.value,
                    conditional_id: conditional.id.value,
                    order: 1,
                });

                await executor.execute({ flow_id: flow.id.value, initial_context: { str_value: 'hello' } });

                const eventLog = await repo
                    .connection('event_logs')
                    .where({ event_name: 'ws-rest-flows.executed', aggregate_id: flow.id.value })
                    .first();
                expect(eventLog.body.steps_executed[0]).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: true, operator: 'stringNotEmpty' },
                });
            });
        });

        it('stringNotEmpty evaluates to false when value is empty string', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepo);
                const conditional = await WSRestConditionalMother.create(conditionalRepo, {
                    operator: 'stringNotEmpty',
                    input_path_a: 'str_value',
                    input_path_b: null,
                });
                await WSRestWorkflowStepMother.createEndpointStep(repo, {
                    flow_id: flow.id.value,
                    conditional_id: conditional.id.value,
                    order: 1,
                });

                await executor.execute({ flow_id: flow.id.value, initial_context: { str_value: '' } });

                const eventLog = await repo
                    .connection('event_logs')
                    .where({ event_name: 'ws-rest-flows.executed', aggregate_id: flow.id.value })
                    .first();
                expect(eventLog.body.steps_executed[0]).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: false, operator: 'stringNotEmpty' },
                });
            });
        });

        it('stringNotEmpty evaluates to false when value is null', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepo);
                const conditional = await WSRestConditionalMother.create(conditionalRepo, {
                    operator: 'stringNotEmpty',
                    input_path_a: 'str_value',
                    input_path_b: null,
                });
                await WSRestWorkflowStepMother.createEndpointStep(repo, {
                    flow_id: flow.id.value,
                    conditional_id: conditional.id.value,
                    order: 1,
                });

                await executor.execute({ flow_id: flow.id.value, initial_context: { str_value: null } });

                const eventLog = await repo
                    .connection('event_logs')
                    .where({ event_name: 'ws-rest-flows.executed', aggregate_id: flow.id.value })
                    .first();
                expect(eventLog.body.steps_executed[0]).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: false, operator: 'stringNotEmpty' },
                });
            });
        });

        it('stringEmpty evaluates to true when key is missing from context (undefined)', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepo);
                const conditional = await WSRestConditionalMother.create(conditionalRepo, {
                    operator: 'stringEmpty',
                    input_path_a: 'nonexistent_key',
                    input_path_b: null,
                });
                await WSRestWorkflowStepMother.createEndpointStep(repo, {
                    flow_id: flow.id.value,
                    conditional_id: conditional.id.value,
                    order: 1,
                });

                await executor.execute({ flow_id: flow.id.value, initial_context: {} });

                const eventLog = await repo
                    .connection('event_logs')
                    .where({ event_name: 'ws-rest-flows.executed', aggregate_id: flow.id.value })
                    .first();
                expect(eventLog.body.steps_executed[0]).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: false, operator: 'stringEmpty' },
                });
            });
        });
    });

    describe('jsonEmpty / jsonNotEmpty conditional operators', () => {
        const runConditional = async ({ operator, input_path_a, initial_context }) => {
            const flow = await WSRestFlowMother.create(flowRepo);
            const conditional = await WSRestConditionalMother.create(conditionalRepo, {
                operator,
                input_path_a,
                input_path_b: null,
            });
            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                conditional_id: conditional.id.value,
                order: 1,
            });

            await executor.execute({ flow_id: flow.id.value, initial_context });

            const eventLog = await repo
                .connection('event_logs')
                .where({ event_name: 'ws-rest-flows.executed', aggregate_id: flow.id.value })
                .first();
            return eventLog.body.steps_executed[0];
        };

        it('jsonEmpty evaluates to true when value is an empty object {}', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'jsonEmpty',
                    input_path_a: 'existencia',
                    initial_context: { existencia: {} },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: true, operator: 'jsonEmpty' },
                });
            });
        });

        it('jsonEmpty evaluates to false when object has keys', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'jsonEmpty',
                    input_path_a: 'existencia',
                    initial_context: { existencia: { id: 1, name: 'x' } },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: false, operator: 'jsonEmpty' },
                });
            });
        });

        it('jsonEmpty evaluates to true when key is missing from context', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'jsonEmpty',
                    input_path_a: 'existencia',
                    initial_context: {},
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: true, operator: 'jsonEmpty' },
                });
            });
        });

        it('jsonEmpty evaluates to true when value is an empty array []', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'jsonEmpty',
                    input_path_a: 'existencia',
                    initial_context: { existencia: [] },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: true, operator: 'jsonEmpty' },
                });
            });
        });

        it('jsonEmpty evaluates to false when value is an array with items', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'jsonEmpty',
                    input_path_a: 'existencia',
                    initial_context: { existencia: [{ a: 1 }] },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: false, operator: 'jsonEmpty' },
                });
            });
        });

        it('jsonNotEmpty evaluates to true when object has keys', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'jsonNotEmpty',
                    input_path_a: 'existencia',
                    initial_context: { existencia: { id: 1 } },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: true, operator: 'jsonNotEmpty' },
                });
            });
        });

        it('jsonNotEmpty evaluates to false when value is an empty object {}', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'jsonNotEmpty',
                    input_path_a: 'existencia',
                    initial_context: { existencia: {} },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: false, operator: 'jsonNotEmpty' },
                });
            });
        });
    });

    describe('gte conditional operator (numeric, boolean and nested-path scenarios)', () => {
        const runConditional = async ({ operator, input_path_a, input_path_b, initial_context }) => {
            const flow = await WSRestFlowMother.create(flowRepo);
            const conditional = await WSRestConditionalMother.create(conditionalRepo, {
                operator,
                input_path_a,
                input_path_b,
            });
            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                conditional_id: conditional.id.value,
                order: 1,
            });

            await executor.execute({ flow_id: flow.id.value, initial_context });

            const eventLog = await repo
                .connection('event_logs')
                .where({ event_name: 'ws-rest-flows.executed', aggregate_id: flow.id.value })
                .first();
            return eventLog.body.steps_executed[0];
        };

        it('gte evaluates to true when boolean true is compared against "1"', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'gte',
                    input_path_a: 'flag',
                    input_path_b: '1',
                    initial_context: { flag: true },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: true, operator: 'gte' },
                });
            });
        });

        it('gte evaluates to false when boolean false is compared against "1"', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'gte',
                    input_path_a: 'flag',
                    input_path_b: '1',
                    initial_context: { flag: false },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: false, operator: 'gte' },
                });
            });
        });

        it('gte evaluates to true with plain numbers (10 >= 5)', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'gte',
                    input_path_a: 'n',
                    input_path_b: '5',
                    initial_context: { n: 10 },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: true, operator: 'gte' },
                });
            });
        });

        it('gte evaluates to true with stringified numeric value ("10" >= 5)', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'gte',
                    input_path_a: 'n',
                    input_path_b: '5',
                    initial_context: { n: '10' },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: true, operator: 'gte' },
                });
            });
        });

        it('gte resolves nested array path bot_ofertamiento.data[0].estado (true >= 1)', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'gte',
                    input_path_a: 'bot_ofertamiento.data[0].estado',
                    input_path_b: '1',
                    initial_context: { bot_ofertamiento: { data: [{ estado: true }] } },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: true, operator: 'gte' },
                });
            });
        });

        it('gte resolves nested array path bot_ofertamiento.data[0].estado (false >= 1 → false)', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'gte',
                    input_path_a: 'bot_ofertamiento.data[0].estado',
                    input_path_b: '1',
                    initial_context: { bot_ofertamiento: { data: [{ estado: false }] } },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: false, operator: 'gte' },
                });
            });
        });

        it('gte resolves nested path with "context." prefix (matches user payload form)', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'gte',
                    input_path_a: 'context.bot_ofertamiento.data[0].estado',
                    input_path_b: '1',
                    initial_context: { bot_ofertamiento: { data: [{ estado: true }] } },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: true, operator: 'gte' },
                });
            });
        });
    });

    describe('null / notNull conditional operators', () => {
        const runConditional = async ({ operator, input_path_a, initial_context }) => {
            const flow = await WSRestFlowMother.create(flowRepo);
            const conditional = await WSRestConditionalMother.create(conditionalRepo, {
                operator,
                input_path_a,
                input_path_b: null,
            });
            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                conditional_id: conditional.id.value,
                order: 1,
            });

            await executor.execute({ flow_id: flow.id.value, initial_context });

            const eventLog = await repo
                .connection('event_logs')
                .where({ event_name: 'ws-rest-flows.executed', aggregate_id: flow.id.value })
                .first();
            return eventLog.body.steps_executed[0];
        };

        it('null evaluates to true when field value is explicitly null', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'null',
                    input_path_a: 'case.prov_id_sur',
                    initial_context: { case: { prov_id_sur: null } },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: true, operator: 'null' },
                });
            });
        });

        it('null evaluates to true when field is absent from context (not always present)', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'null',
                    input_path_a: 'case.prov_id_sur',
                    initial_context: { case: { other_field: 'value' } },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: true, operator: 'null' },
                });
            });
        });

        it('null evaluates to true when the parent object is absent from context', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'null',
                    input_path_a: 'case.prov_id_sur',
                    initial_context: {},
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: true, operator: 'null' },
                });
            });
        });

        it('null evaluates to false when field has a value', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'null',
                    input_path_a: 'case.prov_id_sur',
                    initial_context: { case: { prov_id_sur: 'ABC-123' } },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: false, operator: 'null' },
                });
            });
        });

        it('notNull evaluates to true when field has a value', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'notNull',
                    input_path_a: 'case.prov_id_sur',
                    initial_context: { case: { prov_id_sur: 'ABC-123' } },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: true, operator: 'notNull' },
                });
            });
        });

        it('notNull evaluates to false when field is absent from context', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'notNull',
                    input_path_a: 'case.prov_id_sur',
                    initial_context: { case: { other_field: 'value' } },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: false, operator: 'notNull' },
                });
            });
        });

        it('notNull evaluates to false when field value is explicitly null', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'notNull',
                    input_path_a: 'case.prov_id_sur',
                    initial_context: { case: { prov_id_sur: null } },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: false, operator: 'notNull' },
                });
            });
        });

        it('null resolves with context. prefix when field is absent', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'null',
                    input_path_a: 'context.case.prov_id_sur',
                    initial_context: { case: { other_field: 'value' } },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: true, operator: 'null' },
                });
            });
        });
    });

    describe('date comparison conditional operators (gt, gte, lt, lte, between)', () => {
        const runConditional = async ({ operator, input_path_a, input_path_b, initial_context }) => {
            const flow = await WSRestFlowMother.create(flowRepo);
            const conditional = await WSRestConditionalMother.create(conditionalRepo, {
                operator,
                input_path_a,
                input_path_b,
            });
            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                conditional_id: conditional.id.value,
                order: 1,
            });

            await executor.execute({ flow_id: flow.id.value, initial_context });

            const eventLog = await repo
                .connection('event_logs')
                .where({ event_name: 'ws-rest-flows.executed', aggregate_id: flow.id.value })
                .first();
            return eventLog.body.steps_executed[0];
        };

        it('gt: "2025-04-07" > "2025-01-01" → true', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'gt',
                    input_path_a: 'date_a',
                    input_path_b: 'date_b',
                    initial_context: { date_a: '2025-04-07', date_b: '2025-01-01' },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: true, operator: 'gt' },
                });
            });
        });

        it('gt: "2025-01-01" > "2025-04-07" → false', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'gt',
                    input_path_a: 'date_a',
                    input_path_b: 'date_b',
                    initial_context: { date_a: '2025-01-01', date_b: '2025-04-07' },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: false, operator: 'gt' },
                });
            });
        });

        it('gte: equal dates → true', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'gte',
                    input_path_a: 'date_a',
                    input_path_b: 'date_b',
                    initial_context: { date_a: '2025-04-07', date_b: '2025-04-07' },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: true, operator: 'gte' },
                });
            });
        });

        it('lt: "2025-01-01" < "2025-04-07" → true', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'lt',
                    input_path_a: 'date_a',
                    input_path_b: 'date_b',
                    initial_context: { date_a: '2025-01-01', date_b: '2025-04-07' },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: true, operator: 'lt' },
                });
            });
        });

        it('lte: equal dates → true', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'lte',
                    input_path_a: 'date_a',
                    input_path_b: 'date_b',
                    initial_context: { date_a: '2025-04-07', date_b: '2025-04-07' },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: true, operator: 'lte' },
                });
            });
        });

        it('gt with full ISO timestamps: "2025-04-07T15:00:00Z" > "2025-04-07T10:00:00Z" → true', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'gt',
                    input_path_a: 'date_a',
                    input_path_b: 'date_b',
                    initial_context: {
                        date_a: '2025-04-07T15:00:00Z',
                        date_b: '2025-04-07T10:00:00Z',
                    },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: true, operator: 'gt' },
                });
            });
        });

        it('between: date within ["2025-01-01", "2025-12-31"] → true', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'between',
                    input_path_a: 'date_a',
                    input_path_b: 'wrapper',
                    initial_context: {
                        date_a: '2025-06-15',
                        wrapper: { range: ['2025-01-01', '2025-12-31'] },
                    },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: true, operator: 'between' },
                });
            });
        });

        it('between: date outside range → false', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'between',
                    input_path_a: 'date_a',
                    input_path_b: 'wrapper',
                    initial_context: {
                        date_a: '2026-01-15',
                        wrapper: { range: ['2025-01-01', '2025-12-31'] },
                    },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: false, operator: 'between' },
                });
            });
        });

        it('gt with Date instance vs ISO string in context → true', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'gt',
                    input_path_a: 'date_a',
                    input_path_b: 'date_b',
                    initial_context: {
                        date_a: new Date('2025-04-07T15:00:00Z'),
                        date_b: '2025-04-07T10:00:00Z',
                    },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: true, operator: 'gt' },
                });
            });
        });

        it('TZ: same UTC instant via Z and -05:00 offset → eq/gte true, gt false', async () => {
            await TenantContext.run(tenant, async () => {
                const eqStep = await runConditional({
                    operator: 'eq',
                    input_path_a: 'date_a',
                    input_path_b: 'date_b',
                    initial_context: {
                        date_a: '2025-04-07T15:00:00Z',
                        date_b: '2025-04-07T10:00:00-05:00',
                    },
                });
                expect(eqStep).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: false, operator: 'eq' },
                });

                const gteStep = await runConditional({
                    operator: 'gte',
                    input_path_a: 'date_a',
                    input_path_b: 'date_b',
                    initial_context: {
                        date_a: '2025-04-07T15:00:00Z',
                        date_b: '2025-04-07T10:00:00-05:00',
                    },
                });
                expect(gteStep).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: true, operator: 'gte' },
                });

                const gtStep = await runConditional({
                    operator: 'gt',
                    input_path_a: 'date_a',
                    input_path_b: 'date_b',
                    initial_context: {
                        date_a: '2025-04-07T15:00:00Z',
                        date_b: '2025-04-07T10:00:00-05:00',
                    },
                });
                expect(gtStep).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: false, operator: 'gt' },
                });
            });
        });

        it('TZ: "2025-04-07T10:00:00-05:00" (UTC 15:00) > "2025-04-07T10:00:00Z" (UTC 10:00) → true', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'gt',
                    input_path_a: 'date_a',
                    input_path_b: 'date_b',
                    initial_context: {
                        date_a: '2025-04-07T10:00:00-05:00',
                        date_b: '2025-04-07T10:00:00Z',
                    },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: true, operator: 'gt' },
                });
            });
        });

        it('between with mixed timezones: offset date inside UTC range → true', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'between',
                    input_path_a: 'date_a',
                    input_path_b: 'wrapper',
                    initial_context: {
                        date_a: '2025-06-15T10:00:00-05:00',
                        wrapper: { range: ['2025-01-01T00:00:00Z', '2025-12-31T23:59:59Z'] },
                    },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: true, operator: 'between' },
                });
            });
        });

        it('gt numeric: 10 > 5 → true (Number path preserved)', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'gt',
                    input_path_a: 'a',
                    input_path_b: '5',
                    initial_context: { a: 10 },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: true, operator: 'gt' },
                });
            });
        });

        it('lt numeric: 5 < 10 → true', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'lt',
                    input_path_a: 'a',
                    input_path_b: '10',
                    initial_context: { a: 5 },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: true, operator: 'lt' },
                });
            });
        });

        it('lte numeric: 5 <= 5 → true', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'lte',
                    input_path_a: 'a',
                    input_path_b: '5',
                    initial_context: { a: 5 },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: true, operator: 'lte' },
                });
            });
        });

        it('between numeric: 5 in [1, 10] → true', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'between',
                    input_path_a: 'a',
                    input_path_b: 'wrapper',
                    initial_context: { a: 5, wrapper: { range: [1, 10] } },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: true, operator: 'between' },
                });
            });
        });

        it('between numeric: 15 in [1, 10] → false', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'between',
                    input_path_a: 'a',
                    input_path_b: 'wrapper',
                    initial_context: { a: 15, wrapper: { range: [1, 10] } },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: false, operator: 'between' },
                });
            });
        });

        it('mixed date/number falls back to Number path: "2025-04-07" > "5" → false (NaN)', async () => {
            await TenantContext.run(tenant, async () => {
                const step = await runConditional({
                    operator: 'gt',
                    input_path_a: 'date_a',
                    input_path_b: '5',
                    initial_context: { date_a: '2025-04-07' },
                });
                expect(step).toMatchObject({
                    step_type: 'conditional',
                    metadata: { evaluated: true, result: false, operator: 'gt' },
                });
            });
        });
    });

    describe('Conditional branch pointing to tail of another conditional chain', () => {
        const buildBranchPointingToTailDiagram = () => {
            const ids = {
                input: '0',
                condANode: uuid(),
                condAData: uuid(),
                ep1Node: uuid(),
                ep1Data: uuid(),
                ep2Node: uuid(),
                ep2Data: uuid(),
                fn1Node: uuid(),
                fn1Data: uuid(),
                condBNode: uuid(),
                condBData: uuid(),
                epAltNode: uuid(),
                epAltData: uuid(),
            };
            return {
                ids,
                diagram: {
                    nodes: [
                        { id: ids.input, type: 'input', data: { type: 'input', label: 'start' } },
                        {
                            id: ids.condANode,
                            data: {
                                type: 'conditional',
                                id: ids.condAData,
                                label: 'if A',
                                filter: 'a',
                                value: 'YES',
                                conditionType: 'eq',
                            },
                        },
                        { id: ids.ep1Node, data: { type: 'endpoint', id: ids.ep1Data, label: 'ep1' } },
                        { id: ids.ep2Node, data: { type: 'endpoint', id: ids.ep2Data, label: 'ep2' } },
                        { id: ids.fn1Node, data: { type: 'function', id: ids.fn1Data, label: 'fn1' } },
                        {
                            id: ids.condBNode,
                            data: {
                                type: 'conditional',
                                id: ids.condBData,
                                label: 'if B',
                                filter: 'b',
                                value: 'YES',
                                conditionType: 'eq',
                            },
                        },
                        { id: ids.epAltNode, data: { type: 'endpoint', id: ids.epAltData, label: 'epAlt' } },
                    ],
                    edges: [
                        // Main flow: input -> condA -> condB
                        { id: uuid(), source: ids.input, target: ids.condANode },
                        { id: uuid(), source: ids.condANode, target: ids.condBNode, sourceHandle: 'no' },
                        // condA.yes chain: ep1 -> ep2 -> fn1
                        { id: uuid(), source: ids.condANode, target: ids.ep1Node, sourceHandle: 'yes' },
                        { id: uuid(), source: ids.ep1Node, target: ids.ep2Node },
                        { id: uuid(), source: ids.ep2Node, target: ids.fn1Node },
                        // condB.yes points directly to fn1 (the tail of condA's chain)
                        { id: uuid(), source: ids.condBNode, target: ids.fn1Node, sourceHandle: 'yes' },
                        // condB.no: alternative endpoint to keep the diagram valid
                        { id: uuid(), source: ids.condBNode, target: ids.epAltNode, sourceHandle: 'no' },
                    ],
                },
            };
        };

        it('runs ONLY fn1 (no ep1, no ep2) when condA evaluates false and condB evaluates true', async () => {
            await TenantContext.run(tenant, async () => {
                const { ids, diagram } = buildBranchPointingToTailDiagram();

                await WSRestEndpointMother.create(endpointRepo, {
                    id: ids.ep1Data,
                    url: 'https://example.invalid/ep1',
                    method: 'GET',
                    body: { body: {} },
                    authorization_id: null,
                });
                await WSRestEndpointMother.create(endpointRepo, {
                    id: ids.ep2Data,
                    url: 'https://example.invalid/ep2',
                    method: 'GET',
                    body: { body: {} },
                    authorization_id: null,
                });
                await WSRestEndpointMother.create(endpointRepo, {
                    id: ids.epAltData,
                    url: 'https://example.invalid/epAlt',
                    method: 'GET',
                    body: { body: {} },
                    authorization_id: null,
                });
                await WSRestFunctionMother.create(functionRepo, {
                    id: ids.fn1Data,
                    filter_input: { filter_input: [] },
                    type: 'formatDate',
                    context_position: 'fn1Result',
                    value_dynamic: false,
                    value_static: new Date().toISOString(),
                });

                const flowDto = {
                    id: uuid(),
                    description: `tail-branch-flow-${uuid()}`,
                    external_code: `tail_branch_${uuid()}`,
                    json_diagram_properties: diagram,
                    is_active: true,
                    is_primary: true,
                    created_at: new Date().toISOString(),
                    created_by: uuid(),
                };

                const creator = new WSRestFlowCreator(flowRepo, repo);
                await creator.execute(flowDto);

                jest.spyOn(httpClient, 'request').mockResolvedValue({
                    status: 200,
                    data: {},
                    headers: {},
                });

                await executor.execute({
                    flow_id: flowDto.id,
                    initial_context: { a: 'NO', b: 'YES' },
                });

                const eventLog = await repo
                    .connection('event_logs')
                    .where({ event_name: 'ws-rest-flows.executed', aggregate_id: flowDto.id })
                    .first();

                expect(eventLog).toBeDefined();
                const stepTypes = eventLog.body.steps_executed.map((s) => s.step_type);
                const endpointStepsExecuted = eventLog.body.steps_executed.filter((s) => s.step_type === 'endpoint');

                expect(endpointStepsExecuted).toHaveLength(0);
                expect(stepTypes).not.toContain('endpoint');
                expect(eventLog.body.execution_summary.endpoint_steps).toBe(0);
                expect(eventLog.body.execution_summary.function_steps).toBeGreaterThanOrEqual(1);
                expect(httpClient.request).not.toHaveBeenCalled();
            });
        });
    });

    describe('regexOr function step with missing context values', () => {
        const pattern = '^[a-z]+[0-9]+$';

        const buildRegexOrFlow = async () => {
            const flow = await WSRestFlowMother.create(flowRepo);
            const regexOrFunction = await WSRestFunctionMother.create(functionRepo, {
                description: 'regexOr con valores potencialmente ausentes en el contexto',
                type: 'regexOr',
                filter_input: { filter_input: ['path.a', 'path.b'] },
                context_position: 'regex_result',
                value_dynamic: false,
                value_static: pattern,
            });
            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                function_id: regexOrFunction.id.value,
                order: 1,
            });
            return flow;
        };

        it.each([
            {
                description: 'ambos paths existen, val1 cumple → retorna val1',
                initial_context: { path: { a: 'abc123', b: 'xyz' } },
                expected: 'abc123',
            },
            {
                description: 'path.a no existe en el contexto, val2 cumple → retorna val2',
                initial_context: { path: { b: 'world99' } },
                expected: 'world99',
            },
            {
                description: 'path.b no existe en el contexto, val1 cumple → retorna val1',
                initial_context: { path: { a: 'abc123' } },
                expected: 'abc123',
            },
            {
                description: 'ambos paths ausentes del contexto → retorna null',
                initial_context: {},
                expected: null,
            },
            {
                description: 'ambos paths existen pero ninguno cumple → retorna null',
                initial_context: { path: { a: 'HELLO', b: 'WORLD' } },
                expected: null,
            },
        ])('$description', async ({ initial_context, expected }) => {
            await TenantContext.run(tenant, async () => {
                const flow = await buildRegexOrFlow();

                const result = await executor.execute({
                    flow_id: flow.id.value,
                    initial_context,
                });

                const resultContext = result.get();
                expect(resultContext.context).toHaveProperty('regex_result', expected);
            });
        });
    });
});
