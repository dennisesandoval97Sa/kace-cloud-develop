import { Action } from '../../../src/actions/index.js';
import { CallWsService } from '../../../src/actions/domain/types/CallWsService.js';
import { Case, KnexCaseRepository } from '../../../src/cases/index.js';
import { knexConfig } from '../../knexfile.js';
import { KnexWSRestFlowRepository } from '../../../src/ws-rest-flows/index.js';
import ActionMother from '../../actions/domain/ActionMother.js';
import CasesMother from '../../cases/domain/CasesMother.js';
import WSRestFlowMother from '../../ws-rest-flows/domain/WSRestFlowMother.js';
import { v4 as uuidV4 } from 'uuid';
import { KnexWSRestWorkflowStepRepository } from '../../../src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository.js';
import { KnexSecretsVaultRepository } from '../../../src/secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository.js';
import { KnexAllowedConnectionsRepository } from '../../../src/allowed-conections/index.js';
import { jest } from '@jest/globals';
import { AxiosHttpClient } from '../../../src/shared/infrastructure/http/AxiosHttpClient.js';
import { WSRestWorkflowStepCreator } from '../../../src/ws-rest-workflow-step/application/create/WSRestWorkflowStepCreator.js';
import WSRestEndpointMother from '../../ws-rest-endpoints/domain/WSRestEndpointMother.js';
import WSRestFunctionMother from '../../ws_rest_functions/domain/WSRestFunctionMother.js';
import { KnexWSRestEndpointRepository } from '../../../src/ws-rest-endpoints/infrastructure/persistence/KnexWSRestEndpointRepository.js';
import { KnexWSRestFunctionRepository } from '../../../src/ws_rest_functions/infrastructure/persistence/KnexWSRestFunctionRepository.js';
import AllowedConnectionsMother from '../../allowed-conections/domain/AllowedConnectionsMother.js';
import { User } from '../../../src/users/index.js';
import UsersMother from '../../users/domain/UsersMother.js';
import LocalTenantRepository from '../../../src/tenant/infrastructure/local/LocalTenantRepository.js';
import { TenantContext } from '../../../src/shared/infrastructure/context/TenantContext.js';

const tenant = await new LocalTenantRepository().find();

describe('CallWsService', () => {
    const caseRepository = new KnexCaseRepository(knexConfig);

    const wsRestFlowRepository = new KnexWSRestFlowRepository(caseRepository.connection);
    const wsRestWorkflowStepRepository = new KnexWSRestWorkflowStepRepository(caseRepository.connection);
    const secretRepository = new KnexSecretsVaultRepository(caseRepository.connection);
    const allowedConnectionRepository = new KnexAllowedConnectionsRepository(caseRepository.connection);
    const endpointRepository = new KnexWSRestEndpointRepository(caseRepository.connection);
    const functionRepository = new KnexWSRestFunctionRepository(caseRepository.connection);

    const callWsService = new CallWsService(
        caseRepository,
        wsRestFlowRepository,
        wsRestWorkflowStepRepository,
        secretRepository,
        allowedConnectionRepository,
        new User(UsersMother.dto()),
        { initialData: 'test-value' }
    );

    it('should return false if the caseEntity is not an instance of Case', async () => {
        const invalidCase = {};
        const validAction = Action.create(ActionMother.dto({ external_user_code: '123' }));

        const result = await callWsService.execute(invalidCase, validAction);
        expect(result).toBe(false);
    });

    it('should return false if the action is not an instance of Action', async () => {
        const validCase = Case.create(CasesMother.dto());
        const invalidAction = {};

        const result = await callWsService.execute(validCase, invalidAction);
        expect(result).toBe(false);
    });

    it('should return false if the wsRestFlow is not found', async () => {
        const validCase = await CasesMother.createCase(caseRepository);
        const validAction = Action.create(ActionMother.dto({ ws_rest_flow_id: uuidV4() }));

        const result = await callWsService.execute(validCase, validAction);
        expect(result).toBe(false);
    });

    it('should return false if the steps not found', async () => {
        const validCase = await CasesMother.createCase(caseRepository);

        const wsRestFlow = await WSRestFlowMother.create(wsRestFlowRepository);

        const validAction = Action.create(ActionMother.dto({ ws_rest_flow_id: wsRestFlow.id.value }));

        const result = await callWsService.execute(validCase, validAction);
        expect(result).toBe(false);
    });

    it('Should return true when all conditions are met and execute the workflow', async () => {
        await TenantContext.run(tenant, async () => {
            const validCase = await CasesMother.createCase(caseRepository);
            const wsRestFlow = await WSRestFlowMother.create(wsRestFlowRepository, {
                external_code: 'test_workflow',
            });
            const validAction = Action.create(ActionMother.dto({ ws_rest_flow_id: wsRestFlow.id.value }));

            const wsRestEndpoint = await WSRestEndpointMother.create(endpointRepository, {
                description: 'Endpoint de prueba',
                url: 'https://api.example.com/test',
                method: 'GET',
                filter_input: { filter_input: [] },
                is_dynamic_body: true,
                body: {
                    body: {
                        value1: 'valor prueba',
                        value2: 'context.initialData',
                        second: {
                            value1: 'context.initialData',
                            value2: true,
                            third: {
                                value1: 'context.initialData',
                                value2: 10,
                                value3: null,
                            },
                        },
                    },
                },
                headers: { headers: { 'Content-Type': 'application/json' } },
                context_position: 'testEndpointResult',
                on_success: { on_success: {} },
                on_error: { on_error: {} },
            });

            const wsRestFunction = await WSRestFunctionMother.create(functionRepository, {
                description: 'Función de formateo',
                type: 'formatDate',
                context_position: 'testFunctionResult',
                value_dynamic: false,
                filter_input: { filter_input: [] },
                value_static: new Date().toISOString(),
                on_success: { on_success: {} },
                on_error: { on_error: {} },
            });

            const stepCreator = new WSRestWorkflowStepCreator(wsRestWorkflowStepRepository);
            await stepCreator.execute({
                id: uuidV4(),
                flow_id: wsRestFlow.id.value,
                endpoint_id: wsRestEndpoint.id.value,
                function_id: null,
                order: 1,
                created_by: uuidV4(),
                created_at: new Date().toISOString(),
            });

            await stepCreator.execute({
                id: uuidV4(),
                flow_id: wsRestFlow.id.value,
                endpoint_id: null,
                function_id: wsRestFunction.id.value,
                order: 2,
                created_by: uuidV4(),
                created_at: new Date().toISOString(),
            });

            await AllowedConnectionsMother.createAllowedConnection(allowedConnectionRepository, {
                connection: 'api.example.com',
                has_ssl: true,
            });

            const requestSpy = jest.spyOn(AxiosHttpClient.prototype, 'request').mockResolvedValue({
                status: 200,
                data: { success: true },
                headers: {},
            });

            const result = await callWsService.execute(validCase, validAction);

            expect(result).toBe(true);
            expect(requestSpy).toHaveBeenCalledTimes(1);
            expect(requestSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: 'https://api.example.com/test',
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    data: {
                        value1: 'valor prueba',
                        value2: 'test-value',
                        second: {
                            value1: 'test-value',
                            value2: true,
                            third: {
                                value1: 'test-value',
                                value2: 10,
                                value3: null,
                            },
                        },
                    },
                })
            );

            requestSpy.mockRestore();
        });
    });

    it('should log an event when WS flow is executed successfully', async () => {
        const validCase = await CasesMother.createCase(caseRepository);
        const wsRestFlow = await WSRestFlowMother.create(wsRestFlowRepository, {
            external_code: 'loggable_flow',
        });

        const validAction = Action.create(
            ActionMother.dto({
                ws_rest_flow_id: wsRestFlow.id.value,
                description: 'Ejecutar flujo WS REST',
            })
        );

        const wsRestEndpoint = await WSRestEndpointMother.create(endpointRepository, {
            url: 'https://api.example.com/log',
            method: 'POST',
            filter_input: { filter_input: [] },
            is_dynamic_body: false,
            body: { body: { msg: 'hello' } },
            headers: { headers: { 'Content-Type': 'application/json' } },
            context_position: 'responseLog',
            on_success: { on_success: {} },
            on_error: { on_error: {} },
        });

        const stepCreator = new WSRestWorkflowStepCreator(wsRestWorkflowStepRepository);
        await stepCreator.execute({
            id: uuidV4(),
            flow_id: wsRestFlow.id.value,
            endpoint_id: wsRestEndpoint.id.value,
            function_id: null,
            order: 1,
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
        });

        await AllowedConnectionsMother.createAllowedConnection(allowedConnectionRepository, {
            connection: 'api.example.com',
            has_ssl: true,
        });

        const requestSpy = jest.spyOn(AxiosHttpClient.prototype, 'request').mockResolvedValue({
            status: 200,
            data: { ok: true },
            headers: {},
        });

        const trigger = 'integration_test';

        const result = await callWsService.execute(validCase, validAction, trigger);

        expect(result).toBe(true);

        const eventLog = await caseRepository
            .connection('event_logs')
            .select('*')
            .where({ event_name: 'ws-rest-flows.executed' })
            .first();

        expect(eventLog).toBeDefined();

        const body = eventLog.body;
        expect(body).toBeDefined();
        expect(body.flow).toBeDefined();
        expect(body.flow.id).toBe(wsRestFlow.id.value);
        expect(body.actionType).toBe(CallWsService.ACTION_TYPE);
        expect(body.trigger).toBe('action');
        expect(body.execution_status).toBe('success');

        const oldData = eventLog.old_data;
        expect(oldData).toBeDefined();
        expect(oldData.grupo_id).toBe(validCase.grupo_id.value);
        expect(oldData.transicion_id).toBe(validCase.transicion_id.value);
        expect(oldData.responsable_id).toBe(validCase.responsable_id.value);

        requestSpy.mockRestore();
    });
    describe('non-case entity context wrapping', () => {
        let callWsServiceForEntity;

        beforeEach(() => {
            callWsServiceForEntity = new CallWsService(
                caseRepository,
                wsRestFlowRepository,
                wsRestWorkflowStepRepository,
                secretRepository,
                allowedConnectionRepository,
                new User(UsersMother.dto()),
                {}
            );
        });

        it('should wrap user entity data under "user" key in context', async () => {
            const user = new User(UsersMother.dto());
            const wsRestFlow = await WSRestFlowMother.create(wsRestFlowRepository, {
                external_code: 'user_context_test',
            });
            const validAction = Action.create(
                ActionMother.dto({
                    ws_rest_flow_id: wsRestFlow.id.value,
                    entity: 'user',
                })
            );

            const wsRestEndpoint = await WSRestEndpointMother.create(endpointRepository, {
                url: 'https://api.example.com/user-test',
                method: 'POST',
                filter_input: { filter_input: [] },
                is_dynamic_body: true,
                body: { body: { userId: 'context.user.id' } },
                headers: { headers: { 'Content-Type': 'application/json' } },
                context_position: 'userResult',
                on_success: { on_success: {} },
                on_error: { on_error: {} },
            });

            const stepCreator = new WSRestWorkflowStepCreator(wsRestWorkflowStepRepository);
            await stepCreator.execute({
                id: uuidV4(),
                flow_id: wsRestFlow.id.value,
                endpoint_id: wsRestEndpoint.id.value,
                function_id: null,
                order: 1,
                created_by: uuidV4(),
                created_at: new Date().toISOString(),
            });

            await AllowedConnectionsMother.createAllowedConnection(allowedConnectionRepository, {
                connection: 'api.example.com',
                has_ssl: true,
            });

            const requestSpy = jest.spyOn(AxiosHttpClient.prototype, 'request').mockResolvedValue({
                status: 200,
                data: { success: true },
                headers: {},
            });

            const result = await callWsServiceForEntity.execute(user, validAction);

            expect(result).toBe(true);
            expect(requestSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: { userId: user.id.value },
                })
            );

            requestSpy.mockRestore();
        });

        it('should wrap group entity data under "group" key in context', async () => {
            const { Groups } = await import('../../../src/grupos/index.js');
            const { GroupsMother } = await import('../../grupos/domain/GroupsMother.js');

            const group = new Groups(GroupsMother.dto());
            const wsRestFlow = await WSRestFlowMother.create(wsRestFlowRepository, {
                external_code: 'group_context_test',
            });
            const validAction = Action.create(
                ActionMother.dto({
                    ws_rest_flow_id: wsRestFlow.id.value,
                    entity: 'group',
                })
            );

            const wsRestEndpoint = await WSRestEndpointMother.create(endpointRepository, {
                url: 'https://api.example.com/group-test',
                method: 'POST',
                filter_input: { filter_input: [] },
                is_dynamic_body: true,
                body: { body: { groupId: 'context.group.id' } },
                headers: { headers: { 'Content-Type': 'application/json' } },
                context_position: 'groupResult',
                on_success: { on_success: {} },
                on_error: { on_error: {} },
            });

            const stepCreator = new WSRestWorkflowStepCreator(wsRestWorkflowStepRepository);
            await stepCreator.execute({
                id: uuidV4(),
                flow_id: wsRestFlow.id.value,
                endpoint_id: wsRestEndpoint.id.value,
                function_id: null,
                order: 1,
                created_by: uuidV4(),
                created_at: new Date().toISOString(),
            });

            await AllowedConnectionsMother.createAllowedConnection(allowedConnectionRepository, {
                connection: 'api.example.com',
                has_ssl: true,
            });

            const requestSpy = jest.spyOn(AxiosHttpClient.prototype, 'request').mockResolvedValue({
                status: 200,
                data: { success: true },
                headers: {},
            });

            const result = await callWsServiceForEntity.execute(group, validAction);

            expect(result).toBe(true);
            expect(requestSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: { groupId: group.id.value },
                })
            );

            requestSpy.mockRestore();
        });
    });
});
