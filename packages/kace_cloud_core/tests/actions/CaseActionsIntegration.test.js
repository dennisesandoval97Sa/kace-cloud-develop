import { ActionTriggers, ActionTypes, KnexActionRepository } from '../../src/actions/index.js';
import {
    Case,
    CaseCreator,
    CaseUpdater,
    DomainCaseFinder,
    KnexCaseRepository,
    KnexSubcaseRelationshipRepository,
} from '../../src/cases/index.js';
import { v4 as uuid } from 'uuid';

import ActionMother from './domain/ActionMother.js';
import CasesMother from '../cases/domain/CasesMother.js';
import UsersMother from '../users/domain/UsersMother.js';
import { GroupsMother } from '../grupos/domain/GroupsMother.js';
import UserGroupRelationshipMother from '../user-group-relationships/domain/UserGroupRelationshipMother.js';
import { AuxCasesMother } from '../aux_casos/domain/AuxCasesMother.js';
import ClientMother from '../clients/domain/ClientMother.js';
import ClassificationsMother from '../classifications/domain/ClassificationsMother.js';
import { StateMother } from '../state/domain/StateMother.js';
import { TransitionsMother } from '../transition/domain/TransitionsMother.js';
import WSRestFlowMother from '../ws-rest-flows/domain/WSRestFlowMother.js';
import WSRestEndpointMother from '../ws-rest-endpoints/domain/WSRestEndpointMother.js';
import WSRestFunctionMother from '../ws_rest_functions/domain/WSRestFunctionMother.js';
import { HttpMethods } from '../../src/ws-rest-endpoints/domain/HttpMethods.js';
import { WSRestWorkflowStepCreator } from '../../src/ws-rest-workflow-step/application/create/WSRestWorkflowStepCreator.js';
import AllowedConnectionsMother from '../allowed-conections/domain/AllowedConnectionsMother.js';
import { AxiosHttpClient } from '../../src/shared/infrastructure/http/AxiosHttpClient.js';
import { jest } from '@jest/globals';

import { ActionExecutor } from '../../src/shared/domain/services/ActionExecutor.js';
import { ActionExecutionDomainService } from '../../src/actions/domain/ActionExecutionDomainService.js';
import { KnexShiftManagementRepository, ShiftManagement } from '../../src/shift-management/index.js';
import { KnexUserGroupRelationshipRepository } from '../../src/user-group-relationships/index.js';

import { KnexUsersRepository } from '../../src/users/index.js';
import { KnexGroupsRepository } from '../../src/grupos/index.js';
import { KnexClassificationRepository } from '../../src/classifications/index.js';
import { KnexTemplatesRepository } from '../../src/templates/index.js';
import { KnexMailAccountRepository } from '../../src/mail-accounts/index.js';
import { ActionUpdateModel, KnexActionUpdateModelRepository } from '../../src/action-update-model/index.js';
import { KnexWSRestFlowRepository } from '../../src/ws-rest-flows/index.js';
import { KnexGlobalConfigurationRepository } from '../../src/global-config/index.js';
import { KnexClientRepository } from '../../src/clients/index.js';
import { KnexAuxCasesRepository } from '../../src/aux_casos/index.js';
import { KnexAuxClientsRepository } from '../../src/aux_clientes/index.js';
import { KnexSecretsVaultRepository } from '../../src/secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository.js';
import { KnexTransitionsRepository } from '../../src/transition/index.js';
import { KnexStateRepository } from '../../src/state/index.js';
import { KnexAllowedConnectionsRepository } from '../../src/allowed-conections/index.js';
import { AssignationsEnum, TenantContext } from '../../src/shared/index.js';
import { KnexWSRestWorkflowStepRepository } from '../../src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository.js';
import { KnexWSRestEndpointRepository } from '../../src/ws-rest-endpoints/index.js';
import { KnexWSRestFunctionRepository } from '../../src/ws_rest_functions/infrastructure/persistence/KnexWSRestFunctionRepository.js';
import { ActionCreator } from '../../src/actions/index.js';
import { Helper } from '../../src/shared/index.js';
import { UserCreator } from '../../src/users/index.js';
import { GroupCreator } from '../../src/grupos/index.js';
import TemplatesMother from '../templates/domain/TemplatesMother.js';
import MailAccountMother from '../mail-accounts/domain/MailAccountMother.js';
import { EventLogger } from '../../src/shared/EventLogger.js';
import { GlobalConfigurationsMother } from '../global-config/domain/GlobalConfigurationsMother.js';
import UserListMother from '../user-lists/domain/UserListMother.js';
import { KnexUserListsRepository } from '../../src/user-lists/index.js';
import AnsMother from '../ans/domain/AnsMother.js';
import { KnexAnsRepository } from '../../src/ans/index.js';
import { knexConfig } from '../knexfile.js';
import TestHelper from '../TestHelper.js';
import FlowsMother from '../flow/domain/FlowsMother.js';
import { globalRoleId, globalSystemUserId } from '@kace/database/seeds/20241125105900_usuario_base.js';
import { KnexFlowRepository } from '../../src/flow/index.js';
import { globalGroupId } from '@kace/database/seeds/20250128045401_rel_user_group.js';
import CaseDescriptionsMother from '../case-descriptions/domain/CaseDescriptionsMother.js';
import { KnexCaseDescriptionRepository } from '../../src/case-descriptions/index.js';
import { globalConfigurationId } from '@kace/database/seeds/20241125105901_configuration.js';
import ShiftManagementMother from '../shift-management/domain/ShiftManagementMother.js';
import LocalTenantRepository from '../../src/tenant/infrastructure/local/LocalTenantRepository.js';
import ExecuteActionsOnCaseCreated from '../../src/cases/application/event-handlers/ExecuteActionsOnCaseCreated.js';
import ExecuteActionsOnCaseUpdated from '../../src/cases/application/event-handlers/ExecuteActionsOnCaseUpdated.js';
import { EntityActionExecutionServiceFactory } from '../../src/actions/infrastructure/EntityActionExecutionServiceFactory.js';

/**
 * This method creates and returns an instance of the ActionExecutionService.
 * @param {Knex} knexInstance - The configuration object for Knex, used to initialize repositories.
 * @returns {ActionExecutionDomainService} The service responsible for action execution
 */
const createActionExecutionService = (knexInstance) => {
    const actionRepository = new KnexActionRepository(knexInstance);
    const caseRepository = new KnexCaseRepository(knexInstance);
    const usersRepository = new KnexUsersRepository(knexInstance);
    const grouRepository = new KnexGroupsRepository(knexInstance);
    const classificationRepository = new KnexClassificationRepository(knexInstance);
    const templatesRepository = new KnexTemplatesRepository(knexInstance);
    const mailAccountRepository = new KnexMailAccountRepository(knexInstance);
    const actionUpdateModelRepository = new KnexActionUpdateModelRepository(knexInstance);
    const wsRestFlowRepository = new KnexWSRestFlowRepository(knexInstance);
    const globalConfigurationRepository = new KnexGlobalConfigurationRepository(knexInstance);
    const clientRepository = new KnexClientRepository(knexInstance);
    const auxCasesRepository = new KnexAuxCasesRepository(knexInstance);
    const auxClientsRepository = new KnexAuxClientsRepository(knexInstance);
    const secretRepository = new KnexSecretsVaultRepository(knexInstance);
    const allowedConnectionsRepository = new KnexAllowedConnectionsRepository(knexInstance);
    const wsRestWorkflowStepRepository = new KnexWSRestWorkflowStepRepository(knexInstance);
    const subcaseRelationshipRepository = new KnexSubcaseRelationshipRepository(knexInstance);
    const userListRepository = new KnexUserListsRepository(knexInstance);

    const executor = new ActionExecutor(
        caseRepository,
        usersRepository,
        grouRepository,
        classificationRepository,
        templatesRepository,
        mailAccountRepository,
        actionUpdateModelRepository,
        wsRestFlowRepository,
        globalConfigurationRepository,
        clientRepository,
        auxCasesRepository,
        auxClientsRepository,
        secretRepository,
        allowedConnectionsRepository,
        wsRestWorkflowStepRepository,
        subcaseRelationshipRepository,
        userListRepository
    );
    return new ActionExecutionDomainService(actionRepository, executor, caseRepository);
};

const tenant = await new LocalTenantRepository().find();

describe('Action Integration Tests', () => {
    const actionRepository = new KnexActionRepository(knexConfig);
    const caseRepository = new KnexCaseRepository(actionRepository.connection);
    const auxCasesRepository = new KnexAuxCasesRepository(actionRepository.connection);
    const usersRepository = new KnexUsersRepository(actionRepository.connection);
    const actionExecutionService = createActionExecutionService(actionRepository.connection);
    const clientRepository = new KnexClientRepository(actionRepository.connection);
    const classificationRepository = new KnexClassificationRepository(actionRepository.connection);
    const transitionsRepository = new KnexTransitionsRepository(actionRepository.connection);
    const stateRepository = new KnexStateRepository(actionRepository.connection);
    const flowRepository = new KnexFlowRepository(actionRepository.connection);
    const ansRepository = new KnexAnsRepository(actionRepository.connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(actionRepository.connection);
    const groupsRepository = new KnexGroupsRepository(actionRepository.connection);
    const userGroupRelationshipRepository = new KnexUserGroupRelationshipRepository(actionRepository.connection);
    const templatesRepository = new KnexTemplatesRepository(actionRepository.connection);
    const mailAccountRepository = new KnexMailAccountRepository(actionRepository.connection);
    const globalConfigurationRepository = new KnexGlobalConfigurationRepository(actionRepository.connection);
    const userListRepository = new KnexUserListsRepository(actionRepository.connection);
    const caseDescriptionRepository = new KnexCaseDescriptionRepository(actionRepository.connection);

    /**
     * Desde f221ef838 ni `CaseUpdater` ni `CaseCreator` ejecutan acciones: publican
     * `CaseUpdated`/`CaseCreated` y quien las corre es el event_processor a traves
     * de estos handlers. El parametro `actionExecutionService` del constructor
     * sigue existiendo pero ya no se usa, asi que estos tests se quedaban sin
     * ejecutar accion alguna. Aqui se da ese segundo salto a mano, igual que hace
     * `tests/cases/CasesIntegration.test.js` con `ExecuteActionsOnCaseCreated`.
     */
    const runCaseUpdatedActions = (caseId, trigger) =>
        new ExecuteActionsOnCaseUpdated(caseRepository, actionExecutionService).handle({
            aggregateId: caseId,
            payload: { trigger },
        });

    const runCaseCreatedActions = (caseId) =>
        new ExecuteActionsOnCaseCreated(caseRepository, actionExecutionService).handle({ aggregateId: caseId });

    /**
     * `UserCreator` y `GroupCreator` si siguen ejecutando acciones en linea, pero
     * contra el servicio de entidades. El de casos llama a `getCasoInfo` con un
     * User o un Group y muere con "Transaction failed: error retrieving case
     * information", de modo que ninguna accion llegaba a evaluarse. Produccion
     * usa esta misma factoria en `apps/apiv1/kace_cloud_api_users` y `..._group`.
     */
    const entityActionExecutionService = EntityActionExecutionServiceFactory.create(actionRepository);

    async function createCaseWithRelations() {
        const client = await ClientMother.createClient(clientRepository, null, {
            created_by: globalSystemUserId,
        });

        const estadoInicial = await StateMother.createState(stateRepository, {
            nombre: 'Recibido',
            created_by: globalSystemUserId,
        });

        const flujo = await FlowsMother.createFlow(flowRepository, {
            nombre: 'Flujo simple',
            created_by: globalSystemUserId,
        });

        const ans = await AnsMother.createAns(ansRepository, {
            created_by: globalSystemUserId,
        });

        const transition = await TransitionsMother.createTransitionFullRelations(transitionsRepository, {
            estado_actual_id: null,
            siguiente_estado_id: estadoInicial.id.value,
            flujo_id: flujo.id.value,
            ans_id: ans.id.value,
            created_by: globalSystemUserId,
        });

        const classification = await ClassificationsMother.createClassificationWithoutFlow(classificationRepository, {
            flujo_id: flujo.id.value,
            ans_id: ans.id.value,
            default_group_id: globalGroupId,
            created_by: globalSystemUserId,
        });

        const caseDescription = await CaseDescriptionsMother.createCaseDescription(caseDescriptionRepository, {
            created_by: globalSystemUserId,
        });

        const shiftManagement = await ShiftManagementMother.createShiftManagement(shiftManagementRepository, {
            created_by: globalSystemUserId,
        });

        const group = await GroupsMother.createGroupWithRelations(groupsRepository, {
            rol_id: globalRoleId,
            horario_id: shiftManagement.id.value,
            configuration_id: globalConfigurationId,
            created_by: globalSystemUserId,
        });

        const kase = await CasesMother.createCaseWithFullRelations(caseRepository, {
            id: 'd5d98028-5e9a-4b22-a072-f51411683106',
            cliente_id: client.id.value,
            transicion_id: transition.id.value,
            clasificacion_id: classification.id.value,
            responsable_id: globalSystemUserId,
            descripcion_caso_id: caseDescription.id.value,
            grupo_id: globalGroupId,
            parent_id: null,
            created_by: globalSystemUserId,
        });

        const auxCase = await AuxCasesMother.createAuxCase(auxCasesRepository, {
            caso_id: kase.id.value,
            created_by: globalSystemUserId,
        });

        return {
            client,
            estadoInicial,
            flujo,
            ans,
            transition,
            classification,
            caseDescription,
            shiftManagement,
            group,
            kase,
            auxCase,
        };
    }

    afterAll(async () => {
        await actionRepository.destroyConnection();
    });

    it('should return all expected properties for case information', async () => {
        const { kase } = await createCaseWithRelations();
        const json = await actionRepository.getCasoInfo(kase);
        expect(json).toBeDefined();
        expect(json).toHaveProperty('cases');
        expect(json).toHaveProperty('clients');
        expect(json).toHaveProperty('clasificaciones');
        expect(json).toHaveProperty('estados');
    });

    it('should return all expected properties for a case with related entities', async () => {
        const { kase } = await createCaseWithRelations();
        const json = await actionRepository.getCasoInfo(kase);

        expect(json).toBeDefined();
        expect(json).toHaveProperty('cases');
        expect(json).toHaveProperty('aux_cases');
        expect(json.clients).toHaveProperty('documento');
        expect(json.clasificaciones).toHaveProperty('description');
        expect(json.estados).toHaveProperty('nombre');
    });

    it('should execute ASIGNAR_ASESOR_EN_CURSO action when case is updated', async () => {
        const { estadoInicial, flujo, ans, group, kase } = await createCaseWithRelations();
        const action_type = ActionTypes.ASIGNAR_ASESOR_EN_CURSO.value;

        const user = await UsersMother.createUser(usersRepository, {
            rol_id: globalRoleId,
            grupo_activo: group.id.value,
            last_seen_at: new Date().toISOString(),
            created_by: globalSystemUserId,
        });

        await UserGroupRelationshipMother.create(userGroupRelationshipRepository, {
            usuario_id: user.id.value,
            grupo_id: group.id.value,
        });

        const currentAgent = user.id.value;

        const estadoSiguiente = await StateMother.createState(stateRepository, {
            nombre: 'En Proceso',
            created_by: globalSystemUserId,
        });

        const newTransition = await TransitionsMother.createTransitionFullRelations(transitionsRepository, {
            estado_actual_id: estadoInicial.id.value,
            siguiente_estado_id: estadoSiguiente.id.value,
            flujo_id: flujo.id.value,
            ans_id: ans.id.value,
            created_by: globalSystemUserId,
        });

        const conditions = {
            rules: [{ field: 'cases.transicion_id', operator: '=', value: newTransition.id.value }],
            combinator: 'and',
        };

        await ActionMother.create(actionRepository, {
            action_type,
            triggers: [ActionTriggers.STATE_CHANGE.value],
            conditions,
        });

        const caseUpdater = new CaseUpdater(caseRepository, actionExecutionService, user);
        const payload = {
            transicion_id: newTransition.id.value,
            updated_at: new Date(),
            updated_by: currentAgent,
        };
        await caseUpdater.execute(kase.id.value, payload);
        await runCaseUpdatedActions(kase.id.value, ActionTriggers.STATE_CHANGE.value);

        const updateKase = await new DomainCaseFinder(caseRepository).execute(kase.id.value);
        expect(updateKase).toBeInstanceOf(Case);
        expect(updateKase.responsable_id.value).toBe(currentAgent);
        expect(updateKase.grupo_id.value).toBe(group.id.value);
    });

    it('should execute ASIGNAR_GRUPO_EN_CURSO action when case is updated', async () => {
        const { estadoInicial, flujo, ans, group, kase } = await createCaseWithRelations();

        const userCreated = await UsersMother.createUser(usersRepository, {
            rol_id: globalRoleId,
            grupo_activo: group.id.value,
            last_seen_at: new Date().toISOString(),
            created_by: globalSystemUserId,
        });
        const user = await usersRepository.find(userCreated.id);

        await UserGroupRelationshipMother.create(userGroupRelationshipRepository, {
            usuario_id: user.id.value,
            grupo_id: group.id.value,
        });

        const estadoSiguiente = await StateMother.createState(stateRepository, {
            nombre: 'En Proceso',
            created_by: globalSystemUserId,
        });

        const newTransition = await TransitionsMother.createTransitionFullRelations(transitionsRepository, {
            estado_actual_id: estadoInicial.id.value,
            siguiente_estado_id: estadoSiguiente.id.value,
            flujo_id: flujo.id.value,
            ans_id: ans.id.value,
            created_by: globalSystemUserId,
        });

        const conditions = {
            rules: [{ field: 'cases.transicion_id', operator: '=', value: newTransition.id.value }],
            combinator: 'and',
        };

        const action_type = ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value;
        await ActionMother.create(actionRepository, {
            action_type,
            triggers: [ActionTriggers.STATE_CHANGE.value],
            conditions,
        });

        const caseUpdater = new CaseUpdater(caseRepository, actionExecutionService, user);
        await caseUpdater.execute(kase.id.value, {
            transicion_id: newTransition.id.value,
            grupo_id: group.id.value,
            updated_by: user.id.value,
            updated_at: new Date().toISOString(),
        });
        await runCaseUpdatedActions(kase.id.value, ActionTriggers.STATE_CHANGE.value);

        const updateKase = await new DomainCaseFinder(caseRepository).execute(kase.id.value);
        expect(updateKase).toBeInstanceOf(Case);
        expect(kase.grupo_id.value).not.toBe(updateKase.grupo_id.value);
        expect(updateKase.grupo_id.value).toBe(group.id.value);
        expect(updateKase.responsable_id.value).toBe(user.id.value);
    });

    it('should execute CONSUMO_REST_FLOW action when case is updated', async () => {
        await TenantContext.run(tenant, async () => {
            const { estadoInicial, flujo, ans, kase } = await createCaseWithRelations();

            const wsRestEndpointRepository = new KnexWSRestEndpointRepository(actionRepository.connection);
            const wsRestFunctionRepository = new KnexWSRestFunctionRepository(actionRepository.connection);
            const wsRestFlowRepository = new KnexWSRestFlowRepository(actionRepository.connection);
            const wsRestWorkflowStepRepository = new KnexWSRestWorkflowStepRepository(actionRepository.connection);
            const allowedConnectionRepository = new KnexAllowedConnectionsRepository(actionRepository.connection);

            const wsRestFlow = await WSRestFlowMother.create(wsRestFlowRepository, {
                external_code: 'test_integration_workflow',
            });

            const wsRestEndpoint = await WSRestEndpointMother.create(wsRestEndpointRepository, {
                description: 'Endpoint de prueba para integración',
                url: 'https://api.example.com/test',
                filter_input: { filter_input: [] },
                method: HttpMethods.GET.value,
                headers: { headers: { 'Content-Type': 'application/json' } },
                context_position: 'testEndpointResult',
                on_success: { on_success: {} },
                on_error: { on_error: {} },
            });

            const wsRestFunction = await WSRestFunctionMother.create(wsRestFunctionRepository, {
                description: 'Función de formateo para integración',
                filter_input: { filter_input: [] },
                type: 'formatDate',
                context_position: 'testFunctionResult',
                value_dynamic: false,
                value_static: new Date().toISOString(),
            });

            const stepCreator = new WSRestWorkflowStepCreator(wsRestWorkflowStepRepository);
            await stepCreator.execute({
                id: uuid(),
                flow_id: wsRestFlow.id.value,
                endpoint_id: wsRestEndpoint.id.value,
                function_id: null,
                order: 1,
                created_by: globalSystemUserId,
                created_at: new Date().toISOString(),
            });

            await stepCreator.execute({
                id: uuid(),
                flow_id: wsRestFlow.id.value,
                endpoint_id: null,
                function_id: wsRestFunction.id.value,
                order: 2,
                created_by: globalSystemUserId,
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

            const action_type = ActionTypes.CONSUMO_REST_FLOW.value;

            const estadoSiguiente = await StateMother.createState(stateRepository, {
                nombre: 'En Proceso',
                created_by: globalSystemUserId,
            });

            const currentTransition = await TransitionsMother.createTransitionFullRelations(transitionsRepository, {
                estado_actual_id: estadoInicial.id.value,
                siguiente_estado_id: estadoSiguiente.id.value,
                flujo_id: flujo.id.value,
                ans_id: ans.id.value,
                created_by: globalSystemUserId,
            });

            const conditions = {
                rules: [{ field: 'cases.transicion_id', operator: '=', value: currentTransition.id.value }],
                combinator: 'and',
            };

            await ActionMother.create(actionRepository, {
                action_type,
                triggers: [ActionTriggers.STATE_CHANGE.value],
                conditions,
                ws_rest_flow_id: wsRestFlow.id.value,
            });

            const caseUpdater = new CaseUpdater(caseRepository, actionExecutionService);
            const payload = {
                transicion_id: currentTransition.id.value,
                updated_at: new Date(),
                updated_by: globalSystemUserId,
            };

            const additionalContent = { testField: 'valor de prueba' };

            await caseUpdater.execute(kase.id.value, payload, additionalContent);
            await runCaseUpdatedActions(kase.id.value, ActionTriggers.STATE_CHANGE.value);

            expect(requestSpy).toHaveBeenCalledTimes(1);
            expect(requestSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: 'https://api.example.com/test',
                    method: HttpMethods.GET.value,
                    headers: { 'Content-Type': 'application/json' },
                })
            );

            requestSpy.mockRestore();
        });
    });

    it('ActionExecutionService works with ans case calculate conditions', async () => {
        const { kase } = await createCaseWithRelations();

        const conditions = {
            id: '3d508f2c-a71e-47bb-86fe-0b3959b9123c',
            rules: [
                {
                    id: '71f7e18d-54ae-4474-a79f-405dc77c9dfe',
                    field: 'casos.state_elapsed_minutes',
                    value: '100',
                    operator: '=',
                },
            ],
            combinator: 'and',
        };

        await ActionMother.create(actionRepository, { triggers: [ActionTriggers.STATE_CHANGE.value], conditions });
        await expect(actionExecutionService.execute(ActionTriggers.STATE_CHANGE.value, kase)).resolves.not.toThrow();
    });

    it('should log an event when an Action is executed', async () => {
        const { estadoInicial, flujo, ans, group, kase } = await createCaseWithRelations();
        const action_type = ActionTypes.ASIGNAR_ASESOR_EN_CURSO.value;

        const user = await UsersMother.createUser(usersRepository, {
            rol_id: globalRoleId,
            grupo_activo: group.id.value,
            last_seen_at: new Date().toISOString(),
            created_by: globalSystemUserId,
        });

        await UserGroupRelationshipMother.create(userGroupRelationshipRepository, {
            usuario_id: user.id.value,
            grupo_id: group.id.value,
        });

        const currentAgent = user.id.value;

        const estadoSiguiente = await StateMother.createState(stateRepository, {
            nombre: 'En Proceso',
            created_by: globalSystemUserId,
        });

        const newTransition = await TransitionsMother.createTransitionFullRelations(transitionsRepository, {
            estado_actual_id: estadoInicial.id.value,
            siguiente_estado_id: estadoSiguiente.id.value,
            flujo_id: flujo.id.value,
            ans_id: ans.id.value,
            created_by: globalSystemUserId,
        });

        const conditions = {
            rules: [{ field: 'cases.transicion_id', operator: '=', value: newTransition.id.value }],
            combinator: 'and',
        };

        const action = await ActionMother.create(actionRepository, {
            action_type,
            triggers: [ActionTriggers.STATE_CHANGE.value],
            conditions,
        });

        const caseUpdater = new CaseUpdater(caseRepository, actionExecutionService, user);
        const payload = {
            transicion_id: newTransition.id.value,
            updated_at: new Date(),
            updated_by: currentAgent,
        };

        await caseUpdater.execute(kase.id.value, payload);
        await runCaseUpdatedActions(kase.id.value, ActionTriggers.STATE_CHANGE.value);

        const eventLog = await actionRepository
            .connection('event_logs')
            .where({
                aggregate_id: action.id.value,
                event_name: 'action.executed',
            })
            .first();

        expect(eventLog).toBeDefined();
        expect(eventLog.aggregate_id).toBe(action.id.value);
        expect(eventLog.event_name).toBe('action.executed');

        const body = eventLog.body;
        expect(body.success).toBeDefined();
        expect(body.description).toBeDefined();
        expect(body.actionType).toBe(action.action_type.value);
        expect(body.trigger).toBe(ActionTriggers.STATE_CHANGE.value);
    });

    it('should execute UPDATE_MODEL action with modelo_a_modelo formula', async () => {
        const { estadoInicial, flujo, ans, client, kase, auxCase } = await createCaseWithRelations();
        const actionUpdateModelRepository = new KnexActionUpdateModelRepository(actionRepository.connection);

        // `createCaseWithRelations` deja DOS filas en `aux_cases` para el mismo
        // caso: la que inserta `CasesMother.ensureRelations` y la de
        // `AuxCasesMother`. `findByCaseId` resuelve la suya con un `.first()` sin
        // ORDER BY y la asercion leia con otro `.first()` igual de arbitrario, asi
        // que la escritura de la accion caia en una fila y el test miraba la otra.
        await auxCasesRepository
            .connection('aux_cases')
            .where({ caso_id: kase.id.value })
            .whereNot('id', auxCase.id.value)
            .delete();

        const sourceValue = 'Estado Anterior de Reparación';
        await auxCasesRepository
            .connection('aux_cases')
            .where({ caso_id: kase.id.value })
            .update({
                data: JSON.stringify({
                    responseOrbika: {
                        previous_state_name: sourceValue,
                        repair_status_name: '',
                    },
                }),
            });

        const actionUpdateModel = new ActionUpdateModel({
            id: uuid(),
            description: 'Remplazar etapa vacia O R B I K A',
            aggregate: 'AuxCases',
            field: 'responseOrbika.repair_status_name',
            type: 'formula',
            value: 'AuxCases.responseOrbika.previous_state_name',
            formula: 'modelo_a_modelo',
            created_at: new Date().toISOString(),
            created_by: globalSystemUserId,
        });
        await actionUpdateModelRepository.save(actionUpdateModel);

        const conditions = {
            rules: [{ field: 'cases.cliente_id', operator: '=', value: client.id.value }],
            combinator: 'and',
        };

        await ActionMother.create(actionRepository, {
            action_type: ActionTypes.ACTUALIZAR_MODELO.value,
            triggers: [ActionTriggers.STATE_CHANGE.value],
            conditions,
            model_update_id: actionUpdateModel.id.value,
        });

        const estadoSiguiente = await StateMother.createState(stateRepository, {
            nombre: 'En Proceso',
            created_by: globalSystemUserId,
        });

        const newTransition = await TransitionsMother.createTransitionFullRelations(transitionsRepository, {
            estado_actual_id: estadoInicial.id.value,
            siguiente_estado_id: estadoSiguiente.id.value,
            flujo_id: flujo.id.value,
            ans_id: ans.id.value,
            created_by: globalSystemUserId,
        });

        const caseUpdater = new CaseUpdater(caseRepository, actionExecutionService);
        const payload = {
            transicion_id: newTransition.id.value,
            updated_at: new Date(),
            updated_by: globalSystemUserId,
        };

        await caseUpdater.execute(kase.id.value, payload);
        await runCaseUpdatedActions(kase.id.value, ActionTriggers.STATE_CHANGE.value);

        const updatedAuxCase = await auxCasesRepository
            .connection('aux_cases')
            .where({ caso_id: kase.id.value })
            .first();

        expect(updatedAuxCase).toBeDefined();
        expect(updatedAuxCase.data.responseOrbika).toBeDefined();
        expect(updatedAuxCase.data.responseOrbika.repair_status_name).toBe(sourceValue);
        expect(updatedAuxCase.data.responseOrbika.repair_status_name).toBe(
            updatedAuxCase.data.responseOrbika.previous_state_name
        );
    });

    it('should execute UPDATE_MODEL action with modelo_a_modelo formula when complex conditions are met', async () => {
        const { estadoInicial, transition, kase } = await createCaseWithRelations();
        const actionUpdateModelRepository = new KnexActionUpdateModelRepository(actionRepository.connection);

        const targetStateId = estadoInicial.id.value;

        await auxCasesRepository
            .connection('aux_cases')
            .where({ caso_id: kase.id.value })
            .update({
                data: JSON.stringify({
                    form_indemnizacion: {
                        FechaCargaLaValoracion: '2025-11-08T15:06:58-05:00',
                    },
                }),
            });

        const actionUpdateModel = new ActionUpdateModel({
            id: uuid(),
            description: 'Actualizar campo external_code cuando se cumplen condiciones ORBIKA',
            aggregate: 'Case',
            field: 'external_code',
            type: 'alfanumerico',
            value: 'ORBIKA_VALIDATED',
            created_at: new Date().toISOString(),
            created_by: globalSystemUserId,
        });
        await actionUpdateModelRepository.save(actionUpdateModel);

        const action_type = ActionTypes.ACTUALIZAR_MODELO.value;
        const conditions = {
            id: '48bae0cd-7fa5-4860-8a36-92e0ae5a6096',
            combinator: 'and',
            rules: [
                {
                    id: '943e487e-cc9b-4fc4-8aff-3ae55f58ca82',
                    not: false,
                    combinator: 'and',
                    rules: [
                        {
                            id: '6ef61ca5-16a0-48f6-9615-f9bc9b3bc9b6',
                            type: 'options_list',
                            field: 'cases.estadoActual',
                            value: targetStateId,
                            operator: '=',
                            value_type: 'text',
                        },
                        {
                            id: 'ca315916-d76b-4cc7-82b9-29fad185845f',
                            type: 'function',
                            field: 'aux_cases.form_indemnizacion.FechaCargaLaValoracion',
                            value: 'datetime',
                            operator: '<',
                            value_type: 'date',
                            valueSource: 'value',
                        },
                    ],
                },
            ],
        };

        await ActionMother.create(actionRepository, {
            id: 'bef79b24-7d38-4372-8387-0edb3dead3e3',
            action_type,
            description: 'Acción CRON - Consulta a (O R B I K A) (W) (X)',
            triggers: [ActionTriggers.EDIT_CASE.value],
            conditions,
            model_update_id: actionUpdateModel.id.value,
            priority: 99,
            is_active: true,
        });

        const caseUpdater = new CaseUpdater(caseRepository, actionExecutionService);
        const payload = {
            transicion_id: transition.id.value,
            updated_at: new Date(),
            updated_by: globalSystemUserId,
        };

        // La transicion del payload es la que ya tenia el caso, asi que
        // `CaseUpdater` no ve cambio de estado: el trigger es `editar_caso`, el
        // mismo con el que se registro la accion.
        await caseUpdater.execute(kase.id.value, payload);
        await runCaseUpdatedActions(kase.id.value, ActionTriggers.EDIT_CASE.value);

        const updatedCase = await new DomainCaseFinder(caseRepository).execute(kase.id.value);
        expect(updatedCase.transicion_id.value).toBe(transition.id.value);

        expect(updatedCase.external_code.value).toBe('ORBIKA_VALIDATED');

        const auxCase = await auxCasesRepository.connection('aux_cases').where({ caso_id: kase.id.value }).first();

        expect(auxCase).toBeDefined();
        expect(auxCase.data.form_indemnizacion.FechaCargaLaValoracion).toBe('2025-11-08T15:06:58-05:00');
    });

    it('should execute a CallWsService action when entity is case', async () => {
        const { client, transition, classification, caseDescription } = await createCaseWithRelations();
        const debugSpy = jest.spyOn(Helper, 'logDebug').mockImplementation(() => {});

        const wsRestFlowRepository = new KnexWSRestFlowRepository(actionRepository.connection);
        const user = await UsersMother.createUser(usersRepository, {
            rol_id: globalRoleId,
            created_by: globalSystemUserId,
        });
        const wsRestFlow = await WSRestFlowMother.create(wsRestFlowRepository);

        const dto = ActionMother.WSActionDto({
            ruleValue: user.id.value,
            restFlowId: wsRestFlow.id.value,
            entity: 'case',
        });
        const actionCreator = new ActionCreator(actionRepository);
        await actionCreator.execute(dto);

        const kaseDto = CasesMother.dto({
            responsable_id: user.id.value,
            created_by: user.id.value,
            updated_by: user.id.value,
            cliente_id: client.id.value,
            transicion_id: transition.id.value,
            clasificacion_id: classification.id.value,
            descripcion_caso_id: caseDescription.id.value,
            grupo_id: globalGroupId,
        });
        await new CaseCreator(caseRepository, actionExecutionService).execute(kaseDto);
        await runCaseCreatedActions(kaseDto.id);

        const debugCallArgs = debugSpy.mock.calls;
        const result = debugCallArgs.some(
            (debugItem) =>
                debugItem[0] === 'new context for restFlow:' && typeof debugItem[1] === 'object' && debugItem[1].case
        );
        expect(result).toBe(true);
        expect(debugSpy).toHaveBeenCalled();
    });

    it('should execute a CallWsService action when entity is user', async () => {
        const debugSpy = jest.spyOn(Helper, 'logDebug').mockImplementation(() => {});

        const wsRestFlowRepository = new KnexWSRestFlowRepository(actionRepository.connection);
        const wsRestFlow = await WSRestFlowMother.create(wsRestFlowRepository);

        const userId = uuid();
        const dto = ActionMother.WSActionDto({
            ruleValue: userId,
            ruleField: 'id',
            restFlowId: wsRestFlow.id.value,
            entity: 'user',
            triggers: ['create_user', 'update_user'],
        });
        const actionCreator = new ActionCreator(actionRepository);
        await actionCreator.execute(dto);

        const userDto = UsersMother.dto({ id: userId, created_by: userId, updated_by: userId });
        await new UserCreator(usersRepository, entityActionExecutionService).execute(userDto);

        const debugCallArgs = debugSpy.mock.calls;
        const result = debugCallArgs.some((debugItem) => debugItem[0] === 'new context for restFlow:');
        expect(result).toBe(true);
        expect(debugSpy).toHaveBeenCalled();
    });

    it('should execute a CallWsService action when entity is group', async () => {
        const debugSpy = jest.spyOn(Helper, 'logDebug').mockImplementation(() => {});

        const wsRestFlowRepository = new KnexWSRestFlowRepository(actionRepository.connection);
        const wsRestFlow = await WSRestFlowMother.create(wsRestFlowRepository);

        const user = await UsersMother.createUser(usersRepository);

        const dto = ActionMother.WSActionDto({
            ruleValue: user.id.value,
            ruleField: 'created_by',
            restFlowId: wsRestFlow.id.value,
            entity: 'group',
            triggers: ['create_group', 'update_group'],
        });
        const actionCreator = new ActionCreator(actionRepository);
        await actionCreator.execute(dto);

        const shiftManagement = await ShiftManagementMother.createShiftManagement(shiftManagementRepository, {
            created_by: globalSystemUserId,
        });

        const groupDto = GroupsMother.dto({
            rol_id: globalRoleId,
            horario_id: shiftManagement.id.value,
            configuration_id: globalConfigurationId,
            created_by: user.id.value,
        });
        // No GroupScheduleGuard on purpose: this case checks the triggered actions, not the schedule rule.
        await new GroupCreator(groupsRepository, entityActionExecutionService).execute(groupDto);

        const debugCallArgs = debugSpy.mock.calls;
        const result = debugCallArgs.some((debugItem) => debugItem[0] === 'new context for restFlow:');
        expect(result).toBe(true);
        expect(debugSpy).toHaveBeenCalled();
    });

    it('should execute a SendEmail action when entity is case', async () => {
        const { client, transition, classification, caseDescription } = await createCaseWithRelations();
        const debugSpy = jest.spyOn(EventLogger.prototype, 'log');

        const user = await UsersMother.createUser(usersRepository, {
            created_by: globalSystemUserId,
        });
        const mailAccount = await MailAccountMother.createMailAccount(mailAccountRepository);

        const template = await TemplatesMother.createTemplate(templatesRepository);

        const dto = ActionMother.SendEmailActionDto({
            ruleValue: user.id.value,
            templateId: template.id.value,
            entity: 'case',
            mailAccountId: mailAccount.id.value,
        });
        const actionCreator = new ActionCreator(actionRepository);
        await actionCreator.execute(dto);

        const kaseDto = CasesMother.dto({
            responsable_id: user.id.value,
            created_by: user.id.value,
            updated_by: user.id.value,
            cliente_id: client.id.value,
            transicion_id: transition.id.value,
            clasificacion_id: classification.id.value,
            descripcion_caso_id: caseDescription.id.value,
            grupo_id: globalGroupId,
        });
        await new CaseCreator(caseRepository, actionExecutionService).execute(kaseDto);
        await runCaseCreatedActions(kaseDto.id);

        const debugCallArgs = debugSpy.mock.calls.filter((item) => item.includes('action.executed'));
        const result = debugCallArgs.some(
            (debugItem) => typeof debugItem[3] === 'object' && debugItem[3].description === dto.description
        );

        expect(result).toBe(true);
        expect(debugSpy).toHaveBeenCalled();
    });

    it('should execute a SendEmail action when entity is user', async () => {
        const debugSpy = jest.spyOn(EventLogger.prototype, 'log');

        const userId = uuid();
        const mailAccount = await MailAccountMother.createMailAccount(mailAccountRepository);
        const template = await TemplatesMother.createTemplate(templatesRepository);
        const dto = ActionMother.SendEmailActionDto({
            ruleValue: userId,
            ruleField: 'id',
            templateId: template.id.value,
            entity: 'user',
            triggers: ['create_user', 'update_user'],
            mailAccountId: mailAccount.id.value,
        });
        const actionCreator = new ActionCreator(actionRepository);
        await actionCreator.execute(dto);

        const userDto = UsersMother.dto({ id: userId, created_by: userId, updated_by: userId });
        await new UserCreator(usersRepository, entityActionExecutionService).execute(userDto);

        const debugCallArgs = debugSpy.mock.calls.filter((item) => item.includes('action.executed'));
        const result = debugCallArgs.some(
            (debugItem) => typeof debugItem[3] === 'object' && debugItem[3].description === dto.description
        );

        expect(result).toBe(true);
        expect(debugSpy).toHaveBeenCalled();
    });

    it('should execute a SendEmail action when entity is group', async () => {
        const debugSpy = jest.spyOn(EventLogger.prototype, 'log');

        const user = await UsersMother.createUser(usersRepository);
        const mailAccount = await MailAccountMother.createMailAccount(mailAccountRepository);
        const template = await TemplatesMother.createTemplate(templatesRepository);

        const dto = ActionMother.SendEmailActionDto({
            ruleValue: user.id.value,
            ruleField: 'created_by',
            templateId: template.id.value,
            entity: 'group',
            triggers: ['create_group', 'update_group'],
            mailAccountId: mailAccount.id.value,
        });
        const actionCreator = new ActionCreator(actionRepository);
        await actionCreator.execute(dto);

        const shiftManagement = await ShiftManagementMother.createShiftManagement(shiftManagementRepository, {
            created_by: globalSystemUserId,
        });

        const groupDto = GroupsMother.dto({
            rol_id: globalRoleId,
            horario_id: shiftManagement.id.value,
            configuration_id: globalConfigurationId,
            created_by: user.id.value,
        });
        // No GroupScheduleGuard on purpose: this case checks the triggered actions, not the schedule rule.
        await new GroupCreator(groupsRepository, entityActionExecutionService).execute(groupDto);

        const debugCallArgs = debugSpy.mock.calls.filter((item) => item.includes('action.executed'));
        const result = debugCallArgs.some(
            (debugItem) => typeof debugItem[3] === 'object' && debugItem[3].description === dto.description
        );

        expect(result).toBe(true);
        expect(debugSpy).toHaveBeenCalled();
    });

    it('debe selecciona el asesor correctio de la lista de usuarios segun las configuraciones del grupo configurado en la lista', async () => {
        const { client, transition, classification, caseDescription } = await createCaseWithRelations();

        //crear configuracion con parametros de seleccion de usuarios
        const globalConfiguration =
            await GlobalConfigurationsMother.createWorkQueueConfig(globalConfigurationRepository);

        //Crear grupo con configuracion seleccionada
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository, {
            configuration_id: globalConfiguration.id.value,
        });

        //crear usuarios testeables segun la configuracion
        const userWithMaxGrantedCases = await UsersMother.createUser(usersRepository, {
            last_seen_at: new Date(Date.now() - 30000).toISOString(),
            last_login_at: new Date(Date.now() - 40000).toISOString(),
            grupo_activo: group.id.value,
            created_by: globalSystemUserId,
        });

        const userWhithOneCaseAndRecentLogin = await UsersMother.createUser(usersRepository, {
            last_seen_at: new Date().toISOString(),
            last_login_at: new Date().toISOString(),
            grupo_activo: group.id.value,
            created_by: globalSystemUserId,
        });

        const userWhithOneCaseAndOldestLogin = await UsersMother.createUser(usersRepository, {
            last_seen_at: new Date(Date.now() - 30000).toISOString(),
            last_login_at: new Date(Date.now() - 40000).toISOString(),
            grupo_activo: group.id.value,
            created_by: globalSystemUserId,
        });

        //crear lista de usuarios con el grupo seleccionado y con los usuarios testeables
        const userListDto = [
            {
                id: userWithMaxGrantedCases.id.value,
                name: `${userWithMaxGrantedCases.nombres.value} ${userWithMaxGrantedCases.apellido1.value}`.trim(),
            },
            {
                id: userWhithOneCaseAndRecentLogin.id.value,
                name: `${userWhithOneCaseAndRecentLogin.nombres.value} ${userWhithOneCaseAndRecentLogin.apellido1.value}`.trim(),
            },
            {
                id: userWhithOneCaseAndOldestLogin.id.value,
                name: `${userWhithOneCaseAndOldestLogin.nombres.value} ${userWhithOneCaseAndOldestLogin.apellido1.value}`.trim(),
            },
        ];

        const groupId = group.id.value;
        const userList = await UserListMother.createUserList(userListRepository, {
            lista_usuarios: userListDto,
            group_id: groupId,
        });

        //usuario creador de los casos
        const defaultUserResponsable = await UsersMother.createUser(usersRepository, {
            created_by: globalSystemUserId,
        });

        //crear accion con la lista de usuarios
        const actionDto = {
            action_type: 'asignar_lista_asesores',
            conditions: {
                combinator: 'and',
                rules: [
                    {
                        combinator: 'and',
                        not: false,
                        rules: [
                            {
                                field: 'cases.responsable_id',
                                operator: '=',
                                type: 'manual_input',
                                value: defaultUserResponsable.id.value,
                                value_type: 'text',
                                id: uuid(),
                            },
                        ],
                        id: uuid(),
                    },
                ],
                id: uuid(),
            },
            triggers: ['crear_caso', 'editar_caso'],
            advisor_list_id: userList.id.value,
        };

        await ActionMother.create(actionRepository, actionDto);

        //crear y asignar casos
        for (let i = 0; i < 3; i++) {
            await CasesMother.createCaseWithFullRelations(caseRepository, {
                responsable_id: userWithMaxGrantedCases.id.value,
                grupo_id: group.id.value,
                created_at: new Date().toISOString(),
                cliente_id: client.id.value,
                transicion_id: transition.id.value,
                clasificacion_id: classification.id.value,
                descripcion_caso_id: caseDescription.id.value,
                created_by: globalSystemUserId,
            });
            if (i < 2) {
                await CasesMother.createCaseWithFullRelations(caseRepository, {
                    responsable_id: userWhithOneCaseAndRecentLogin.id.value,
                    grupo_id: group.id.value,
                    created_at: new Date().toISOString(),
                    cliente_id: client.id.value,
                    transicion_id: transition.id.value,
                    clasificacion_id: classification.id.value,
                    descripcion_caso_id: caseDescription.id.value,
                    created_by: globalSystemUserId,
                });
                await CasesMother.createCaseWithFullRelations(caseRepository, {
                    responsable_id: userWhithOneCaseAndOldestLogin.id.value,
                    grupo_id: group.id.value,
                    created_at: new Date().toISOString(),
                    cliente_id: client.id.value,
                    transicion_id: transition.id.value,
                    clasificacion_id: classification.id.value,
                    descripcion_caso_id: caseDescription.id.value,
                    created_by: globalSystemUserId,
                });
            }
        }

        const kaseDto = CasesMother.dto({
            responsable_id: defaultUserResponsable.id.value,
            grupo_id: group.id.value,
            created_at: new Date().toISOString(),
            created_by: defaultUserResponsable.id.value,
            cliente_id: client.id.value,
            transicion_id: transition.id.value,
            clasificacion_id: classification.id.value,
            descripcion_caso_id: caseDescription.id.value,
        });
        await new CaseCreator(caseRepository, actionExecutionService).execute(kaseDto);
        await runCaseCreatedActions(kaseDto.id);

        const savedKase = await caseRepository.find({ value: kaseDto.id });

        expect(savedKase.toJson().responsable_id).toBe(userWhithOneCaseAndOldestLogin.toJson().id);
    });

    it('should assigned agent without considering maximum cases or active user when the assignment type is "asignacion_equivalente"', async () => {
        // Arrange
        const { client, transition, classification, caseDescription } = await createCaseWithRelations();

        const globalConfiguration =
            await GlobalConfigurationsMother.createWorkQueueConfig(globalConfigurationRepository);
        const settings = { ...globalConfiguration.settings.value };
        settings.behaviors.application.agente.casos.type_assignment = 'asignacion_equivalente';
        settings.behaviors.application.agente.casos.max_cases_per_user = 1;
        settings.behaviors.application.agente.casos.activeUsers_filter_bool = true;
        globalConfiguration.settings = settings;
        await globalConfigurationRepository.update(globalConfiguration);

        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository, {
            configuration_id: globalConfiguration.id.value,
        });

        const user = await UsersMother.createUser(usersRepository, {
            last_seen_at: new Date(Date.now() - 30000).toISOString(),
            last_login_at: new Date(Date.now() - 40000).toISOString(),
            grupo_activo: group.id.value,
            created_by: globalSystemUserId,
        });

        const userListDto = [
            {
                id: user.id.value,
                name: `${user.nombres.value} ${user.apellido1.value}`.trim(),
            },
        ];
        const userList = await UserListMother.createUserList(userListRepository, {
            lista_usuarios: userListDto,
            group_id: group.id.value,
        });

        const defaultUserResponsable = await UsersMother.createUser(usersRepository, {
            created_by: globalSystemUserId,
        });

        const actionDto = {
            action_type: 'asignar_lista_asesores',
            conditions: {
                combinator: 'and',
                rules: [
                    {
                        combinator: 'and',
                        not: false,
                        rules: [
                            {
                                field: 'cases.responsable_id',
                                operator: '=',
                                type: 'manual_input',
                                value: defaultUserResponsable.id.value,
                                value_type: 'text',
                                id: uuid(),
                            },
                        ],
                        id: uuid(),
                    },
                ],
                id: uuid(),
            },
            triggers: ['crear_caso', 'editar_caso'],
            advisor_list_id: userList.id.value,
        };
        await ActionMother.create(actionRepository, actionDto);

        const kaseDto = CasesMother.dto({
            responsable_id: defaultUserResponsable.id.value,
            grupo_id: group.id.value,
            created_at: new Date().toISOString(),
            created_by: defaultUserResponsable.id.value,
            cliente_id: client.id.value,
            transicion_id: transition.id.value,
            clasificacion_id: classification.id.value,
            descripcion_caso_id: caseDescription.id.value,
        });

        // Act
        await new CaseCreator(caseRepository, actionExecutionService).execute(kaseDto);
        await runCaseCreatedActions(kaseDto.id);

        // Assert
        const savedKase = await caseRepository.find({ value: kaseDto.id });
        expect(savedKase.toJson().responsable_id).toBe(user.toJson().id);
    });
});
