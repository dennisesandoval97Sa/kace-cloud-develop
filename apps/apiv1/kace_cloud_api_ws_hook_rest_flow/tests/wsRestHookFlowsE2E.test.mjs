import { KnexWSRestWorkflowStepRepository } from '@kace/core/src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository.js';
import { KnexWSRestFlowRepository } from '@kace/core/src/ws-rest-flows/infrastructure/persistence/KnexWSRestFlowRepository.js';
import { KnexWSRestFunctionRepository } from '@kace/core/src/ws_rest_functions/infrastructure/persistence/KnexWSRestFunctionRepository.js';
import { KnexWSRestEndpointRepository } from '@kace/core/src/ws-rest-endpoints/infrastructure/persistence/KnexWSRestEndpointRepository.js';
import { KnexAllowedConnectionsRepository } from '@kace/core/src/allowed-conections/infrastructure/persistence/KnexAllowedConnectionsRepository.js';
import { KnexWSRestConditionalRepository } from '@kace/core/src/ws-rest-conditionals/infrastructure/persistence/KnexWSRestConditionalRepository.js';
import { WSRestWorkflowStepCreator } from '@kace/core/src/ws-rest-workflow-step/application/create/WSRestWorkflowStepCreator.js';
import WSRestFlowMother from '@kace/core/tests/ws-rest-flows/domain/WSRestFlowMother.js';
import WSRestFunctionMother from '@kace/core/tests/ws_rest_functions/domain/WSRestFunctionMother.js';
import WSRestEndpointMother from '@kace/core/tests/ws-rest-endpoints/domain/WSRestEndpointMother.js';
import AllowedConnectionMother from '@kace/core/tests/allowed-connections/domain/AllowedConnectionsMother.js';
import WSRestConditionalMother from '@kace/core/tests/ws-rest-conditionals/domain/WSRestConditionalMother.js';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { v4 as uuid } from 'uuid';
import { Helper } from '@kace/core/src/shared/index.js';
import { HttpMethods } from '@kace/core/src/ws-rest-endpoints/domain/HttpMethods.js';

describe('WSRestHookFlowsController E2E test', () => {
    const workflowStepRepository = new KnexWSRestWorkflowStepRepository(knexConfig);
    const flowRepository = new KnexWSRestFlowRepository(knexConfig);
    const functionRepository = new KnexWSRestFunctionRepository(knexConfig);
    const endpointRepository = new KnexWSRestEndpointRepository(knexConfig);
    const allowedConnectionRepository = new KnexAllowedConnectionsRepository(knexConfig);
    const conditionalRepository = new KnexWSRestConditionalRepository(knexConfig);
    const stepCreator = new WSRestWorkflowStepCreator(workflowStepRepository);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/ws-hook-rest-flow`
            : `http://127.0.0.1:60055`;

    let flowExternalCode;
    let pokemonFlowId;
    let conditionalFlowId;
    let conditionalFlowExternalCode;

    beforeAll(async () => {
        try {
            Helper.logInfo('Iniciando la configuración de prueba E2E');

            await AllowedConnectionMother.createAllowedConnection(allowedConnectionRepository, {
                connection: 'pokeapi.co',
                has_ssl: true,
            });

            flowExternalCode = `pokemon_flow_${Date.now()}`;
            const flowResponse = await WSRestFlowMother.create(flowRepository, {
                description: 'Pokemon Flow E2E Test',
                external_code: flowExternalCode,
            });

            pokemonFlowId = flowResponse.id.value;

            const pokemonEndpoint = await WSRestEndpointMother.create(endpointRepository, {
                description: 'Endpoint para obtener datos de Pikachu',
                url: 'https://pokeapi.co/api/v2/pokemon/pikachu',
                method: HttpMethods.GET.value,
                headers: { headers: { Accept: 'application/json' } },
                body: { body: {} },
                is_dynamic_body: false,
                is_dynamic_header: false,
                context_position: 'pokemon',
                filter_input: {
                    filter_input: ['data.forms[0].name', 'data.abilities'],
                },
                type: 'consumption',
            });

            const toUpperCaseFunction = await WSRestFunctionMother.create(functionRepository, {
                description: 'Convertir nombre del Pokemon a mayúsculas',
                type: 'toUpperCase',
                filter_input: { filter_input: ['pokemon.name'] },
                context_position: 'results.pokemon',
                value_dynamic: false,
                value_static: null,
            });

            await stepCreator.execute({
                id: uuid(),
                flow_id: pokemonFlowId,
                endpoint_id: pokemonEndpoint.id.value,
                function_id: null,
                conditional_id: null,
                order: 1,
                created_by: uuid(),
                created_at: new Date().toISOString(),
            });

            await stepCreator.execute({
                id: uuid(),
                flow_id: pokemonFlowId,
                endpoint_id: null,
                function_id: toUpperCaseFunction.id.value,
                conditional_id: null,
                order: 2,
                created_by: uuid(),
                created_at: new Date().toISOString(),
            });

            conditionalFlowExternalCode = `conditional_flow_${Date.now()}`;
            const conditionalFlowResponse = await WSRestFlowMother.create(flowRepository, {
                description: 'Conditional Flow E2E Test',
                external_code: conditionalFlowExternalCode,
            });

            conditionalFlowId = conditionalFlowResponse.id.value;

            const numberEndpoint = await WSRestEndpointMother.create(endpointRepository, {
                description: 'Mock endpoint returning a number',
                url: 'https://pokeapi.co/api/v2/pokemon/1',
                method: HttpMethods.GET.value,
                headers: { headers: { Accept: 'application/json' } },
                body: { body: {} },
                is_dynamic_body: false,
                is_dynamic_header: false,
                context_position: 'number_data',
                filter_input: { filter_input: ['data.id'] },
                type: 'consumption',
            });

            const satisfiedEndpoint = await WSRestEndpointMother.create(endpointRepository, {
                description: 'Endpoint when condition is satisfied',
                url: 'https://pokeapi.co/api/v2/pokemon/bulbasaur',
                method: HttpMethods.GET.value,
                headers: { headers: { Accept: 'application/json' } },
                body: { body: {} },
                is_dynamic_body: false,
                is_dynamic_header: false,
                context_position: 'satisfied_result',
                filter_input: { filter_input: ['data.name'] },
                type: 'consumption',
            });

            const unsatisfiedEndpoint = await WSRestEndpointMother.create(endpointRepository, {
                description: 'Endpoint when condition is not satisfied',
                url: 'https://pokeapi.co/api/v2/pokemon/charmander',
                method: HttpMethods.GET.value,
                headers: { headers: { Accept: 'application/json' } },
                body: { body: {} },
                is_dynamic_body: false,
                is_dynamic_header: false,
                context_position: 'unsatisfied_result',
                filter_input: { filter_input: ['data.name'] },
                type: 'consumption',
            });

            const conditional = await WSRestConditionalMother.create(conditionalRepository, {
                satisfied: satisfiedEndpoint.id.value,
                unsatisfied: unsatisfiedEndpoint.id.value,
                operator: 'eq',
                input_path_a: 'number_data.id',
                input_path_b: '1',
            });

            await stepCreator.execute({
                id: uuid(),
                flow_id: conditionalFlowId,
                endpoint_id: numberEndpoint.id.value,
                function_id: null,
                conditional_id: null,
                order: 1,
                created_by: uuid(),
                created_at: new Date().toISOString(),
            });

            await stepCreator.execute({
                id: uuid(),
                flow_id: conditionalFlowId,
                endpoint_id: null,
                function_id: null,
                conditional_id: conditional.id.value,
                order: 2,
                created_by: uuid(),
                created_at: new Date().toISOString(),
            });

            Helper.logInfo('Configuración de prueba E2E completada');
        } catch (error) {
            Helper.logError('Error durante la configuración de la prueba E2E:', error);
            throw error;
        }
    });

    afterAll(async () => {
        try {
            await workflowStepRepository.connection.destroy();
        } catch (error) {
            Helper.logError('Error al cerrar la conexión:', error);
        }
    });

    it('should execute a Pokemon workflow and transform the name to uppercase', async () => {
        const payload = { external_code: flowExternalCode };
        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();

        const responseData = response.data;

        expect(responseData).toHaveProperty('data');
        expect(responseData.data).toHaveProperty('context');

        const context = responseData.data.context;
        expect(context).toHaveProperty('pokemon');
        expect(context.pokemon).toHaveProperty('name', 'pikachu');
        expect(context.pokemon).toHaveProperty('abilities');

        expect(context.results.pokemon).toHaveProperty('name', 'PIKACHU');
    });

    it('should execute the Pokemon workflow by flow_id', async () => {
        const payload = { flow_id: pokemonFlowId };
        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();

        expect(response.data.data.context.results.pokemon).toHaveProperty('name', 'PIKACHU');
    });

    it('should execute a conditional workflow when condition is satisfied', async () => {
        const payload = { external_code: conditionalFlowExternalCode };
        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();

        const context = response.data.data.context;
        expect(context).toHaveProperty('number_data');
        expect(context.number_data).toHaveProperty('id', 1);
        expect(context).toHaveProperty('satisfied_result');
        expect(context.satisfied_result).toHaveProperty('name', 'bulbasaur');
    });

    it('should execute the conditional workflow by flow_id', async () => {
        const payload = { flow_id: conditionalFlowId };
        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();

        expect(response.data.data.context.satisfied_result).toHaveProperty('name', 'bulbasaur');
    });
});
