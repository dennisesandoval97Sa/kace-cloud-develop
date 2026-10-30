import { knexConfig } from '../knexfile.js';
import { v4 as uuid } from 'uuid';
import LocalTenantRepository from '../../src/tenant/infrastructure/local/LocalTenantRepository.js';
import { TenantContext } from '../../src/shared/infrastructure/context/TenantContext.js';
import { KnexWSRestWorkflowStepRepository } from '../../src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository.js';
import { KnexWSRestFlowRepository } from '../../src/ws-rest-flows/index.js';
import { KnexWSRestFunctionRepository } from '../../src/ws_rest_functions/infrastructure/persistence/KnexWSRestFunctionRepository.js';
import { KnexWSRestEndpointRepository } from '../../src/ws-rest-endpoints/infrastructure/persistence/KnexWSRestEndpointRepository.js';
import { KnexAllowedConnectionsRepository } from '../../src/allowed-conections/index.js';
import { KnexSecretsVaultRepository } from '../../src/secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository.js';
import { WorkflowExecutor } from '../../src/ws-rest-workflow-step/application/executor/WorkflowExecutor.js';
import WSRestFlowMother from '../ws-rest-flows/domain/WSRestFlowMother.js';
import WSRestFunctionMother from '../ws_rest_functions/domain/WSRestFunctionMother.js';
import WSRestEndpointMother from '../ws-rest-endpoints/domain/WSRestEndpointMother.js';
import { WSRestWorkflowStepCreator } from '../../src/ws-rest-workflow-step/application/create/WSRestWorkflowStepCreator.js';
import { AxiosHttpClient } from '../../src/shared/infrastructure/http/AxiosHttpClient.js';
import AllowedConnectionsMother from '../allowed-conections/domain/AllowedConnectionsMother.js';
import { HttpMethods } from '../../src/ws-rest-endpoints/domain/HttpMethods.js';
import { jest } from '@jest/globals';
import { WorkflowExecutorResponse } from '../../src/ws-rest-workflow-step/application/executor/WorkflowExecutorResponse.js';
import { Helper } from '../../src/shared/index.js';
import { EventPublisher } from '../../src/shared/application/events/EventPublisher.js';
import { SecretsVaultMother } from '../secrets-vault/domain/SecretsVaultMother.js';
import { SecretCreator } from '../../src/secrets-vault/index.js';
import { User } from '../../src/users/index.js';
import UsersMother from '../users/domain/UsersMother.js';

jest.mock('../../src/shared/infrastructure/http/AxiosHttpClient.js');
const findHookEvent = (publishSpy, code) =>
    publishSpy.mock.calls
        .map((call) => call[0])
        .find((event) => event?.payload?.externalCode === code || event?.payload?.flowId === code);
const tenant = await new LocalTenantRepository().find();
const cryptoParams = {
    secret_iv: process.env.SECRET_IV,
    secret_key: process.env.SECRET_KEY,
    encryption_method: process.env.ENCRYPTION_METHOD,
};
describe('WorkflowExecutor Integration Test', () => {
    const workflowStepRepository = new KnexWSRestWorkflowStepRepository(knexConfig);
    const flowRepository = new KnexWSRestFlowRepository(knexConfig);
    const functionRepository = new KnexWSRestFunctionRepository(knexConfig);
    const endpointRepository = new KnexWSRestEndpointRepository(knexConfig);
    const allowedConnectionRepository = new KnexAllowedConnectionsRepository(knexConfig);
    const secretRepository = new KnexSecretsVaultRepository(knexConfig);
    const currentUser = new User(UsersMother.dto());
    let publishSpy;

    beforeEach(async () => {
        jest.clearAllMocks();

        // Hook flows are dispatched via EventPublisher.publish; capture those calls.
        publishSpy = jest.spyOn(EventPublisher.prototype, 'publish').mockResolvedValue(undefined);

        await AllowedConnectionsMother.createAllowedConnection(allowedConnectionRepository, {
            connection: 'api.example.com',
            has_ssl: false,
        });

        AxiosHttpClient.prototype.request = jest.fn().mockImplementation(async ({ url, headers }) => {
            Helper.logInfo('Mocked request to:', url, 'with headers:', headers);
            if (url.includes('token')) {
                return {
                    status: 200,
                    data: { access_token: 'mocked-token-12345' },
                    headers: {},
                };
            } else if (url.includes('users')) {
                return {
                    status: 200,
                    data: [
                        { id: 1, name: 'Usuario 1' },
                        { id: 2, name: 'Usuario 2' },
                    ],
                    headers: {},
                };
            } else {
                return {
                    status: 404,
                    data: { error: 'Not found' },
                    headers: {},
                };
            }
        });
    });

    it('should execute a workflow with function steps to transform user data', async () => {
        await TenantContext.run(tenant, async () => {
            const flow = await WSRestFlowMother.create(flowRepository, {
                external_code: 'test_transform_users',
            });

            const authEndpoint = await WSRestEndpointMother.create(endpointRepository, {
                description: 'Endpoint de autenticación',
                url: 'https://api.example.com/token',
                method: HttpMethods.POST.value,
                headers: { headers: { 'Content-Type': 'application/json' } },
                body: { body: { username: 'test', password: 'password' } },
                is_dynamic_body: false,
                context_position: 'authToken',
                filter_input: { filter_input: ['access_token'] },
                on_success: { on_success: {} },
                on_error: { on_error: {} },
            });

            const usersEndpoint = await WSRestEndpointMother.create(endpointRepository, {
                description: 'Endpoint para obtener usuarios',
                url: 'https://api.example.com/users',
                method: HttpMethods.GET.value,
                headers: { headers: { Authorization: 'Bearer context.authToken.access_token' } },
                is_dynamic_header: true,
                filter_input: { filter_input: [] },
                context_position: 'users',
                authorization_id: authEndpoint.id.value,
                body: { body: {} },
                on_success: { on_success: {} },
                on_error: { on_error: {} },
            });

            const toUpperCaseFunction = await WSRestFunctionMother.create(functionRepository, {
                description: 'Convertir nombres a mayúsculas',
                type: 'toUpperCase',
                filter_input: { filter_input: ['users[0].name', 'users[1].name'] },
                context_position: 'results',
                value_dynamic: true,
                value_static: null,
            });

            const formatDateFunction = await WSRestFunctionMother.create(functionRepository, {
                description: 'Dar formato a la fecha',
                type: 'formatDate',
                filter_input: { filter_input: [] },
                context_position: 'results.currentDate',
                value_dynamic: false,
                value_static: new Date().toISOString(),
            });

            new SecretCreator(secretRepository, cryptoParams).execute({
                ...SecretsVaultMother.dto(),
                referencia: 'TEST',
                secreto: 'ESTE ES UN SECRETO SUPER SECRETO',
            });

            const secretFunction = await WSRestFunctionMother.create(functionRepository, {
                description: 'Enmascarar secreto',
                type: 'maskText',
                filter_input: { filter_input: [] },
                context_position: 'results.maskedSecret',
                value_dynamic: true,
                value_static: 'SECRET_TEST',
            });

            const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);

            await stepCreator.execute({
                id: uuid(),
                flow_id: flow.id.value,
                endpoint_id: usersEndpoint.id.value,
                function_id: null,
                order: 1,
                created_by: uuid(),
                created_at: new Date().toISOString(),
            });

            await stepCreator.execute({
                id: uuid(),
                flow_id: flow.id.value,
                endpoint_id: null,
                function_id: toUpperCaseFunction.id.value,
                order: 2,
                created_by: uuid(),
                created_at: new Date().toISOString(),
            });

            await stepCreator.execute({
                id: uuid(),
                flow_id: flow.id.value,
                endpoint_id: null,
                function_id: formatDateFunction.id.value,
                order: 3,
                created_by: uuid(),
                created_at: new Date().toISOString(),
            });

            await stepCreator.execute({
                id: uuid(),
                flow_id: flow.id.value,
                endpoint_id: null,
                function_id: secretFunction.id.value,
                order: 4,
                created_by: uuid(),
                created_at: new Date().toISOString(),
            });

            const workflowExecutor = new WorkflowExecutor(
                workflowStepRepository,
                allowedConnectionRepository,
                secretRepository,
                currentUser
            );

            const response = await workflowExecutor.execute({
                external_code: 'test_transform_users',
            });

            expect(AxiosHttpClient.prototype.request).toHaveBeenCalledTimes(2);
            expect(AxiosHttpClient.prototype.request).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    url: 'https://api.example.com/token',
                    method: HttpMethods.POST.value,
                    headers: { 'Content-Type': 'application/json' },
                    data: { username: 'test', password: 'password' },
                })
            );
            expect(AxiosHttpClient.prototype.request).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({
                    url: 'https://api.example.com/users',
                    method: HttpMethods.GET.value,
                    headers: { Authorization: 'Bearer mocked-token-12345' },
                })
            );

            expect(response).toBeInstanceOf(WorkflowExecutorResponse);

            const responseJson = response.toJson();
            expect(responseJson).toHaveProperty('data');
            expect(responseJson).toHaveProperty('data.context');
            expect(responseJson).toHaveProperty('metadata');
            expect(responseJson).toHaveProperty('metadata.timestamp');

            expect(responseJson.data.context).toHaveProperty('users');
            expect(Array.isArray(responseJson.data.context.users)).toBeTruthy();
            expect(responseJson.data.context.users.length).toBe(2);
            expect(responseJson.data.context.users[0]).toHaveProperty('id', 1);
            expect(responseJson.data.context.users[0]).toHaveProperty('name', 'Usuario 1');

            expect(responseJson.data.context.results).toHaveProperty('name', ['USUARIO 1', 'USUARIO 2']);

            expect(responseJson.data.context.results).toHaveProperty('currentDate');
            expect(new Date(responseJson.data.context.results.currentDate)).toBeInstanceOf(Date);

            expect(responseJson.data.context.results).toHaveProperty('maskedSecret');
            const maskedSecret = responseJson.data.context.results.maskedSecret;
            expect(typeof maskedSecret).toBe('string');

            // Verificar que el secreto está correctamente enmascarado (no debe contener el texto original)
            const originalSecret = 'ESTE ES UN SECRETO SUPER SECRETO';
            expect(maskedSecret).not.toContain(originalSecret);
            expect(maskedSecret).toMatch(/^\*+RETO$/);
        }); // end TenantContext.run
    });

    it('should handle parallel execution of success hooks calling complete workflows', async () => {
        await TenantContext.run(tenant, async () => {
            const mainFlow = await WSRestFlowMother.create(flowRepository, {
                external_code: 'test_main_flow',
            });

            const hookFlow = await WSRestFlowMother.create(flowRepository, {
                external_code: 'success_hook_flow',
            });

            const mainEndpoint = await WSRestEndpointMother.create(endpointRepository, {
                description: 'Endpoint principal',
                url: 'https://api.example.com/users',
                method: HttpMethods.GET.value,
                headers: { headers: { 'Content-Type': 'application/json' } },
                body: { body: {} },
                filter_input: { filter_input: [] },
                context_position: 'mainResult',
                on_success: { on_success: { 200: 'success_hook_flow' } },
                on_error: { on_error: {} },
            });

            const hookEndpoint = await WSRestEndpointMother.create(endpointRepository, {
                description: 'Endpoint del hook',
                url: 'https://api.example.com/hook',
                method: HttpMethods.POST.value,
                context_position: 'hookResult',
                on_success: { on_success: {} },
                on_error: { on_error: {} },
            });

            // Configurar pasos para el flujo principal
            const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);

            await stepCreator.execute({
                id: uuid(),
                flow_id: mainFlow.id.value,
                endpoint_id: mainEndpoint.id.value,
                function_id: null,
                order: 1,
                created_by: uuid(),
                created_at: new Date().toISOString(),
            });

            // Configurar pasos para el flujo hook
            await stepCreator.execute({
                id: uuid(),
                flow_id: hookFlow.id.value,
                endpoint_id: hookEndpoint.id.value,
                function_id: null,
                order: 1,
                created_by: uuid(),
                created_at: new Date().toISOString(),
            });

            const requestSpy = jest.spyOn(AxiosHttpClient.prototype, 'request').mockImplementation(async ({ url }) => {
                Helper.logInfo(`Mocked request to: ${url}`);

                if (url.includes('hook')) {
                    return {
                        status: 200,
                        data: { hookExecuted: true },
                        headers: {},
                    };
                }

                return {
                    status: 200,
                    data: { result: 'default' },
                    headers: {},
                };
            });

            const workflowExecutor = new WorkflowExecutor(
                workflowStepRepository,
                allowedConnectionRepository,
                secretRepository,
                currentUser
            );

            const response = await workflowExecutor.execute({
                external_code: 'test_main_flow',
            });

            expect(response).toBeInstanceOf(WorkflowExecutorResponse);
            const responseJson = response.toJson();
            expect(responseJson.data.context).toHaveProperty('mainResult');

            // The success hook requests the secondary flow via a published domain event.
            const hookEvent = findHookEvent(publishSpy, 'success_hook_flow');
            expect(hookEvent).toBeDefined();
            expect(hookEvent.payload.externalCode).toBe('success_hook_flow');
            expect(hookEvent.payload.initialContext).toEqual(
                expect.objectContaining({
                    trigger_success: {
                        endpoint_id: mainEndpoint.id.value,
                        status: 200,
                    },
                })
            );

            requestSpy.mockRestore();
        }); // end TenantContext.run
    });

    it('should handle error hooks with complete workflow execution and terminate the main flow', async () => {
        await TenantContext.run(tenant, async () => {
            const mainFlow = await WSRestFlowMother.create(flowRepository, {
                external_code: 'test_error_flow',
            });

            const errorHookFlow = await WSRestFlowMother.create(flowRepository, {
                external_code: 'error_hook_flow',
            });

            const mainEndpoint = await WSRestEndpointMother.create(endpointRepository, {
                description: 'Endpoint principal con error',
                url: 'https://api.example.com/error-endpoint',
                method: HttpMethods.GET.value,
                headers: { headers: { 'Content-Type': 'application/json' } },
                body: { body: {} },
                context_position: 'mainResult',
                on_success: { on_success: {} },
                on_error: { on_error: { 404: 'error_hook_flow' } },
            });

            const errorHookEndpoint = await WSRestEndpointMother.create(endpointRepository, {
                description: 'Endpoint para manejar errores',
                url: 'https://api.example.com/handle-error',
                method: HttpMethods.POST.value,
                context_position: 'errorHandled',
                on_success: { on_success: {} },
                on_error: { on_error: {} },
            });

            // Crear función que registra el error
            const errorFunction = await WSRestFunctionMother.create(functionRepository, {
                description: 'Formato de fecha para el error',
                type: 'formatDate',
                context_position: 'errorHandled.date',
                value_dynamic: false,
                value_static: new Date().toISOString(),
            });

            // Crear función que nunca debería ejecutarse en el flujo principal
            const mainFunction = await WSRestFunctionMother.create(functionRepository, {
                description: 'Esta función no debería ejecutarse',
                type: 'formatDate',
                context_position: 'shouldNotExecute',
                value_dynamic: false,
                value_static: 'No debería verse esto',
            });

            // Configurar pasos para el flujo principal
            const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);

            await stepCreator.execute({
                id: uuid(),
                flow_id: mainFlow.id.value,
                endpoint_id: mainEndpoint.id.value,
                function_id: null,
                order: 1,
                created_by: uuid(),
                created_at: new Date().toISOString(),
            });

            // Este paso no debería ejecutarse por el error
            await stepCreator.execute({
                id: uuid(),
                flow_id: mainFlow.id.value,
                endpoint_id: null,
                function_id: mainFunction.id.value,
                order: 2,
                created_by: uuid(),
                created_at: new Date().toISOString(),
            });

            // Configurar pasos para el flujo de error
            await stepCreator.execute({
                id: uuid(),
                flow_id: errorHookFlow.id.value,
                endpoint_id: errorHookEndpoint.id.value,
                function_id: null,
                order: 1,
                created_by: uuid(),
                created_at: new Date().toISOString(),
            });

            await stepCreator.execute({
                id: uuid(),
                flow_id: errorHookFlow.id.value,
                endpoint_id: null,
                function_id: errorFunction.id.value,
                order: 2,
                created_by: uuid(),
                created_at: new Date().toISOString(),
            });

            const requestSpy = jest.spyOn(AxiosHttpClient.prototype, 'request').mockImplementation(async () => {
                return {
                    status: 404,
                    data: { error: 'Not found' },
                    headers: {},
                };
            });

            const workflowExecutor = new WorkflowExecutor(
                workflowStepRepository,
                allowedConnectionRepository,
                secretRepository,
                currentUser
            );

            await expect(
                workflowExecutor.execute({
                    external_code: 'test_error_flow',
                    initial_context: { case: { id: 'case-123' } },
                })
            ).rejects.toMatchObject({
                statusCode: 400,
                fields: expect.objectContaining({
                    reason: 'error_condition_triggered',
                    triggered_flow: 'error_hook_flow',
                    status: 404,
                }),
            });

            // The error hook requests the configured flow via a published domain event and terminates the main flow.
            const hookEvent = findHookEvent(publishSpy, 'error_hook_flow');
            expect(hookEvent).toBeDefined();
            expect(hookEvent.payload.externalCode).toBe('error_hook_flow');

            // The hook flow receives the main flow's context plus the trigger_error block.
            expect(hookEvent.payload.initialContext).toEqual(
                expect.objectContaining({
                    case: { id: 'case-123' },
                    trigger_error: {
                        endpoint_id: mainEndpoint.id.value,
                        status: 404,
                        response_data: { error: 'Not found' },
                    },
                })
            );

            requestSpy.mockRestore();
        }); // end TenantContext.run
    });

    describe('multiple response conditions', () => {
        // An endpoint configured with MORE THAN ONE condition (e.g. 401, 500, 504 all mapped to the
        // same flow). Hook flows are requested by publishing a WSRestFlowExecutionRequested event.

        it.each([401, 500, 504])(
            'should match each of the multiple error conditions and terminate the main flow (status %i)',
            async (status) => {
                await TenantContext.run(tenant, async () => {
                    const mainFlow = await WSRestFlowMother.create(flowRepository, {
                        external_code: 'test_multi_error_flow',
                    });
                    await WSRestFlowMother.create(flowRepository, {
                        external_code: 'flow_alert_mail_fail_auth_offer',
                    });

                    const mainEndpoint = await WSRestEndpointMother.create(endpointRepository, {
                        description: 'Endpoint con múltiples condiciones de error',
                        url: 'https://api.example.com/multi-error-endpoint',
                        method: HttpMethods.GET.value,
                        headers: { headers: { 'Content-Type': 'application/json' } },
                        body: { body: {} },
                        context_position: 'mainResult',
                        on_success: { on_success: {} },
                        on_error: {
                            on_error: {
                                401: 'flow_alert_mail_fail_auth_offer',
                                500: 'flow_alert_mail_fail_auth_offer',
                                504: 'flow_alert_mail_fail_auth_offer',
                            },
                        },
                    });

                    const mainFunction = await WSRestFunctionMother.create(functionRepository, {
                        description: 'Esta función no debería ejecutarse',
                        type: 'formatDate',
                        context_position: 'shouldNotExecute',
                        value_dynamic: false,
                        value_static: 'No debería verse esto',
                    });

                    const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                    await stepCreator.execute({
                        id: uuid(),
                        flow_id: mainFlow.id.value,
                        endpoint_id: mainEndpoint.id.value,
                        function_id: null,
                        order: 1,
                        created_by: uuid(),
                        created_at: new Date().toISOString(),
                    });
                    await stepCreator.execute({
                        id: uuid(),
                        flow_id: mainFlow.id.value,
                        endpoint_id: null,
                        function_id: mainFunction.id.value,
                        order: 2,
                        created_by: uuid(),
                        created_at: new Date().toISOString(),
                    });

                    const requestSpy = jest.spyOn(AxiosHttpClient.prototype, 'request').mockImplementation(async () => {
                        return { status, data: { error: 'failed' }, headers: {} };
                    });

                    const workflowExecutor = new WorkflowExecutor(
                        workflowStepRepository,
                        allowedConnectionRepository,
                        secretRepository,
                        currentUser
                    );

                    await expect(
                        workflowExecutor.execute({ external_code: 'test_multi_error_flow' })
                    ).rejects.toMatchObject({
                        statusCode: 400,
                        fields: expect.objectContaining({
                            reason: 'error_condition_triggered',
                            triggered_flow: 'flow_alert_mail_fail_auth_offer',
                            status,
                        }),
                    });

                    const hookEvent = findHookEvent(publishSpy, 'flow_alert_mail_fail_auth_offer');
                    expect(hookEvent).toBeDefined();
                    expect(hookEvent.payload.externalCode).toBe('flow_alert_mail_fail_auth_offer');
                    expect(hookEvent.payload.initialContext).toEqual(
                        expect.objectContaining({
                            trigger_error: {
                                endpoint_id: mainEndpoint.id.value,
                                status,
                                response_data: { error: 'failed' },
                            },
                        })
                    );

                    requestSpy.mockRestore();
                }); // end TenantContext.run
            }
        );

        it('should truncate the hook context to trigger metadata when it exceeds the SQS size limit', async () => {
            await TenantContext.run(tenant, async () => {
                const mainFlow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_oversized_context_flow',
                });
                await WSRestFlowMother.create(flowRepository, {
                    external_code: 'flow_alert_mail_fail_auth_offer',
                });

                const mainEndpoint = await WSRestEndpointMother.create(endpointRepository, {
                    description: 'Endpoint con contexto gigante',
                    url: 'https://api.example.com/oversized-context',
                    method: HttpMethods.GET.value,
                    headers: { headers: { 'Content-Type': 'application/json' } },
                    body: { body: {} },
                    context_position: 'mainResult',
                    on_success: { on_success: {} },
                    on_error: { on_error: { 500: 'flow_alert_mail_fail_auth_offer' } },
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: mainFlow.id.value,
                    endpoint_id: mainEndpoint.id.value,
                    function_id: null,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const requestSpy = jest.spyOn(AxiosHttpClient.prototype, 'request').mockImplementation(async () => {
                    return { status: 500, data: { error: 'failed' }, headers: {} };
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                await expect(
                    workflowExecutor.execute({
                        external_code: 'test_oversized_context_flow',
                        initial_context: { huge: 'x'.repeat(250 * 1024) },
                    })
                ).rejects.toMatchObject({
                    statusCode: 400,
                    fields: expect.objectContaining({ reason: 'error_condition_triggered' }),
                });

                const hookEvent = findHookEvent(publishSpy, 'flow_alert_mail_fail_auth_offer');
                expect(hookEvent).toBeDefined();
                expect(hookEvent.payload.initialContext).toEqual({
                    trigger_error: {
                        endpoint_id: mainEndpoint.id.value,
                        status: 500,
                        response_data: null,
                    },
                });

                requestSpy.mockRestore();
            }); // end TenantContext.run
        });

        it('should NOT terminate the flow when the response status is not among the multiple error conditions', async () => {
            await TenantContext.run(tenant, async () => {
                const mainFlow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_multi_error_success_flow',
                });
                await WSRestFlowMother.create(flowRepository, {
                    external_code: 'flow_alert_mail_fail_auth_offer',
                });

                const mainEndpoint = await WSRestEndpointMother.create(endpointRepository, {
                    description: 'Endpoint con múltiples condiciones de error, respuesta exitosa',
                    url: 'https://api.example.com/multi-error-ok',
                    method: HttpMethods.GET.value,
                    headers: { headers: { 'Content-Type': 'application/json' } },
                    body: { body: {} },
                    filter_input: { filter_input: [] },
                    context_position: 'mainResult',
                    on_success: { on_success: {} },
                    on_error: {
                        on_error: {
                            401: 'flow_alert_mail_fail_auth_offer',
                            500: 'flow_alert_mail_fail_auth_offer',
                            504: 'flow_alert_mail_fail_auth_offer',
                        },
                    },
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: mainFlow.id.value,
                    endpoint_id: mainEndpoint.id.value,
                    function_id: null,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const requestSpy = jest.spyOn(AxiosHttpClient.prototype, 'request').mockImplementation(async () => {
                    return { status: 200, data: { result: 'ok' }, headers: {} };
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({ external_code: 'test_multi_error_success_flow' });

                expect(response).toBeInstanceOf(WorkflowExecutorResponse);

                // No condition matched the 200 response, so no hook flow event is published.
                expect(publishSpy).not.toHaveBeenCalled();

                requestSpy.mockRestore();
            }); // end TenantContext.run
        });

        it('should match each of the multiple success conditions and request the success hook (status 201)', async () => {
            await TenantContext.run(tenant, async () => {
                const mainFlow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_multi_success_flow',
                });
                await WSRestFlowMother.create(flowRepository, {
                    external_code: 'success_hook_flow',
                });

                const mainEndpoint = await WSRestEndpointMother.create(endpointRepository, {
                    description: 'Endpoint con múltiples condiciones de éxito',
                    url: 'https://api.example.com/multi-success',
                    method: HttpMethods.GET.value,
                    headers: { headers: { 'Content-Type': 'application/json' } },
                    body: { body: {} },
                    filter_input: { filter_input: [] },
                    context_position: 'mainResult',
                    on_success: { on_success: { 200: 'success_hook_flow', 201: 'success_hook_flow' } },
                    on_error: { on_error: {} },
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: mainFlow.id.value,
                    endpoint_id: mainEndpoint.id.value,
                    function_id: null,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const requestSpy = jest.spyOn(AxiosHttpClient.prototype, 'request').mockImplementation(async () => {
                    return { status: 201, data: { created: true }, headers: {} };
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({ external_code: 'test_multi_success_flow' });

                expect(response).toBeInstanceOf(WorkflowExecutorResponse);

                const hookEvent = findHookEvent(publishSpy, 'success_hook_flow');
                expect(hookEvent).toBeDefined();
                expect(hookEvent.payload.externalCode).toBe('success_hook_flow');

                requestSpy.mockRestore();
            }); // end TenantContext.run
        });

        it('should persist and rehydrate all keys of a multiple-condition on_error configuration', async () => {
            await TenantContext.run(tenant, async () => {
                const endpoint = await WSRestEndpointMother.create(endpointRepository, {
                    description: 'Endpoint persistencia múltiples condiciones',
                    url: 'https://api.example.com/multi-persist',
                    on_success: { on_success: {} },
                    on_error: {
                        on_error: {
                            401: 'flow_alert_mail_fail_auth_offer',
                            500: 'flow_alert_mail_fail_auth_offer',
                            504: 'flow_alert_mail_fail_auth_offer',
                        },
                    },
                });

                const rehydrated = await endpointRepository.find(endpoint.id);

                expect(rehydrated.on_error.value.on_error).toEqual({
                    401: 'flow_alert_mail_fail_auth_offer',
                    500: 'flow_alert_mail_fail_auth_offer',
                    504: 'flow_alert_mail_fail_auth_offer',
                });
            }); // end TenantContext.run
        });

        it('should request the configured error hook flow via a domain event (no authenticated HTTP call)', async () => {
            await TenantContext.run(tenant, async () => {
                const mainFlow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_hook_event_flow',
                });
                await WSRestFlowMother.create(flowRepository, {
                    external_code: 'flow_alert_mail_fail_auth_offer',
                });

                const mainEndpoint = await WSRestEndpointMother.create(endpointRepository, {
                    description: 'Endpoint que falla y dispara el hook',
                    url: 'https://api.example.com/hook-event-endpoint',
                    method: HttpMethods.GET.value,
                    headers: { headers: { 'Content-Type': 'application/json' } },
                    body: { body: {} },
                    context_position: 'mainResult',
                    on_success: { on_success: {} },
                    on_error: { on_error: { 500: 'flow_alert_mail_fail_auth_offer' } },
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: mainFlow.id.value,
                    endpoint_id: mainEndpoint.id.value,
                    function_id: null,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const requestSpy = jest.spyOn(AxiosHttpClient.prototype, 'request').mockImplementation(async () => {
                    return { status: 500, data: { error: 'failed' }, headers: {} };
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                await expect(workflowExecutor.execute({ external_code: 'test_hook_event_flow' })).rejects.toMatchObject(
                    {
                        statusCode: 400,
                        fields: expect.objectContaining({
                            reason: 'error_condition_triggered',
                            triggered_flow: 'flow_alert_mail_fail_auth_offer',
                            status: 500,
                        }),
                    }
                );

                // The hook is requested by publishing a WSRestFlowExecutionRequested event,
                // NOT by an authenticated HTTP call to the ws-hook-rest-flows API.
                const hookEvent = findHookEvent(publishSpy, 'flow_alert_mail_fail_auth_offer');
                expect(hookEvent).toBeDefined();
                expect(hookEvent.eventName).toBe('kace.core.ws_rest_flow_execution.requested');
                expect(hookEvent.payload.externalCode).toBe('flow_alert_mail_fail_auth_offer');
                expect(hookEvent.metadata).toEqual(
                    expect.objectContaining({ tenant_id: tenant.id.value, user_id: currentUser.id.value })
                );

                const calledHookApi = requestSpy.mock.calls.some((call) =>
                    String(call[0].url).includes('ws-hook-rest-flows')
                );
                expect(calledHookApi).toBe(false);

                requestSpy.mockRestore();
            }); // end TenantContext.run
        });
    });

    it('should preserve null values from initial_context and not corrupt them to context_undefined', async () => {
        const flow = await WSRestFlowMother.create(flowRepository, {
            external_code: 'test_null_context',
        });

        const endpoint = await WSRestEndpointMother.create(endpointRepository, {
            description: 'Endpoint que usa valores del contexto con nulls',
            url: 'https://api.example.com/users',
            method: HttpMethods.POST.value,
            headers: { headers: { 'Content-Type': 'application/json' } },
            body: {
                body: {
                    nombre: 'context.rabbit.nombre',
                    telefono: 'context.rabbit.nmTelefono1',
                    edad: 'context.rabbit.edad',
                },
            },
            is_dynamic_body: true,
            context_position: 'result',
            filter_input: { filter_input: [] },
            on_success: { on_success: {} },
            on_error: { on_error: {} },
        });

        const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);

        await stepCreator.execute({
            id: uuid(),
            flow_id: flow.id.value,
            endpoint_id: endpoint.id.value,
            function_id: null,
            order: 1,
            created_by: uuid(),
            created_at: new Date().toISOString(),
        });

        AxiosHttpClient.prototype.request = jest.fn().mockImplementation(async ({ data }) => {
            return {
                status: 200,
                data: { received: data },
                headers: {},
            };
        });

        const workflowExecutor = new WorkflowExecutor(
            workflowStepRepository,
            allowedConnectionRepository,
            secretRepository,
            currentUser
        );

        const response = await workflowExecutor.execute({
            external_code: 'test_null_context',
            initial_context: {
                rabbit: {
                    nombre: 'Juan',
                    nmTelefono1: null,
                    edad: 0,
                },
            },
        });

        const requestCall = AxiosHttpClient.prototype.request.mock.calls[0][0];
        expect(requestCall.data).toStrictEqual({
            nombre: 'Juan',
            telefono: null,
            edad: 0,
        });

        const responseJson = response.toJson();
        const context = responseJson.data.context;

        expect(context.rabbit.nmTelefono1).toBeNull();
        expect(context.rabbit.nombre).toBe('Juan');
        expect(context.rabbit.edad).toBe(0);

        expect(JSON.stringify(context)).not.toContain('context_undefined');
    });

    describe('regexOr function integration', () => {
        it('should return val1 when val1 matches the regex pattern', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_regex_or_val1',
                });

                const regexOrFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Regex OR - val1 wins',
                    type: 'regexOr',
                    filter_input: { filter_input: ['data.val1', 'data.val2'] },
                    context_position: 'result.chosen',
                    value_static: '^[a-z]+[0-9]+$',
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: regexOrFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_regex_or_val1',
                    initial_context: { data: { val1: 'abc123', val2: 'hello' } },
                });

                expect(response.toJson().data.context.result.chosen).toBe('abc123');
            });
        });

        it('should return val2 when only val2 matches the regex pattern', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_regex_or_val2',
                });

                const regexOrFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Regex OR - val2 wins',
                    type: 'regexOr',
                    filter_input: { filter_input: ['data.val1', 'data.val2'] },
                    context_position: 'result.chosen',
                    value_static: '^[a-z]+[0-9]+$',
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: regexOrFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_regex_or_val2',
                    initial_context: { data: { val1: 'hello', val2: 'world99' } },
                });

                expect(response.toJson().data.context.result.chosen).toBe('world99');
            });
        });

        it('should store null when neither value matches the regex pattern', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_regex_or_null',
                });

                const regexOrFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Regex OR - ninguno cumple',
                    type: 'regexOr',
                    filter_input: { filter_input: ['data.val1', 'data.val2'] },
                    context_position: 'result.chosen',
                    value_static: '^[0-9]+$',
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: regexOrFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_regex_or_null',
                    initial_context: { data: { val1: 'hello', val2: 'world' } },
                });

                expect(response.toJson().data.context.result.chosen).toBeNull();
            });
        });

        it('should resolve regex pattern from context when value_dynamic is true', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_regex_or_dynamic_pattern',
                });

                const regexOrFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Regex OR - patrón dinámico desde contexto',
                    type: 'regexOr',
                    filter_input: { filter_input: ['data.val1', 'data.val2'] },
                    context_position: 'result.chosen',
                    value_static: 'config.pattern',
                    value_dynamic: true,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: regexOrFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_regex_or_dynamic_pattern',
                    initial_context: {
                        config: { pattern: '^[a-z]+[0-9]+$' },
                        data: { val1: 'abc123', val2: 'hello' },
                    },
                });

                expect(response.toJson().data.context.result.chosen).toBe('abc123');
            });
        });
    });

    describe('divide function integration', () => {
        it('should divide a context value by a static divisor value', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_divide_by_static',
                });

                const divideFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Divide context value by static divisor',
                    type: 'divide',
                    filter_input: { filter_input: ['data.value'] },
                    context_position: 'result.quotient',
                    value_static: 2,
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: divideFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_divide_by_static',
                    initial_context: { data: { value: 10 } },
                });

                expect(response.toJson().data.context.result.quotient.value).toBe(5);
            });
        });

        it('should handle division with decimal results', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_divide_decimal',
                });

                const divideFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Divide with decimal result',
                    type: 'divide',
                    filter_input: { filter_input: ['data.value'] },
                    context_position: 'result.quotient',
                    value_static: 3,
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: divideFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_divide_decimal',
                    initial_context: { data: { value: 10 } },
                });

                expect(response.toJson().data.context.result.quotient.value).toBe(3.3333333333333335);
            });
        });

        it('should divide when value_static is a numeric string', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_divide_string_number',
                });

                const divideFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Divide with string number',
                    type: 'divide',
                    filter_input: { filter_input: ['data.value'] },
                    context_position: 'result.quotient',
                    value_static: '5',
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: divideFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_divide_string_number',
                    initial_context: { data: { value: 25 } },
                });

                expect(response.toJson().data.context.result.quotient.value).toBe(5);
            });
        });

        it('should handle negative numbers in division', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_divide_negative',
                });

                const divideFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Divide negative number',
                    type: 'divide',
                    filter_input: { filter_input: ['data.value'] },
                    context_position: 'result.quotient',
                    value_static: 2,
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: divideFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_divide_negative',
                    initial_context: { data: { value: -10 } },
                });

                expect(response.toJson().data.context.result.quotient.value).toBe(-5);
            });
        });
    });

    describe('subtract function integration', () => {
        it('should subtract a static value from a context value', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_subtract_static',
                });

                const subtractFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Subtract static value',
                    type: 'subtract',
                    filter_input: { filter_input: ['data.value'] },
                    context_position: 'result.difference',
                    value_static: 3,
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: subtractFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_subtract_static',
                    initial_context: { data: { value: 10 } },
                });

                expect(response.toJson().data.context.result.difference.value).toBe(7);
            });
        });

        it('should handle subtraction with negative result', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_subtract_negative',
                });

                const subtractFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Subtract resulting in negative',
                    type: 'subtract',
                    filter_input: { filter_input: ['data.value'] },
                    context_position: 'result.difference',
                    value_static: 15,
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: subtractFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_subtract_negative',
                    initial_context: { data: { value: 10 } },
                });

                expect(response.toJson().data.context.result.difference.value).toBe(-5);
            });
        });

        it('should subtract when value_static is a string number', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_subtract_string_number',
                });

                const subtractFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Subtract with string number',
                    type: 'subtract',
                    filter_input: { filter_input: ['data.value'] },
                    context_position: 'result.difference',
                    value_static: '5',
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: subtractFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_subtract_string_number',
                    initial_context: { data: { value: 25 } },
                });

                expect(response.toJson().data.context.result.difference.value).toBe(20);
            });
        });
    });

    describe('add function integration', () => {
        it('should add a static value to a context value', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_add_static',
                });

                const addFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Add static value',
                    type: 'add',
                    filter_input: { filter_input: ['data.value'] },
                    context_position: 'result.sum',
                    value_static: 3,
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: addFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_add_static',
                    initial_context: { data: { value: 10 } },
                });

                expect(response.toJson().data.context.result.sum.value).toBe(13);
            });
        });

        it('should handle addition with negative numbers', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_add_negative',
                });

                const addFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Add negative value',
                    type: 'add',
                    filter_input: { filter_input: ['data.value'] },
                    context_position: 'result.sum',
                    value_static: -5,
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: addFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_add_negative',
                    initial_context: { data: { value: 10 } },
                });

                expect(response.toJson().data.context.result.sum.value).toBe(5);
            });
        });

        it('should add when value_static is a string number', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_add_string_number',
                });

                const addFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Add with string number',
                    type: 'add',
                    filter_input: { filter_input: ['data.value'] },
                    context_position: 'result.sum',
                    value_static: '5',
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: addFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_add_string_number',
                    initial_context: { data: { value: 25 } },
                });

                expect(response.toJson().data.context.result.sum.value).toBe(30);
            });
        });
    });

    describe('abs function integration', () => {
        it('should return absolute value of a negative number from context', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_abs_negative',
                });

                const absFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Get absolute value',
                    type: 'abs',
                    filter_input: { filter_input: ['data.value'] },
                    context_position: 'result.absolute',
                    value_static: null,
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: absFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_abs_negative',
                    initial_context: { data: { value: -15 } },
                });

                expect(response.toJson().data.context.result.absolute.value).toBe(15);
            });
        });

        it('should handle positive number and return same value', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_abs_positive',
                });

                const absFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Get absolute value positive',
                    type: 'abs',
                    filter_input: { filter_input: ['data.value'] },
                    context_position: 'result.absolute',
                    value_static: null,
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: absFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_abs_positive',
                    initial_context: { data: { value: 15 } },
                });

                expect(response.toJson().data.context.result.absolute.value).toBe(15);
            });
        });

        it('should handle decimal numbers', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_abs_decimal',
                });

                const absFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Get absolute value decimal',
                    type: 'abs',
                    filter_input: { filter_input: ['data.value'] },
                    context_position: 'result.absolute',
                    value_static: null,
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: absFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_abs_decimal',
                    initial_context: { data: { value: -3.14159 } },
                });

                expect(response.toJson().data.context.result.absolute.value).toBe(3.14159);
            });
        });
    });

    describe('divide function with dynamic second parameter', () => {
        it('should divide using a dynamic divisor from context', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_divide_dynamic',
                });

                const divideFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Divide with dynamic divisor',
                    type: 'divide',
                    filter_input: { filter_input: ['data.dividend'] },
                    context_position: 'result.quotient',
                    value_static: 'data.divisor',
                    value_dynamic: true,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: divideFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_divide_dynamic',
                    initial_context: { data: { dividend: 20, divisor: 4 } },
                });

                expect(response.toJson().data.context.result.quotient.dividend).toBe(5);
            });
        });
    });

    describe('subtract function with dynamic second parameter', () => {
        it('should subtract using a dynamic subtrahend from context', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_subtract_dynamic',
                });

                const subtractFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Subtract with dynamic subtrahend',
                    type: 'subtract',
                    filter_input: { filter_input: ['data.minuend'] },
                    context_position: 'result.difference',
                    value_static: 'data.subtrahend',
                    value_dynamic: true,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: subtractFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_subtract_dynamic',
                    initial_context: { data: { minuend: 15, subtrahend: 7 } },
                });

                expect(response.toJson().data.context.result.difference.minuend).toBe(8);
            });
        });
    });

    describe('add function with dynamic second parameter', () => {
        it('should add using a dynamic addend from context', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_add_dynamic',
                });

                const addFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Add with dynamic addend',
                    type: 'add',
                    filter_input: { filter_input: ['data.augend'] },
                    context_position: 'result.sum',
                    value_static: 'data.addend',
                    value_dynamic: true,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: addFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_add_dynamic',
                    initial_context: { data: { augend: 10, addend: 5 } },
                });

                expect(response.toJson().data.context.result.sum.augend).toBe(15);
            });
        });
    });

    describe('ceil function integration', () => {
        it('should round up a negative decimal number from context', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_ceil_negative',
                });

                const ceilFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Round up value',
                    type: 'ceil',
                    filter_input: { filter_input: ['data.value'] },
                    context_position: 'result.rounded',
                    value_static: null,
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: ceilFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_ceil_negative',
                    initial_context: { data: { value: -3.7 } },
                });

                expect(response.toJson().data.context.result.rounded.value).toBe(-3);
            });
        });

        it('should round up a positive decimal number from context', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_ceil_positive',
                });

                const ceilFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Round up positive value',
                    type: 'ceil',
                    filter_input: { filter_input: ['data.value'] },
                    context_position: 'result.rounded',
                    value_static: null,
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: ceilFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_ceil_positive',
                    initial_context: { data: { value: 3.2 } },
                });

                expect(response.toJson().data.context.result.rounded.value).toBe(4);
            });
        });
    });

    describe('floor function integration', () => {
        it('should round down a negative decimal number from context', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_floor_negative',
                });

                const floorFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Round down value',
                    type: 'floor',
                    filter_input: { filter_input: ['data.value'] },
                    context_position: 'result.rounded',
                    value_static: null,
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: floorFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_floor_negative',
                    initial_context: { data: { value: -3.2 } },
                });

                expect(response.toJson().data.context.result.rounded.value).toBe(-4);
            });
        });

        it('should round down a positive decimal number from context', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_floor_positive',
                });

                const floorFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Round down positive value',
                    type: 'floor',
                    filter_input: { filter_input: ['data.value'] },
                    context_position: 'result.rounded',
                    value_static: null,
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: floorFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_floor_positive',
                    initial_context: { data: { value: 3.7 } },
                });

                expect(response.toJson().data.context.result.rounded.value).toBe(3);
            });
        });
    });

    describe('addMinutes function integration', () => {
        it('should add minutes to a date from context', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_add_minutes',
                });

                const addMinutesFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Add minutes to date',
                    type: 'addMinutes',
                    filter_input: { filter_input: ['data.date'] },
                    context_position: 'result.newDate',
                    value_static: 30,
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: addMinutesFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_add_minutes',
                    initial_context: { data: { date: '2024-01-15T10:00:00Z' } },
                });

                expect(response.toJson().data.context.result.newDate.date).toBe('2024-01-15T10:30:00.000Z');
            });
        });
    });

    describe('addHours function integration', () => {
        it('should add hours to a date from context', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_add_hours',
                });

                const addHoursFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Add hours to date',
                    type: 'addHours',
                    filter_input: { filter_input: ['data.date'] },
                    context_position: 'result.newDate',
                    value_static: 5,
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: addHoursFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_add_hours',
                    initial_context: { data: { date: '2024-01-15T10:00:00Z' } },
                });

                expect(response.toJson().data.context.result.newDate.date).toBe('2024-01-15T15:00:00.000Z');
            });
        });
    });

    describe('addDays function integration', () => {
        it('should add days to a date from context', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_add_days',
                });

                const addDaysFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Add days to date',
                    type: 'addDays',
                    filter_input: { filter_input: ['data.date'] },
                    context_position: 'result.newDate',
                    value_static: 7,
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: addDaysFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_add_days',
                    initial_context: { data: { date: '2024-01-15T10:00:00Z' } },
                });

                expect(response.toJson().data.context.result.newDate.date).toBe('2024-01-22T10:00:00.000Z');
            });
        });
    });

    describe('subtractMinutes function integration', () => {
        it('should subtract minutes from a date from context', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_subtract_minutes',
                });

                const subtractMinutesFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Remove minutes test',
                    type: 'subtractMinutes',
                    filter_input: { filter_input: ['data.date'] },
                    context_position: 'result.newDate',
                    value_static: 30,
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: subtractMinutesFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_subtract_minutes',
                    initial_context: { data: { date: '2024-01-15T10:30:00Z' } },
                });

                expect(response.toJson().data.context.result.newDate.date).toBe('2024-01-15T10:00:00.000Z');
            });
        });
    });

    describe('subtractHours function integration', () => {
        it('should subtract hours from a date from context', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_subtract_hours',
                });

                const subtractHoursFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Remove hours test',
                    type: 'subtractHours',
                    filter_input: { filter_input: ['data.date'] },
                    context_position: 'result.newDate',
                    value_static: 5,
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: subtractHoursFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_subtract_hours',
                    initial_context: { data: { date: '2024-01-15T15:00:00Z' } },
                });

                expect(response.toJson().data.context.result.newDate.date).toBe('2024-01-15T10:00:00.000Z');
            });
        });
    });

    describe('subtractDays function integration', () => {
        it('should subtract days from a date from context', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_subtract_days',
                });

                const subtractDaysFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Remove days test',
                    type: 'subtractDays',
                    filter_input: { filter_input: ['data.date'] },
                    context_position: 'result.newDate',
                    value_static: 7,
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: subtractDaysFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_subtract_days',
                    initial_context: { data: { date: '2024-01-22T10:00:00Z' } },
                });

                expect(response.toJson().data.context.result.newDate.date).toBe('2024-01-15T10:00:00.000Z');
            });
        });
    });

    describe('filterArray function integration', () => {
        it('should filter array of objects by equality condition (value_dynamic=false)', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_filter_array_eq',
                });

                const filterArrayFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Filter array by equality',
                    type: 'filterArray',
                    filter_input: { filter_input: ['data.items'] },
                    context_position: 'result.filtered',
                    value_static: 'status=Pendiente',
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: filterArrayFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_filter_array_eq',
                    initial_context: {
                        data: {
                            items: [
                                { status: 'Pendiente', id: 1 },
                                { status: 'Cerrado', id: 2 },
                                { status: 'Pendiente', id: 3 },
                            ],
                        },
                    },
                });

                const filtered = response.toJson().data.context.result.filtered;
                expect(filtered).toEqual({ status: 'Pendiente', id: 1 });
            });
        });

        it('should filter array of objects by inequality condition (value_dynamic=false)', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_filter_array_neq',
                });

                const filterArrayFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Filter array by inequality',
                    type: 'filterArray',
                    filter_input: { filter_input: ['data.items'] },
                    context_position: 'result.filtered',
                    value_static: 'status!=Cerrado',
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: filterArrayFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_filter_array_neq',
                    initial_context: {
                        data: {
                            items: [
                                { status: 'Pendiente', id: 1 },
                                { status: 'Cerrado', id: 2 },
                            ],
                        },
                    },
                });

                const filtered = response.toJson().data.context.result.filtered;
                expect(filtered).toEqual({ status: 'Pendiente', id: 1 });
            });
        });

        it('should filter array using dynamic condition resolved from context (value_dynamic=true)', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_filter_array_dynamic',
                });

                const filterArrayFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Filter array with dynamic condition',
                    type: 'filterArray',
                    filter_input: { filter_input: ['data.items'] },
                    context_position: 'result.filtered',
                    value_static: 'config.condition',
                    value_dynamic: true,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: filterArrayFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_filter_array_dynamic',
                    initial_context: {
                        config: { condition: 'status=Pendiente' },
                        data: {
                            items: [
                                { status: 'Pendiente', id: 1 },
                                { status: 'Cerrado', id: 2 },
                            ],
                        },
                    },
                });

                const filtered = response.toJson().data.context.result.filtered;
                expect(filtered).toEqual({ status: 'Pendiente', id: 1 });
            });
        });

        it('should filter array using dot notation on nested field (value_dynamic=false)', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_filter_array_nested_eq',
                });

                const filterArrayFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Filter array by nested field equality',
                    type: 'filterArray',
                    filter_input: { filter_input: ['data.items'] },
                    context_position: 'result.filtered',
                    value_static: 'Status.@DisplayString=Aceptado',
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: filterArrayFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_filter_array_nested_eq',
                    initial_context: {
                        data: {
                            items: [
                                { id: 1, Status: { Key: 124151808, '@DisplayString': 'Aceptado' } },
                                { id: 2, Status: { Key: 124151809, '@DisplayString': 'Cancelado' } },
                            ],
                        },
                    },
                });

                const filtered = response.toJson().data.context.result.filtered;
                expect(filtered).toEqual({ id: 1, Status: { Key: 124151808, '@DisplayString': 'Aceptado' } });
            });
        });

        it('should filter array using dot notation inequality on nested field (value_dynamic=false)', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_filter_array_nested_neq',
                });

                const filterArrayFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Filter array by nested field inequality',
                    type: 'filterArray',
                    filter_input: { filter_input: ['data.items'] },
                    context_position: 'result.filtered',
                    value_static: 'Status.@DisplayString!=Cancelado',
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: filterArrayFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_filter_array_nested_neq',
                    initial_context: {
                        data: {
                            items: [
                                { id: 1, Status: { '@DisplayString': 'Aceptado' } },
                                { id: 2, Status: { '@DisplayString': 'Cancelado' } },
                            ],
                        },
                    },
                });

                const filtered = response.toJson().data.context.result.filtered;
                expect(filtered).toEqual({ id: 1, Status: { '@DisplayString': 'Aceptado' } });
            });
        });

        it('should filter array using embedded context reference in value_static with = operator (value_dynamic=true)', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_filter_array_embedded_ctx_eq',
                });

                const filterArrayFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Filter array with embedded context',
                    type: 'filterArray',
                    filter_input: { filter_input: ['data.items'] },
                    context_position: 'result.filtered',
                    value_static: 'name_provider=context.bot_ofertamiento.nombre',
                    value_dynamic: true,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: filterArrayFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_filter_array_embedded_ctx_eq',
                    initial_context: {
                        bot_ofertamiento: { nombre: 'ACME' },
                        data: {
                            items: [
                                { name_provider: 'ACME', id: 1 },
                                { name_provider: 'OTHER', id: 2 },
                            ],
                        },
                    },
                });

                const filtered = response.toJson().data.context.result.filtered;
                expect(filtered).toEqual({ name_provider: 'ACME', id: 1 });
            });
        });

        it('should filter array using embedded context reference in value_static with != operator (value_dynamic=true)', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_filter_array_embedded_ctx_neq',
                });

                const filterArrayFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Filter array with embedded context ref',
                    type: 'filterArray',
                    filter_input: { filter_input: ['data.items'] },
                    context_position: 'result.filtered',
                    value_static: 'name_provider!=context.bot_ofertamiento.excluded',
                    value_dynamic: true,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: filterArrayFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_filter_array_embedded_ctx_neq',
                    initial_context: {
                        bot_ofertamiento: { excluded: 'OTHER' },
                        data: {
                            items: [
                                { name_provider: 'ACME', id: 1 },
                                { name_provider: 'OTHER', id: 2 },
                            ],
                        },
                    },
                });

                const filtered = response.toJson().data.context.result.filtered;
                expect(filtered).toEqual({ name_provider: 'ACME', id: 1 });
            });
        });
    });

    describe('selectArray function integration', () => {
        it('should extract a property array from an array of objects', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_select_array_values',
                });

                const selectArrayFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Obtener nombres desde items',
                    type: 'selectArray',
                    filter_input: { filter_input: ['data.items'] },
                    context_position: 'result.names',
                    value_static: 'name',
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: selectArrayFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_select_array_values',
                    initial_context: {
                        data: {
                            items: [
                                { id: 1, name: 'Ana' },
                                { id: 2, name: 'Luis' },
                                { id: 3, name: 'Sofia' },
                            ],
                        },
                    },
                });

                const names = response.toJson().data.context.result.names;
                expect(names).toEqual(['Ana', 'Luis', 'Sofia']);
            });
        });

        it('should concatenate extracted properties when separator is provided', async () => {
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepository, {
                    external_code: 'test_select_array_joined',
                });

                const selectArrayFunction = await WSRestFunctionMother.create(functionRepository, {
                    description: 'Obtener y unir nombres desde items',
                    type: 'selectArray',
                    filter_input: { filter_input: ['data.items'] },
                    context_position: 'result.names_joined',
                    value_static: 'name|, ',
                    value_dynamic: false,
                });

                const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);
                await stepCreator.execute({
                    id: uuid(),
                    flow_id: flow.id.value,
                    endpoint_id: null,
                    function_id: selectArrayFunction.id.value,
                    order: 1,
                    created_by: uuid(),
                    created_at: new Date().toISOString(),
                });

                const workflowExecutor = new WorkflowExecutor(
                    workflowStepRepository,
                    allowedConnectionRepository,
                    secretRepository,
                    currentUser
                );

                const response = await workflowExecutor.execute({
                    external_code: 'test_select_array_joined',
                    initial_context: {
                        data: {
                            items: [
                                { id: 1, name: 'Ana' },
                                { id: 2, name: 'Luis' },
                                { id: 3, name: 'Sofia' },
                            ],
                        },
                    },
                });

                const namesJoined = response.toJson().data.context.result.names_joined;
                expect(namesJoined).toBe('Ana, Luis, Sofia');
            });
        });
    });
});
