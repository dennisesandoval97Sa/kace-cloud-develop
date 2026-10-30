import { v4 as uuid } from 'uuid';
import { expect, jest } from '@jest/globals';
import WSRestFlowMother from '../../../ws-rest-flows/domain/WSRestFlowMother.js';
import WSRestEndpointMother from '../../../ws-rest-endpoints/domain/WSRestEndpointMother.js';
import WSRestFunctionMother from '../../../ws_rest_functions/domain/WSRestFunctionMother.js';
import WSRestConditionalMother from '../../../ws-rest-conditionals/domain/WSRestConditionalMother.js';
import { WSRestWorkflowStepMother } from '../../../ws-rest-workflow-step/domain/WSRestWorkflowStepMother.js';
import { SecretReplacer } from '../../../../src/secrets-vault/application/replacer/SecretReplacer.js';
import { WSRestWorkflowStepFinderService } from '../../../../src/ws-rest-workflow-step/domain/services/WSRestWorkflowStepFinderService.js';
import { knexConfig } from '../../../knexfile.js';
import { WorkflowStepExecutorService } from '../../../../src/shared/domain/services/WorkflowStepExecutorService.js';
import { KnexWSRestWorkflowStepRepository } from '../../../../src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository.js';
import { KnexWSRestEndpointRepository } from '../../../../src/ws-rest-endpoints/infrastructure/persistence/KnexWSRestEndpointRepository.js';
import { KnexWSRestFunctionRepository } from '../../../../src/ws_rest_functions/infrastructure/persistence/KnexWSRestFunctionRepository.js';
import { KnexWSRestFlowRepository } from '../../../../src/ws-rest-flows/infrastructure/persistence/KnexWSRestFlowRepository.js';
import { KnexWSRestConditionalRepository } from '../../../../src/ws-rest-conditionals/infrastructure/persistence/KnexWSRestConditionalRepository.js';
import { KnexWSRestFlowExecutionRepository } from '../../../../src/ws-rest-flow-executions/infrastructure/persistence/KnexWSRestFlowExecutionRepository.js';
import { TenantContext } from '../../../../src/shared/infrastructure/context/TenantContext.js';
import LocalTenantRepository from '../../../../src/tenant/infrastructure/local/LocalTenantRepository.js';
import { EventLogger } from '../../../../src/shared/EventLogger.js';
import { User } from '../../../../src/users/index.js';
import UsersMother from '../../../users/domain/UsersMother.js';
import { InvalidArgumentError, ValidationFailError } from '../../../../src/shared/index.js';

/**
 * Covers branches of WorkflowStepExecutorService that the existing integration suite
 * (tests/shared/domain/services/WorkflowStepExecutorService.test.js) does not reach:
 * hook selection by response status, the hook-flow trigger persistence path, endpoint
 * authorization caching via EndpointTokenCacheService, request-config edge cases, function
 * step array helpers, and a handful of remaining conditional operators.
 *
 * `finderService`, `eventLogger` and `currentUser` are the same real, DB-backed
 * collaborators used by the existing suite (see Step 3 of the task brief); only
 * `httpClient` is an in-memory double, since HTTP is the third party this file mocks.
 * The database is never mocked.
 */
describe('WorkflowStepExecutorService hooks, auth cache and remaining branches', () => {
    const repo = new KnexWSRestWorkflowStepRepository(knexConfig);
    const endpointRepo = new KnexWSRestEndpointRepository(knexConfig);
    const functionRepo = new KnexWSRestFunctionRepository(knexConfig);
    const flowRepo = new KnexWSRestFlowRepository(knexConfig);
    const conditionalRepo = new KnexWSRestConditionalRepository(knexConfig);

    let finderService;
    let secretReplacer;
    let executor;
    let httpClient;
    let tenant;

    beforeAll(async () => {
        secretReplacer = new SecretReplacer();
        finderService = new WSRestWorkflowStepFinderService(repo);
        tenant = await new LocalTenantRepository().find();
    });

    beforeEach(async () => {
        httpClient = { request: jest.fn() };
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

    /**
     * Minimal raw endpoint double, matching the shape already used by
     * tests/ws-rest-endpoints/WSRestEndpointTryoutUnit.test.js (value objects replaced by
     * plain `{ value }` wrappers). `executeEndpoint` only reads getters, so a real
     * `WSRestEndpoint` entity is not required for these cases.
     */
    const rawEndpoint = (overrides = {}) => ({
        id: { value: uuid() },
        method: { value: 'GET' },
        url: { value: 'https://example.com/resource' },
        headers: { value: { headers: { 'content-type': 'application/json' } } },
        body: { value: { body: null } },
        is_dynamic_body: { value: false },
        is_dynamic_header: { value: false },
        filter_input: { value: { filter_input: [] } },
        ...overrides,
    });

    describe('selección de hook por código de estado (#getHookByResponseStatus)', () => {
        /**
         * `#triggerHookFlow` (src/.../WorkflowStepExecutorService.js:1340) never calls
         * `finderService.findFlowByCode` — verified with:
         *   sed -n '1340,1400p' src/shared/domain/services/WorkflowStepExecutorService.js
         * It only reads `this.#finderService.repository.connection` to build a
         * `KnexWSRestFlowExecutionRepository`, persists a `WSRestFlowExecution` row and
         * publishes a `WSRestFlowExecutionRequested` event. So "which hook ran" is observed
         * here by spying (call-through, not stubbed) on
         * `KnexWSRestFlowExecutionRepository.prototype.save` — the real, unmocked DB write —
         * and reading the `external_code`/`flow_id` of the execution it persisted.
         */
        it('hookConfig nulo (endpoint sin on_error/on_success) no lanza y no dispara ningún hook', async () => {
            // Arrange
            const saveSpy = jest.spyOn(KnexWSRestFlowExecutionRepository.prototype, 'save');
            httpClient.request.mockResolvedValue({ status: 200, data: {} });
            const endpoint = rawEndpoint();

            // Act
            const { result } = await executor.executeEndpoint(endpoint);

            // Assert
            expect(result.status).toBe(200);
            expect(saveSpy).not.toHaveBeenCalled();
        });

        it('status sin hook configurado en un hookConfig no vacío no dispara ningún hook', async () => {
            // Arrange
            const saveSpy = jest.spyOn(KnexWSRestFlowExecutionRepository.prototype, 'save');
            httpClient.request.mockResolvedValue({ status: 201, data: {} });
            const endpoint = rawEndpoint({
                on_success: { value: { on_success: { 200: 'hook-200-only' } } },
                on_error: { value: { on_error: {} } },
            });

            // Act
            await executor.executeEndpoint(endpoint);

            // Assert
            expect(saveSpy).not.toHaveBeenCalled();
        });

        it('2xx con hook de éxito configurado dispara el hook de éxito, no el de error', async () => {
            // Arrange
            await TenantContext.run(tenant, async () => {
                const successHook = `hook-exito-${uuid()}`;
                const saveSpy = jest.spyOn(KnexWSRestFlowExecutionRepository.prototype, 'save');
                httpClient.request.mockResolvedValue({ status: 200, data: { ok: true } });
                const endpoint = rawEndpoint({
                    on_success: { value: { on_success: { 200: successHook } } },
                    on_error: { value: { on_error: { 500: 'hook-error-unused' } } },
                });

                // Act
                const { result } = await executor.executeEndpoint(endpoint);

                // Assert
                expect(result.status).toBe(200);
                expect(saveSpy).toHaveBeenCalledTimes(1);
                const savedExecution = saveSpy.mock.calls[0][0];
                expect(savedExecution.external_code.value).toBe(successHook);
                expect(savedExecution.initial_context.value.trigger_success).toMatchObject({ status: 200 });
            });
        });

        it('4xx con hook de error configurado dispara el hook de error y aborta la ejecución', async () => {
            // Arrange
            await TenantContext.run(tenant, async () => {
                const errorHook = `hook-error-${uuid()}`;
                const saveSpy = jest.spyOn(KnexWSRestFlowExecutionRepository.prototype, 'save');
                httpClient.request.mockResolvedValue({ status: 404, data: { message: 'not found' } });
                const endpoint = rawEndpoint({
                    on_success: { value: { on_success: {} } },
                    on_error: { value: { on_error: { 404: errorHook } } },
                });

                // Act
                let caught = null;
                try {
                    await executor.executeEndpoint(endpoint);
                } catch (error) {
                    caught = error;
                }

                // Assert
                expect(caught).not.toBeNull();
                expect(caught.fields.triggered_flow).toBe(errorHook);
                expect(caught.fields.status).toBe(404);
                expect(saveSpy).toHaveBeenCalledTimes(1);
                const savedExecution = saveSpy.mock.calls[0][0];
                expect(savedExecution.external_code.value).toBe(errorHook);
                expect(savedExecution.initial_context.value.trigger_error).toMatchObject({ status: 404 });
            });
        });

        it('5xx con hook de error configurado dispara el hook de error correspondiente', async () => {
            // Arrange
            await TenantContext.run(tenant, async () => {
                const errorHook = `hook-error-5xx-${uuid()}`;
                const saveSpy = jest.spyOn(KnexWSRestFlowExecutionRepository.prototype, 'save');
                httpClient.request.mockResolvedValue({ status: 503, data: { message: 'unavailable' } });
                const endpoint = rawEndpoint({
                    on_success: { value: { on_success: {} } },
                    on_error: { value: { on_error: { 503: errorHook } } },
                });

                // Act
                let caught = null;
                try {
                    await executor.executeEndpoint(endpoint);
                } catch (error) {
                    caught = error;
                }

                // Assert
                expect(caught).not.toBeNull();
                expect(caught.fields.triggered_flow).toBe(errorHook);
                expect(caught.fields.status).toBe(503);
                const savedExecution = saveSpy.mock.calls[0][0];
                expect(savedExecution.external_code.value).toBe(errorHook);
            });
        });

        it('hookConfig como mapa plano (sin envoltorio on_success/on_error) también resuelve el hook', async () => {
            // Arrange: solo alcanzable pasando un objeto crudo que evita la validación de
            // ValueObjectSuccess/ValueObjectError (que exige el envoltorio); documenta la
            // rama de respaldo `hooksMap = hookConfig` de #getHookByResponseStatus.
            await TenantContext.run(tenant, async () => {
                const flatHook = `hook-flat-${uuid()}`;
                const saveSpy = jest.spyOn(KnexWSRestFlowExecutionRepository.prototype, 'save');
                httpClient.request.mockResolvedValue({ status: 500, data: {} });
                const endpoint = rawEndpoint({
                    on_success: { value: { on_success: {} } },
                    on_error: { value: { 500: flatHook } },
                });

                // Act
                let caught = null;
                try {
                    await executor.executeEndpoint(endpoint);
                } catch (error) {
                    caught = error;
                }

                // Assert
                expect(caught).not.toBeNull();
                expect(caught.fields.triggered_flow).toBe(flatHook);
                expect(saveSpy).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe('#triggerHookFlow: código UUID vs código externo, y truncado por tamaño', () => {
        it('un código con formato UUID se guarda como flow_id, no como external_code', async () => {
            // Arrange
            await TenantContext.run(tenant, async () => {
                const flowUuid = uuid();
                const saveSpy = jest.spyOn(KnexWSRestFlowExecutionRepository.prototype, 'save');
                httpClient.request.mockResolvedValue({ status: 200, data: {} });
                const endpoint = rawEndpoint({
                    on_success: { value: { on_success: { 200: flowUuid } } },
                    on_error: { value: { on_error: {} } },
                });

                // Act
                await executor.executeEndpoint(endpoint);

                // Assert
                const savedExecution = saveSpy.mock.calls[0][0];
                expect(savedExecution.flow_id.value).toBe(flowUuid);
                expect(savedExecution.external_code.value).toBeNull();
            });
        });

        it('trunca el contexto del hook y descarta response_data cuando excede el presupuesto de SQS', async () => {
            // Arrange
            await TenantContext.run(tenant, async () => {
                const errorHook = `hook-trunc-${uuid()}`;
                const saveSpy = jest.spyOn(KnexWSRestFlowExecutionRepository.prototype, 'save');
                const bigBlob = 'x'.repeat(210 * 1024);
                executor.addInitialContext({ bulk_field: bigBlob });
                httpClient.request.mockResolvedValue({ status: 500, data: { message: 'boom' } });
                const endpoint = rawEndpoint({
                    on_success: { value: { on_success: {} } },
                    on_error: { value: { on_error: { 500: errorHook } } },
                });

                // Act
                try {
                    await executor.executeEndpoint(endpoint);
                } catch {
                    // el rechazo de executeEndpoint no es el foco de este test
                }

                // Assert
                const savedExecution = saveSpy.mock.calls[0][0];
                const persistedContext = savedExecution.initial_context.value;
                expect(persistedContext.bulk_field).toBeUndefined();
                expect(persistedContext.trigger_error.response_data).toBeNull();
                expect(persistedContext.trigger_error.status).toBe(500);
            });
        });

        it('sin truncado, el contexto conserva los datos originales del error (control)', async () => {
            // Arrange
            await TenantContext.run(tenant, async () => {
                const errorHook = `hook-small-${uuid()}`;
                const saveSpy = jest.spyOn(KnexWSRestFlowExecutionRepository.prototype, 'save');
                executor.addInitialContext({ small_field: 'kept' });
                httpClient.request.mockResolvedValue({ status: 500, data: { message: 'boom' } });
                const endpoint = rawEndpoint({
                    on_success: { value: { on_success: {} } },
                    on_error: { value: { on_error: { 500: errorHook } } },
                });

                // Act
                try {
                    await executor.executeEndpoint(endpoint);
                } catch {
                    // idem
                }

                // Assert
                const savedExecution = saveSpy.mock.calls[0][0];
                const persistedContext = savedExecution.initial_context.value;
                expect(persistedContext.small_field).toBe('kept');
                expect(persistedContext.trigger_error.response_data).toMatchObject({ message: 'boom' });
            });
        });
    });

    describe('#prepareRequestConfig / executeEndpoint: casos límite', () => {
        it('body_type "json" con body ya serializado a string lanza ValidationFailError', async () => {
            // Arrange
            const endpoint = rawEndpoint({
                method: { value: 'POST' },
                body: { value: { body: '{"already":"a string"}' } },
                body_type: { value: 'json' },
            });

            // Act & Assert
            await expect(executor.executeEndpoint(endpoint, { processResponse: false })).rejects.toThrow(
                ValidationFailError
            );
            expect(httpClient.request).not.toHaveBeenCalled();
        });

        it('is_dynamic_header sustituye variables de contexto en los headers', async () => {
            // Arrange
            executor.addInitialContext({ auth: { token: 'secret-token-abc' } });
            httpClient.request.mockResolvedValue({ status: 200, data: {} });
            const endpoint = rawEndpoint({
                is_dynamic_header: { value: true },
                headers: { value: { headers: { Authorization: 'Bearer context.auth.token' } } },
            });

            // Act
            await executor.executeEndpoint(endpoint, { processResponse: false });

            // Assert
            const requestConfig = httpClient.request.mock.calls[0][0];
            expect(requestConfig.headers.Authorization).toBe('Bearer secret-token-abc');
        });

        it('is_dynamic_body sustituye variables de contexto en el body', async () => {
            // Arrange
            executor.addInitialContext({ user: { id: 'U-42' } });
            httpClient.request.mockResolvedValue({ status: 200, data: {} });
            const endpoint = rawEndpoint({
                method: { value: 'POST' },
                is_dynamic_body: { value: true },
                body: { value: { body: { userId: 'context.user.id' } } },
            });

            // Act
            await executor.executeEndpoint(endpoint, { processResponse: false });

            // Assert
            const requestConfig = httpClient.request.mock.calls[0][0];
            expect(requestConfig.data).toMatchObject({ userId: 'U-42' });
        });

        it('cuando el httpClient lanza (fallo de transporte), se sintetiza una respuesta 500', async () => {
            // Arrange
            httpClient.request.mockRejectedValue(new Error('ECONNREFUSED'));
            const endpoint = rawEndpoint();

            // Act
            const { result } = await executor.executeEndpoint(endpoint, { processResponse: false });

            // Assert
            expect(result.status).toBe(500);
            expect(result.data.error).toBe('ECONNREFUSED');
        });
    });

    describe('#handleEndpointAuthorization con EndpointTokenCacheService', () => {
        const buildAuthEndpoint = () =>
            rawEndpoint({
                id: { value: uuid() },
                method: { value: 'POST' },
                url: { value: 'https://auth.example.com/token' },
                filter_input: { value: { filter_input: ['id_token'] } },
                cache_expires_in_path: { value: null },
                cache_default_ttl_seconds: { value: 300 },
            });

        it('un HIT en el cache de BD evita la llamada HTTP y actualiza el contexto con la respuesta cacheada', async () => {
            // Arrange
            const auth = buildAuthEndpoint();
            const main = rawEndpoint({ context_position: { value: 'main_result' } });
            main.authorization = auth;

            const cachedResponse = { id_token: 'cached-token-value' };
            const cacheService = {
                getValidCachedResponse: jest.fn().mockResolvedValue(cachedResponse),
                cacheResponse: jest.fn(),
            };
            const executorWithCache = new WorkflowStepExecutorService(
                httpClient,
                secretReplacer,
                finderService,
                new EventLogger(repo),
                new User(UsersMother.dto()),
                cacheService
            );
            httpClient.request.mockResolvedValue({ status: 200, data: { fromApi: true } });

            // Act
            await executorWithCache.executeEndpoint(main, { processResponse: false });

            // Assert
            expect(cacheService.getValidCachedResponse).toHaveBeenCalledWith(auth.id.value);
            expect(cacheService.cacheResponse).not.toHaveBeenCalled();
            expect(httpClient.request).toHaveBeenCalledTimes(1);
            expect(httpClient.request.mock.calls[0][0].url).toBe('https://example.com/resource');
        });

        it('un MISS en el cache de BD ejecuta el endpoint de auth y guarda la respuesta en cache', async () => {
            // Arrange
            const auth = buildAuthEndpoint();
            const main = rawEndpoint();
            main.authorization = auth;

            const cacheService = {
                getValidCachedResponse: jest.fn().mockResolvedValue(null),
                cacheResponse: jest.fn().mockResolvedValue(undefined),
            };
            const executorWithCache = new WorkflowStepExecutorService(
                httpClient,
                secretReplacer,
                finderService,
                new EventLogger(repo),
                new User(UsersMother.dto()),
                cacheService
            );
            httpClient.request
                .mockResolvedValueOnce({ status: 200, data: { id_token: 'brand-new-token' } })
                .mockResolvedValue({ status: 200, data: {} });

            // Act
            await executorWithCache.executeEndpoint(main, { processResponse: false });

            // Assert
            const authCalls = httpClient.request.mock.calls.filter(([cfg]) => cfg.url === auth.url.value);
            expect(authCalls).toHaveLength(1);
            expect(cacheService.cacheResponse).toHaveBeenCalledWith(
                auth.id.value,
                { id_token: 'brand-new-token' },
                { cacheExpiresInPath: null, cacheDefaultTtlSeconds: 300 }
            );
        });

        it('sin EndpointTokenCacheService (null), ejecuta el endpoint de auth directamente en cada MISS de memoria', async () => {
            // Arrange
            const auth = buildAuthEndpoint();
            const main = rawEndpoint();
            main.authorization = auth;
            // `executor` del beforeEach no recibe cacheService (queda null por defecto).
            httpClient.request
                .mockResolvedValueOnce({ status: 200, data: { id_token: 'no-cache-service-token' } })
                .mockResolvedValue({ status: 200, data: {} });

            // Act
            await executor.executeEndpoint(main, { processResponse: false });

            // Assert
            const authCalls = httpClient.request.mock.calls.filter(([cfg]) => cfg.url === auth.url.value);
            expect(authCalls).toHaveLength(1);
        });
    });

    describe('#executeWorkflowStep: ramas de tipo de paso (vía execute())', () => {
        it('un endpoint que responde >=400 sin hook configurado marca el paso como error, sin abortar el flujo', async () => {
            // Arrange
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepo);
                const endpoint = await WSRestEndpointMother.create(endpointRepo, {
                    url: 'https://api.example.com/broken',
                    method: 'GET',
                    on_success: { on_success: {} },
                    on_error: { on_error: {} },
                });
                await WSRestWorkflowStepMother.createEndpointStep(repo, {
                    flow_id: flow.id.value,
                    endpoint_id: endpoint.id.value,
                    order: 1,
                });
                httpClient.request.mockResolvedValue({ status: 500, data: { message: 'server error' } });

                // Act
                await executor.execute({ flow_id: flow.id.value });

                // Assert
                const eventLog = await repo
                    .connection('event_logs')
                    .where({ event_name: 'ws-rest-flows.executed', aggregate_id: flow.id.value })
                    .first();
                expect(eventLog.body.execution_status).toBe('failed');
                expect(eventLog.body.steps_executed[0].error).toBe(true);
            });
        });

        // NOTA: la rama `return null;` (línea 717, cuando un paso no tiene endpoint, función
        // ni condicional) no es alcanzable desde la API pública: `WSRestWorkflowStep.create`
        // valida en el constructor que al menos uno de endpoint_id/function_id/conditional_id
        // esté presente (WSRestWorkflowStep.js:227, #validateEndpointOrFunction) y rechaza
        // cualquier intento de crear un paso "vacío", incluso con datos crudos vía el mismo
        // Mother usado en el resto de la suite. Documentado aquí en vez de forzar un rodeo.
    });

    describe('execute(): identificación de flujo y contexto inicial', () => {
        it('lanza InvalidArgumentError cuando el flujo no tiene pasos', async () => {
            // Arrange
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepo);

                // Act & Assert
                await expect(executor.execute({ flow_id: flow.id.value })).rejects.toThrow(InvalidArgumentError);
            });
        });

        it('resuelve el flujo por external_code cuando no se pasa flow_id', async () => {
            // Arrange
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepo);
                const endpoint = await WSRestEndpointMother.create(endpointRepo, {
                    url: 'https://api.example.com/by-code',
                    method: 'GET',
                });
                await WSRestWorkflowStepMother.createEndpointStep(repo, {
                    flow_id: flow.id.value,
                    endpoint_id: endpoint.id.value,
                    order: 1,
                });
                httpClient.request.mockResolvedValue({ status: 200, data: {} });

                // Act
                await executor.execute({ external_code: flow.external_code.value });

                // Assert
                const eventLog = await repo
                    .connection('event_logs')
                    .where({ event_name: 'ws-rest-flows.executed', aggregate_id: flow.id.value })
                    .first();
                expect(eventLog).toBeDefined();
            });
        });

        it('initial_context explícitamente null no rompe la inicialización del contexto', async () => {
            // Arrange
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepo);
                const endpoint = await WSRestEndpointMother.create(endpointRepo, {
                    url: 'https://api.example.com/null-context',
                    method: 'GET',
                });
                await WSRestWorkflowStepMother.createEndpointStep(repo, {
                    flow_id: flow.id.value,
                    endpoint_id: endpoint.id.value,
                    order: 1,
                });
                httpClient.request.mockResolvedValue({ status: 200, data: {} });

                // Act & Assert (si el fallback `??` se pierde, Object.keys(null) lanza)
                await expect(
                    executor.execute({ flow_id: flow.id.value, initial_context: null })
                ).resolves.toBeDefined();
            });
        });
    });

    // NOTA: `addInitialContext({})` (guarda en la línea 533) y llamarlo sin guarda producen
    // el mismo resultado observable: `Object.entries({})` no itera en ningún caso, así que
    // esta rama no es distinguible por comportamiento (test decorativo evitado a propósito).

    describe('#executeFunctionWithContext: funciones de arreglo', () => {
        const runFunctionStep = async (functionOverrides, initialContext) => {
            const flow = await WSRestFlowMother.create(flowRepo);
            const fn = await WSRestFunctionMother.create(functionRepo, functionOverrides);
            await WSRestWorkflowStepMother.createEndpointStep(repo, {
                flow_id: flow.id.value,
                function_id: fn.id.value,
                order: 1,
            });
            const resultContext = await executor.execute({ flow_id: flow.id.value, initial_context: initialContext });
            return resultContext.get().context;
        };

        it('reverseArray invierte un arreglo tomado del contexto', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const context = await runFunctionStep(
                    {
                        type: 'reverseArray',
                        filter_input: { filter_input: ['items'] },
                        context_position: 'reversed',
                        value_dynamic: false,
                        value_static: null,
                    },
                    { items: [1, 2, 3] }
                );

                // Assert
                expect(context.reversed).toEqual([3, 2, 1]);
            });
        });

        it('filterArray filtra el primer elemento que cumple la condición estática', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const context = await runFunctionStep(
                    {
                        type: 'filterArray',
                        filter_input: { filter_input: ['users'] },
                        context_position: 'found_user',
                        value_dynamic: false,
                        value_static: 'status=active',
                    },
                    {
                        users: [
                            { status: 'inactive', id: 1 },
                            { status: 'active', id: 2 },
                        ],
                    }
                );

                // Assert
                expect(context.found_user).toMatchObject({ id: 2, status: 'active' });
            });
        });

        it('filterArrayAll filtra todos los elementos que cumplen todas las condiciones', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const context = await runFunctionStep(
                    {
                        type: 'filterArrayAll',
                        filter_input: { filter_input: ['users'] },
                        context_position: 'matches',
                        value_dynamic: false,
                        value_static: 'status=active|role=admin',
                    },
                    {
                        users: [
                            { status: 'active', role: 'admin', id: 1 },
                            { status: 'active', role: 'user', id: 2 },
                            { status: 'inactive', role: 'admin', id: 3 },
                        ],
                    }
                );

                // Assert
                expect(context.matches).toEqual([{ status: 'active', role: 'admin', id: 1 }]);
            });
        });

        it('selectArray extrae un campo de cada elemento del arreglo', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const context = await runFunctionStep(
                    {
                        type: 'selectArray',
                        filter_input: { filter_input: ['users'] },
                        context_position: 'names',
                        value_dynamic: false,
                        value_static: 'name',
                    },
                    { users: [{ name: 'Ada' }, { name: 'Grace' }] }
                );

                // Assert
                expect(context.names).toEqual(['Ada', 'Grace']);
            });
        });

        it('filterArrayIn cruza lookupArray y targetArray cuando ambos paths resuelven', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const context = await runFunctionStep(
                    {
                        type: 'filterArrayIn',
                        filter_input: { filter_input: ['allowed', 'candidates'] },
                        context_position: 'filtered',
                        value_dynamic: false,
                        value_static: 'id,ref',
                    },
                    {
                        allowed: [{ id: 1 }, { id: 2 }],
                        candidates: [{ ref: 1 }, { ref: 3 }],
                    }
                );

                // Assert
                expect(context.filtered).toEqual([{ ref: 1 }]);
            });
        });

        it('filterArrayIn devuelve [] cuando lookupPath no resuelve ningún valor en el contexto', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const context = await runFunctionStep(
                    {
                        type: 'filterArrayIn',
                        filter_input: { filter_input: ['missing_lookup', 'candidates'] },
                        context_position: 'filtered_empty',
                        value_dynamic: false,
                        value_static: 'id,ref',
                    },
                    {
                        candidates: [{ ref: 1 }],
                    }
                );

                // Assert
                expect(context.filtered_empty).toEqual([]);
            });
        });
    });

    describe('#executeFunctionForValue: valor escalar vs arreglo, y staticValue', () => {
        it('con dos filter_input (uno escalar, uno arreglo) y staticValue definido, incrementa ambos según corresponda', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepo);
                const fn = await WSRestFunctionMother.create(functionRepo, {
                    type: 'increment',
                    filter_input: { filter_input: ['base', 'nums'] },
                    context_position: 'incremented',
                    value_dynamic: false,
                    value_static: '5',
                });
                await WSRestWorkflowStepMother.createEndpointStep(repo, {
                    flow_id: flow.id.value,
                    function_id: fn.id.value,
                    order: 1,
                });

                const resultContext = await executor.execute({
                    flow_id: flow.id.value,
                    initial_context: { base: 100, nums: [1, 2, 3] },
                });

                // Assert: dataValue escalar ('base') va por la rama no-arreglo, 'nums' por la
                // rama Array.isArray(dataValue) === true; ambas con staticValue='5' presente.
                expect(resultContext.get().context.incremented).toEqual({ base: 105, nums: [6, 7, 8] });
            });
        });

        it('cuando el staticValue dinámico resuelve a null en el contexto, aplica la función con un único argumento', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepo);
                const fn = await WSRestFunctionMother.create(functionRepo, {
                    type: 'increment',
                    filter_input: { filter_input: ['val', 'vals'] },
                    context_position: 'incremented_default',
                    value_dynamic: true,
                    value_static: 'step_key',
                });
                await WSRestWorkflowStepMother.createEndpointStep(repo, {
                    flow_id: flow.id.value,
                    function_id: fn.id.value,
                    order: 1,
                });

                // `step_key` resuelve a `null` en el contexto, así que #prepareStaticValue
                // devuelve `null`: staticValue != null es false → execute(...) con un solo
                // argumento, tanto para el valor escalar ('val') como para el arreglo ('vals')
                // → increment usa su paso por defecto (+1) en ambos casos.
                const resultContext = await executor.execute({
                    flow_id: flow.id.value,
                    initial_context: { step_key: null, val: 10, vals: [1, 2] },
                });

                // Assert
                expect(resultContext.get().context.incremented_default).toEqual({ val: 11, vals: [2, 3] });
            });
        });

        it('cuando el filter_input no resuelve ningún dato, la función no se ejecuta y el resultado es {}', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepo);
                const fn = await WSRestFunctionMother.create(functionRepo, {
                    type: 'increment',
                    filter_input: { filter_input: ['does.not.exist'] },
                    context_position: 'never_set',
                    value_dynamic: false,
                    value_static: '1',
                });
                await WSRestWorkflowStepMother.createEndpointStep(repo, {
                    flow_id: flow.id.value,
                    function_id: fn.id.value,
                    order: 1,
                });

                const resultContext = await executor.execute({
                    flow_id: flow.id.value,
                    initial_context: { unrelated: 1 },
                });

                // Assert
                expect(resultContext.get().context.never_set).toEqual({});
            });
        });
    });

    describe('#prepareStaticValue: prefijo SECRET_ y patrón embebido de contexto', () => {
        it('un value_static dinámico con prefijo SECRET_ se resuelve vía secretReplacer.replaceSecretsInValue', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const replaceSpy = jest
                    .spyOn(secretReplacer, 'replaceSecretsInValue')
                    .mockResolvedValue('resolved-secret-value');

                const flow = await WSRestFlowMother.create(flowRepo);
                const fn = await WSRestFunctionMother.create(functionRepo, {
                    type: 'toUpperCase',
                    filter_input: { filter_input: [] },
                    context_position: 'secret_result',
                    value_dynamic: true,
                    value_static: 'SECRET_API_KEY',
                });
                await WSRestWorkflowStepMother.createEndpointStep(repo, {
                    flow_id: flow.id.value,
                    function_id: fn.id.value,
                    order: 1,
                });

                await executor.execute({ flow_id: flow.id.value });

                // Assert
                expect(replaceSpy).toHaveBeenCalledWith('SECRET_API_KEY');
                replaceSpy.mockRestore();
            });
        });

        it('un patrón embebido "cond=context.path" resuelto en el contexto sustituye el valor referenciado', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepo);
                const fn = await WSRestFunctionMother.create(functionRepo, {
                    type: 'trim',
                    filter_input: { filter_input: [] },
                    context_position: 'embedded_result',
                    value_dynamic: true,
                    value_static: 'active=context.status_field',
                });
                await WSRestWorkflowStepMother.createEndpointStep(repo, {
                    flow_id: flow.id.value,
                    function_id: fn.id.value,
                    order: 1,
                });

                const resultContext = await executor.execute({
                    flow_id: flow.id.value,
                    initial_context: { status_field: 'yes' },
                });

                // Assert: `#prepareStaticValue` resuelve a "active=yes" antes de invocar trim()
                expect(resultContext.get().context.embedded_result).toBe('active=yes');
            });
        });

        it('un patrón embebido cuya referencia de contexto no resuelve devuelve el value_static original', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepo);
                const fn = await WSRestFunctionMother.create(functionRepo, {
                    type: 'trim',
                    filter_input: { filter_input: [] },
                    context_position: 'embedded_unresolved',
                    value_dynamic: true,
                    value_static: 'active=context.missing_field',
                });
                await WSRestWorkflowStepMother.createEndpointStep(repo, {
                    flow_id: flow.id.value,
                    function_id: fn.id.value,
                    order: 1,
                });

                const resultContext = await executor.execute({ flow_id: flow.id.value, initial_context: {} });

                // Assert
                expect(resultContext.get().context.embedded_unresolved).toBe('active=context.missing_field');
            });
        });
    });

    describe('#executeConditional: operadores restantes (in, notIn, ilike, jsonArrayValue, between/like inválidos, default)', () => {
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
            return { flow, initial_context };
        };

        const executeAndGetStep = async (flow, initial_context) => {
            await executor.execute({ flow_id: flow.id.value, initial_context });
            const eventLog = await repo
                .connection('event_logs')
                .where({ event_name: 'ws-rest-flows.executed', aggregate_id: flow.id.value })
                .first();
            return eventLog.body.steps_executed[0];
        };

        // `getValueOrStatic` desenvuelve un nivel via `Object.values(dataProcessed)[0]`: si el
        // path resuelve DIRECTAMENTE a un arreglo, ese desenvolvimiento devuelve solo su primer
        // ELEMENTO, no el arreglo. Para que `right` llegue como el arreglo completo (como hacen
        // los tests de `between` ya existentes con `wrapper: { range: [...] }`), el arreglo debe
        // estar anidado un nivel dentro de un objeto contenedor.

        it('in: el valor pertenece al arreglo → true', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const { flow, initial_context } = await runConditional({
                    operator: 'in',
                    input_path_a: 'value',
                    input_path_b: 'wrap',
                    initial_context: { value: 'b', wrap: { list: ['a', 'b', 'c'] } },
                });
                const step = await executeAndGetStep(flow, initial_context);

                // Assert
                expect(step.metadata).toMatchObject({ evaluated: true, result: true, operator: 'in' });
            });
        });

        it('in: el valor no pertenece al arreglo → false', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const { flow, initial_context } = await runConditional({
                    operator: 'in',
                    input_path_a: 'value',
                    input_path_b: 'wrap',
                    initial_context: { value: 'z', wrap: { list: ['a', 'b', 'c'] } },
                });
                const step = await executeAndGetStep(flow, initial_context);

                // Assert
                expect(step.metadata).toMatchObject({ evaluated: true, result: false, operator: 'in' });
            });
        });

        it('in: con el segundo operando no-arreglo, la ejecución falla', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const { flow, initial_context } = await runConditional({
                    operator: 'in',
                    input_path_a: 'value',
                    input_path_b: 'wrap',
                    initial_context: { value: 'z', wrap: { list: 'not-an-array' } },
                });

                // Assert
                await expect(executor.execute({ flow_id: flow.id.value, initial_context })).rejects.toThrow(
                    InvalidArgumentError
                );
            });
        });

        it('notIn: el valor no pertenece al arreglo → true', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const { flow, initial_context } = await runConditional({
                    operator: 'notIn',
                    input_path_a: 'value',
                    input_path_b: 'wrap',
                    initial_context: { value: 'z', wrap: { list: ['a', 'b', 'c'] } },
                });
                const step = await executeAndGetStep(flow, initial_context);

                // Assert
                expect(step.metadata).toMatchObject({ evaluated: true, result: true, operator: 'notIn' });
            });
        });

        it('notIn: el valor sí pertenece al arreglo → false', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const { flow, initial_context } = await runConditional({
                    operator: 'notIn',
                    input_path_a: 'value',
                    input_path_b: 'wrap',
                    initial_context: { value: 'a', wrap: { list: ['a', 'b', 'c'] } },
                });
                const step = await executeAndGetStep(flow, initial_context);

                // Assert
                expect(step.metadata).toMatchObject({ evaluated: true, result: false, operator: 'notIn' });
            });
        });

        it('notIn: con el segundo operando no-arreglo, la ejecución falla', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const { flow, initial_context } = await runConditional({
                    operator: 'notIn',
                    input_path_a: 'value',
                    input_path_b: 'wrap',
                    initial_context: { value: 'a', wrap: { list: 42 } },
                });

                // Assert
                await expect(executor.execute({ flow_id: flow.id.value, initial_context })).rejects.toThrow(
                    InvalidArgumentError
                );
            });
        });

        it('ilike: coincide sin importar mayúsculas/minúsculas → true', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const { flow, initial_context } = await runConditional({
                    operator: 'ilike',
                    input_path_a: 'text',
                    input_path_b: 'pattern',
                    initial_context: { text: 'Hello World', pattern: 'hello%' },
                });
                const step = await executeAndGetStep(flow, initial_context);

                // Assert
                expect(step.metadata).toMatchObject({ evaluated: true, result: true, operator: 'ilike' });
            });
        });

        it('ilike: con operandos no-string, la ejecución falla', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const { flow, initial_context } = await runConditional({
                    operator: 'ilike',
                    input_path_a: 'text',
                    input_path_b: 'pattern',
                    initial_context: { text: 123, pattern: 'hello%' },
                });

                // Assert
                await expect(executor.execute({ flow_id: flow.id.value, initial_context })).rejects.toThrow(
                    InvalidArgumentError
                );
            });
        });

        it('like: con operandos no-string, la ejecución falla', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const { flow, initial_context } = await runConditional({
                    operator: 'like',
                    input_path_a: 'text',
                    input_path_b: 'pattern',
                    initial_context: { text: 123, pattern: 'hello%' },
                });

                // Assert
                await expect(executor.execute({ flow_id: flow.id.value, initial_context })).rejects.toThrow(
                    InvalidArgumentError
                );
            });
        });

        it('jsonArrayValue: el arreglo contiene un elemento que coincide → true', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const { flow, initial_context } = await runConditional({
                    operator: 'jsonArrayValue',
                    input_path_a: 'itemsWrap',
                    input_path_b: 'targetWrap',
                    initial_context: {
                        itemsWrap: { list: [{ id: 1 }, { id: 2 }] },
                        targetWrap: { payload: { id: 2 } },
                    },
                });
                const step = await executeAndGetStep(flow, initial_context);

                // Assert
                expect(step.metadata).toMatchObject({ evaluated: true, result: true, operator: 'jsonArrayValue' });
            });
        });

        it('jsonArrayValue: cuando el primer operando no es un arreglo → false', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const { flow, initial_context } = await runConditional({
                    operator: 'jsonArrayValue',
                    input_path_a: 'items',
                    input_path_b: 'target',
                    initial_context: { items: { not: 'an array' }, target: { id: 2 } },
                });
                const step = await executeAndGetStep(flow, initial_context);

                // Assert
                expect(step.metadata).toMatchObject({ evaluated: true, result: false, operator: 'jsonArrayValue' });
            });
        });

        it('between: con un arreglo real pero de un solo elemento, la ejecución falla por longitud insuficiente', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const { flow, initial_context } = await runConditional({
                    operator: 'between',
                    input_path_a: 'value',
                    input_path_b: 'wrap',
                    initial_context: { value: 5, wrap: { range: [1] } },
                });

                // Assert
                await expect(executor.execute({ flow_id: flow.id.value, initial_context })).rejects.toThrow(
                    InvalidArgumentError
                );
            });
        });

        it('operador no soportado lanza InvalidArgumentError', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const { flow, initial_context } = await runConditional({
                    operator: 'bogus',
                    input_path_a: 'value',
                    input_path_b: 'other',
                    initial_context: { value: 1, other: 1 },
                });

                // Assert
                await expect(executor.execute({ flow_id: flow.id.value, initial_context })).rejects.toThrow(
                    InvalidArgumentError
                );
            });
        });
    });

    describe('#executeConditional: entradas faltantes en el contexto', () => {
        const runConditional = async ({ operator, input_path_a, input_path_b }) => {
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
            return flow;
        };

        it('con input_path_a vacío, el paso queda sin evaluar por "missing_inputs: a"', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const flow = await runConditional({
                    operator: 'eq',
                    input_path_a: '',
                    input_path_b: 'expected',
                });
                await executor.execute({ flow_id: flow.id.value, initial_context: { expected: 1 } });
                const eventLog = await repo
                    .connection('event_logs')
                    .where({ event_name: 'ws-rest-flows.executed', aggregate_id: flow.id.value })
                    .first();

                // Assert
                expect(eventLog.body.steps_executed[0].metadata).toMatchObject({
                    evaluated: false,
                    reason: 'missing_inputs',
                    missing: ['a'],
                });
            });
        });

        it('un operador unario (notNull) sin input_path_b no lo marca como faltante', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const flow = await runConditional({
                    operator: 'notNull',
                    input_path_a: 'value',
                    input_path_b: null,
                });
                await executor.execute({ flow_id: flow.id.value, initial_context: { value: 'present' } });
                const eventLog = await repo
                    .connection('event_logs')
                    .where({ event_name: 'ws-rest-flows.executed', aggregate_id: flow.id.value })
                    .first();

                // Assert
                expect(eventLog.body.steps_executed[0].metadata).toMatchObject({
                    evaluated: true,
                    result: true,
                    operator: 'notNull',
                });
            });
        });

        it('con input_path_b vacío en un operador binario, el paso queda sin evaluar por "missing_inputs: b"', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const flow = await runConditional({
                    operator: 'eq',
                    input_path_a: 'value',
                    input_path_b: '',
                });
                await executor.execute({ flow_id: flow.id.value, initial_context: { value: 1 } });
                const eventLog = await repo
                    .connection('event_logs')
                    .where({ event_name: 'ws-rest-flows.executed', aggregate_id: flow.id.value })
                    .first();

                // Assert
                expect(eventLog.body.steps_executed[0].metadata).toMatchObject({
                    evaluated: false,
                    reason: 'missing_inputs',
                    missing: ['b'],
                });
            });
        });

        it('operator: "" (falsy pero no 0) también resuelve como no soportado', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const flow = await runConditional({
                    operator: '',
                    input_path_a: 'value',
                    input_path_b: 'other',
                });

                // Assert
                await expect(
                    executor.execute({ flow_id: flow.id.value, initial_context: { value: 1, other: 1 } })
                ).rejects.toThrow(InvalidArgumentError);
            });
        });

        it('operator "=" (símbolo, no alias canónico) se normaliza al comparador eq', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const flow = await runConditional({
                    operator: '=',
                    input_path_a: 'value',
                    input_path_b: 'expected',
                });
                await executor.execute({ flow_id: flow.id.value, initial_context: { value: 7, expected: 7 } });
                const eventLog = await repo
                    .connection('event_logs')
                    .where({ event_name: 'ws-rest-flows.executed', aggregate_id: flow.id.value })
                    .first();

                // Assert: el switch interno usa el operador normalizado ('eq'), pero el
                // metadata expone el operador crudo tal como se configuró ('=').
                expect(eventLog.body.steps_executed[0].metadata).toMatchObject({
                    evaluated: true,
                    result: true,
                    operator: '=',
                });
            });
        });
    });

    describe('execute(): flowRef "unknown" y ramas defensivas restantes', () => {
        it('sin flow_id ni external_code, la ejecución falla (flowRef cae a "unknown" en el catch)', async () => {
            // Arrange & Act & Assert
            await TenantContext.run(tenant, async () => {
                await expect(executor.execute({})).rejects.toThrow();
            });
        });

        it('sin headers ni body en el endpoint, usa los valores por defecto ({} y null)', async () => {
            // Arrange
            httpClient.request.mockResolvedValue({ status: 200, data: {} });
            const endpoint = rawEndpoint({ headers: { value: null }, body: { value: undefined } });

            // Act
            await executor.executeEndpoint(endpoint, { processResponse: false });

            // Assert
            const requestConfig = httpClient.request.mock.calls[0][0];
            expect(requestConfig.headers).toBeUndefined();
            expect(requestConfig.data).toBeUndefined();
        });
    });

    describe('#executeFunctionWithContext: ramas de paths ausentes (regexOr y filterArrayIn)', () => {
        it('regexOr con un único filter_input (sin segundo path) evalúa solo val1', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepo);
                const fn = await WSRestFunctionMother.create(functionRepo, {
                    type: 'regexOr',
                    filter_input: { filter_input: ['single_path'] },
                    context_position: 'regex_single',
                    value_dynamic: false,
                    value_static: '^[a-z]+[0-9]+$',
                });
                await WSRestWorkflowStepMother.createEndpointStep(repo, {
                    flow_id: flow.id.value,
                    function_id: fn.id.value,
                    order: 1,
                });

                const resultContext = await executor.execute({
                    flow_id: flow.id.value,
                    initial_context: { single_path: 'abc123' },
                });

                // Assert
                expect(resultContext.get().context.regex_single).toBe('abc123');
            });
        });

        it('filterArrayIn con lookupPath vacío no consulta el lookup y devuelve []', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepo);
                const fn = await WSRestFunctionMother.create(functionRepo, {
                    type: 'filterArrayIn',
                    filter_input: { filter_input: ['', 'candidates'] },
                    context_position: 'filtered_no_lookup_path',
                    value_dynamic: false,
                    value_static: 'id,ref',
                });
                await WSRestWorkflowStepMother.createEndpointStep(repo, {
                    flow_id: flow.id.value,
                    function_id: fn.id.value,
                    order: 1,
                });

                const resultContext = await executor.execute({
                    flow_id: flow.id.value,
                    initial_context: { candidates: [{ ref: 1 }] },
                });

                // Assert
                expect(resultContext.get().context.filtered_no_lookup_path).toEqual([]);
            });
        });
    });

    describe('ramas adicionales de bajo costo', () => {
        it('like: con el operando derecho no-string (izquierdo sí string), la ejecución falla', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepo);
                const conditional = await WSRestConditionalMother.create(conditionalRepo, {
                    operator: 'like',
                    input_path_a: 'text',
                    input_path_b: 'pattern',
                });
                await WSRestWorkflowStepMother.createEndpointStep(repo, {
                    flow_id: flow.id.value,
                    conditional_id: conditional.id.value,
                    order: 1,
                });

                // Assert
                await expect(
                    executor.execute({ flow_id: flow.id.value, initial_context: { text: 'hello', pattern: 456 } })
                ).rejects.toThrow(InvalidArgumentError);
            });
        });

        it('jsonContains: cuando el subset es un arreglo pero el container no lo es, no lanza y evalúa false', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepo);
                const conditional = await WSRestConditionalMother.create(conditionalRepo, {
                    operator: 'jsonContains',
                    input_path_a: 'containerWrap',
                    input_path_b: 'subsetWrap',
                });
                await WSRestWorkflowStepMother.createEndpointStep(repo, {
                    flow_id: flow.id.value,
                    conditional_id: conditional.id.value,
                    order: 1,
                });

                await executor.execute({
                    flow_id: flow.id.value,
                    initial_context: {
                        containerWrap: { payload: { list: { not: 'an array' } } },
                        subsetWrap: { payload: { list: [1, 2] } },
                    },
                });
                const eventLog = await repo
                    .connection('event_logs')
                    .where({ event_name: 'ws-rest-flows.executed', aggregate_id: flow.id.value })
                    .first();

                // Assert
                expect(eventLog.body.steps_executed[0].metadata).toMatchObject({
                    evaluated: true,
                    result: false,
                    operator: 'jsonContains',
                });
            });
        });

        // NOTA: la rama falsy de `if (restFunction.context_position?.value)` (línea 1315,
        // #updateContextFromFunctionResult) no es alcanzable desde la API pública:
        // `ValueObjectContextPosition` (src/ws_rest_functions/domain/value-objects/
        // ValueObjectContextPosition.js:13) rechaza cualquier `WSRestFunction` sin
        // context_position no vacío, así que todo paso de tipo función persistido siempre
        // llega a #updateContextFromFunctionResult con un context_position verdadero.

        it('#extractTokenFromResponse con filter_input vacío no intenta extraer ningún token', async () => {
            // Arrange
            const auth = rawEndpoint({
                id: { value: uuid() },
                method: { value: 'POST' },
                url: { value: 'https://auth.example.com/no-filter' },
                filter_input: { value: { filter_input: [] } },
            });
            const main = rawEndpoint();
            main.authorization = auth;
            httpClient.request
                .mockResolvedValueOnce({ status: 200, data: { id_token: 'unused-token' } })
                .mockResolvedValue({ status: 200, data: {} });

            // Act
            await executor.executeEndpoint(main, { processResponse: false });

            // Assert: sin filter_input, el auth endpoint se ejecuta pero ningún token se cachea
            // en memoria, así que una segunda llamada vuelve a ejecutar el endpoint de auth.
            await executor.executeEndpoint(main, { processResponse: false });
            const authCalls = httpClient.request.mock.calls.filter(([cfg]) => cfg.url === auth.url.value);
            expect(authCalls).toHaveLength(2);
        });

        it('executeEndpoint sin filter_input en el endpoint principal usa [] por defecto sin lanzar', async () => {
            // Arrange
            httpClient.request.mockResolvedValue({ status: 200, data: { some: 'data' } });
            const endpoint = rawEndpoint({
                filter_input: { value: null },
                on_success: { value: { on_success: {} } },
                on_error: { value: { on_error: {} } },
                context_position: { value: 'stored_result' },
            });

            // Act
            const { result } = await executor.executeEndpoint(endpoint);

            // Assert
            expect(result.status).toBe(200);
        });

        it('cuando el httpClient lanza sin mensaje, usa el mensaje de error genérico', async () => {
            // Arrange
            httpClient.request.mockRejectedValue({ code: 'NO_MESSAGE_FIELD' });
            const endpoint = rawEndpoint();

            // Act
            const { result } = await executor.executeEndpoint(endpoint, { processResponse: false });

            // Assert
            expect(result.status).toBe(500);
            expect(result.data.error).toBe('Unknown transport error');
        });

        it('sin id en currentUser, #triggerHookFlow intenta created_by=null y la ejecución no se propaga (error del hook silenciado)', async () => {
            // Arrange
            await TenantContext.run(tenant, async () => {
                const successHook = `hook-no-user-${uuid()}`;
                const executorWithoutUserId = new WorkflowStepExecutorService(
                    httpClient,
                    secretReplacer,
                    finderService,
                    new EventLogger(repo),
                    {}
                );
                const saveSpy = jest.spyOn(KnexWSRestFlowExecutionRepository.prototype, 'save');
                httpClient.request.mockResolvedValue({ status: 200, data: {} });
                const endpoint = rawEndpoint({
                    on_success: { value: { on_success: { 200: successHook } } },
                    on_error: { value: { on_error: {} } },
                });

                // Act: `this.#currentUser?.id?.value ?? null` (línea 1348) resuelve a null;
                // `WSRestFlowExecution` rechaza un `created_by` null antes de llegar a
                // `save()`, y `#executeSuccessHook` traga ese error (no lo repropaga).
                const { result } = await executorWithoutUserId.executeEndpoint(endpoint);

                // Assert
                expect(result.status).toBe(200);
                expect(saveSpy).not.toHaveBeenCalled();
            });
        });

        it('filterArrayIn con targetPath vacío no consulta el target y devuelve []', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepo);
                const fn = await WSRestFunctionMother.create(functionRepo, {
                    type: 'filterArrayIn',
                    filter_input: { filter_input: ['allowed', ''] },
                    context_position: 'filtered_no_target_path',
                    value_dynamic: false,
                    value_static: 'id,ref',
                });
                await WSRestWorkflowStepMother.createEndpointStep(repo, {
                    flow_id: flow.id.value,
                    function_id: fn.id.value,
                    order: 1,
                });

                const resultContext = await executor.execute({
                    flow_id: flow.id.value,
                    initial_context: { allowed: [{ id: 1 }] },
                });

                // Assert
                expect(resultContext.get().context.filtered_no_target_path).toEqual([]);
            });
        });

        it('filterArrayIn con targetPath sin resolver en el contexto devuelve []', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepo);
                const fn = await WSRestFunctionMother.create(functionRepo, {
                    type: 'filterArrayIn',
                    filter_input: { filter_input: ['allowed', 'missing_target'] },
                    context_position: 'filtered_unresolved_target',
                    value_dynamic: false,
                    value_static: 'id,ref',
                });
                await WSRestWorkflowStepMother.createEndpointStep(repo, {
                    flow_id: flow.id.value,
                    function_id: fn.id.value,
                    order: 1,
                });

                const resultContext = await executor.execute({
                    flow_id: flow.id.value,
                    initial_context: { allowed: [{ id: 1 }] },
                });

                // Assert
                expect(resultContext.get().context.filtered_unresolved_target).toEqual([]);
            });
        });

        it('con satisfied vacío ("") en un operador que evalúa true, no intenta ejecutar la rama satisfecha', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepo);
                const conditional = await WSRestConditionalMother.create(conditionalRepo, {
                    operator: 'eq',
                    input_path_a: 'value',
                    input_path_b: 'expected',
                    satisfied: '',
                });
                await WSRestWorkflowStepMother.createEndpointStep(repo, {
                    flow_id: flow.id.value,
                    conditional_id: conditional.id.value,
                    order: 1,
                });

                await executor.execute({ flow_id: flow.id.value, initial_context: { value: 1, expected: 1 } });
                const eventLog = await repo
                    .connection('event_logs')
                    .where({ event_name: 'ws-rest-flows.executed', aggregate_id: flow.id.value })
                    .first();

                // Assert: la condición fue verdadera pero, al no haber `satisfied`, no se
                // ejecuta ninguna sub-rama (executedBranch se queda en null).
                expect(eventLog.body.steps_executed[0].metadata).toMatchObject({
                    evaluated: true,
                    result: true,
                    executedBranch: null,
                });
            });
        });

        it('con unsatisfied vacío ("") en un operador que evalúa false, no intenta ejecutar la rama insatisfecha', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepo);
                const conditional = await WSRestConditionalMother.create(conditionalRepo, {
                    operator: 'eq',
                    input_path_a: 'value',
                    input_path_b: 'expected',
                    unsatisfied: '',
                });
                await WSRestWorkflowStepMother.createEndpointStep(repo, {
                    flow_id: flow.id.value,
                    conditional_id: conditional.id.value,
                    order: 1,
                });

                await executor.execute({ flow_id: flow.id.value, initial_context: { value: 1, expected: 2 } });
                const eventLog = await repo
                    .connection('event_logs')
                    .where({ event_name: 'ws-rest-flows.executed', aggregate_id: flow.id.value })
                    .first();

                // Assert
                expect(eventLog.body.steps_executed[0].metadata).toMatchObject({
                    evaluated: true,
                    result: false,
                    executedBranch: null,
                });
            });
        });

        it('regexOr con el primer path vacío (val1Path falsy) solo evalúa val2', async () => {
            // Arrange & Act
            await TenantContext.run(tenant, async () => {
                const flow = await WSRestFlowMother.create(flowRepo);
                const fn = await WSRestFunctionMother.create(functionRepo, {
                    type: 'regexOr',
                    filter_input: { filter_input: ['', 'path_b'] },
                    context_position: 'regex_val1_falsy',
                    value_dynamic: false,
                    value_static: '^[a-z]+[0-9]+$',
                });
                await WSRestWorkflowStepMother.createEndpointStep(repo, {
                    flow_id: flow.id.value,
                    function_id: fn.id.value,
                    order: 1,
                });

                const resultContext = await executor.execute({
                    flow_id: flow.id.value,
                    initial_context: { path_b: 'world99' },
                });

                // Assert
                expect(resultContext.get().context.regex_val1_falsy).toBe('world99');
            });
        });
    });
});
