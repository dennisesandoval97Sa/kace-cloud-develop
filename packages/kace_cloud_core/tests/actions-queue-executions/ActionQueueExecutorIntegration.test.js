import { knexConfig } from '../knexfile.js';
import TestHelper from '../TestHelper.js';
import { v4 as uuidv4 } from 'uuid';
import { ActionQueueExecutor } from '../../src/actions-queue-executions/application/executor/ActionQueueExecutor';
import { KnexActionsQueueExecutionsRepository } from '../../src/actions-queue-executions/infrastructure/persistence/KnexActionsQueueExecutionsRepository';
import { KnexActionRepository } from '../../src/actions/infrastructure/KnexActionRepository';
import { KnexCaseRepository } from '../../src/cases/infrastructure/persistence/KnexCaseRepository';
import { StatusEnum } from '../../src/actions-queue-executions/domain/enum/StatusEnum';
import { ActionTriggers } from '../../src/shared/domain/enum/ActionTriggersEnum';
import { ActionsQueueExecutionsMother } from './domain/ActionsQueueExecutionsMother';
import ActionMother from '../actions/domain/ActionMother';
import CasesMother from '../cases/domain/CasesMother';
import { ActionTypes } from '../../src/actions';
import { KnexBackgroundExecutionRepository } from '../../src/background-executions/infrastructure/persistence/KnexBackgroundExecutionRepository';
import { BackgroundProcessEnum } from '../../src/shared/domain/enum/BackgroundProcessEnum';
import { ActionQueueExecutorResponse } from '../../src/actions-queue-executions/application/executor/ActionQueueExecutorResponse';
import { KnexUsersRepository } from '../../src/users';
import UsersMother from '../users/domain/UsersMother';
import { KnexWSRestFlowRepository } from '../../src/ws-rest-flows';
import WSRestFlowMother from '../ws-rest-flows/domain/WSRestFlowMother';
import { KnexWSRestWorkflowStepRepository } from '../../src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository';
import WSRestFunctionMother from '../ws_rest_functions/domain/WSRestFunctionMother';
import { KnexWSRestFunctionRepository } from '../../src/ws_rest_functions/infrastructure/persistence/KnexWSRestFunctionRepository';
import { WSRestWorkflowStepCreator } from '../../src/ws-rest-workflow-step/application/create/WSRestWorkflowStepCreator';
import { BackgroundExecutionService } from '../../src/shared/domain/services/background-execution/BackgroundExecutionService';
import LocalTenantRepository from '../../src/tenant/infrastructure/local/LocalTenantRepository';
import { TenantContext } from '../../src/shared/infrastructure/context/TenantContext';

const tenant = await new LocalTenantRepository().find();

/**
 * El constructor de `WSRestFunction` lee `secret_key`, `secret_iv` y
 * `encryption_method` del tenant activo, y aqui se instancian funciones REST
 * tanto al sembrar el flujo como al procesar la cola. Sin contexto de tenant
 * `TenantContext.getTenant()` devuelve null y revienta. Hay que envolver cada
 * hook y cada `it`: `AsyncLocalStorage` no cruza de un callback a otro.
 *
 * @param {() => Promise<void>} fn
 * @returns {() => Promise<void>}
 */
const inTenant = (fn) => () => TenantContext.run(tenant, fn);

describe('ActionQueueExecutor Integration Test', () => {
    let actionsQueueExecutionsRepository;
    let actionRepository;
    let caseRepository;
    let actionQueueExecutor;
    let testAction;
    let testCase;
    let testUser;
    let testRestWorkflow;
    let backgroundExecutionRepository;
    let backgroundExecutionService;

    beforeAll(() => {
        backgroundExecutionRepository = new KnexBackgroundExecutionRepository(knexConfig);
        actionsQueueExecutionsRepository = new KnexActionsQueueExecutionsRepository(knexConfig);
        actionRepository = new KnexActionRepository(knexConfig);
        caseRepository = new KnexCaseRepository(knexConfig);

        actionQueueExecutor = new ActionQueueExecutor(actionsQueueExecutionsRepository);
        backgroundExecutionService = new BackgroundExecutionService(backgroundExecutionRepository);
    });

    // Todo el fixture se siembra por test, no en un `beforeAll`: el reset de
    // `perFileDatabase.js` corre en un `beforeEach` propio y trunca las tablas
    // sucias antes de cada `it`. Sembrar el flujo REST una sola vez lo dejaba
    // vivo solo para el primer test -el reset no trunca nada en su primera
    // llamada- y desaparecido para los siguientes, que fallaban al no
    // encontrarlo. La fila `action_queue_executor` de `background_executions`
    // tampoco se crea: ya viene de la migracion 20250729112800, y duplicarla
    // hace que `findByProcess` (un `.first()` sin ORDER BY) lea una u otra.
    beforeEach(
        inTenant(async () => {
            const userRepository = new KnexUsersRepository(knexConfig);
            const wsRestFlowRepository = new KnexWSRestFlowRepository(knexConfig);
            const wsRestFunctionRepository = new KnexWSRestFunctionRepository(knexConfig);
            const wsRestFlowStepRepository = new KnexWSRestWorkflowStepRepository(knexConfig);

            testUser = await UsersMother.createUser(userRepository);

            testRestWorkflow = await WSRestFlowMother.create(wsRestFlowRepository);

            const toUpperCaseFunction = await WSRestFunctionMother.create(wsRestFunctionRepository, {
                description: 'Convertir valor estático a mayúsculas',
                type: 'toUpperCase',
                filter_input: { filter_input: [] },
                context_position: 'results',
                value_dynamic: false,
                value_static: 'valor estático',
            });

            const stepCreator = new WSRestWorkflowStepCreator(wsRestFlowStepRepository);

            await stepCreator.execute({
                id: uuidv4(),
                flow_id: testRestWorkflow.id.value,
                endpoint_id: null,
                function_id: toUpperCaseFunction.id.value,
                order: 1,
                created_by: testUser.id.value,
                created_at: new Date().toISOString(),
            });

            testCase = await CasesMother.createCase(caseRepository, {
                created_by: testUser.id.value,
            });

            testAction = await ActionMother.create(actionRepository, {
                action_type: ActionTypes.CONSUMO_REST_FLOW.value,
                is_active: true,
                description: 'Test Action for Queue',
                priority: 1,
                ws_rest_flow_id: testRestWorkflow.id.value,
            });
        })
    );

    it(
        'should process pending queue executions successfully',
        inTenant(async () => {
            const pendingExecution1 = await ActionsQueueExecutionsMother.create(actionsQueueExecutionsRepository, {
                action_id: testAction.id.value,
                case_id: testCase.id.value,
                client_id: testCase.cliente_id.value,
                status: StatusEnum.PENDING.value,
                trigger_type: ActionTriggers.CRON_JOB.value,
            });

            const pendingExecution2 = await ActionsQueueExecutionsMother.create(actionsQueueExecutionsRepository, {
                action_id: testAction.id.value,
                case_id: testCase.id.value,
                client_id: testCase.cliente_id.value,
                status: StatusEnum.PENDING.value,
                trigger_type: ActionTriggers.CRON_JOB.value,
            });

            const result = await actionQueueExecutor.execute();

            expect(result).toBeInstanceOf(ActionQueueExecutorResponse);

            const response = result.toJson();
            expect(response.data.processed).toEqual(2);
            expect(response.data.successful).toEqual(2);
            expect(response.data.failed).toEqual(0);
            expect(response.data.skipped).toBeUndefined();
            expect(response.metadata.timestamp).toBeDefined();
            expect(response.metadata.status).toBe('completed');

            const updatedExecution1 = await actionsQueueExecutionsRepository.find(pendingExecution1.id);
            const updatedExecution2 = await actionsQueueExecutionsRepository.find(pendingExecution2.id);

            expect(updatedExecution1.status.value).toBe(StatusEnum.COMPLETED.value);
            expect(updatedExecution2.status.value).toBe(StatusEnum.COMPLETED.value);

            expect(updatedExecution1.start_execution.value).not.toBeNull();
            expect(updatedExecution1.end_execution.value).not.toBeNull();
            expect(updatedExecution2.start_execution.value).not.toBeNull();
            expect(updatedExecution2.end_execution.value).not.toBeNull();
        })
    );

    it(
        'should handle an empty queue gracefully',
        inTenant(async () => {
            const result = await actionQueueExecutor.execute();

            const response = result.toJson();

            expect(response.data.processed).toBe(0);
            expect(response.data.successful).toBe(0);
            expect(response.data.failed).toBe(0);
            expect(response.metadata.status).toBe('skipped');
            expect(response.metadata.reason).toBe('no_pending_executions');
        })
    );

    it(
        'should handle a failed execution correctly',
        inTenant(async () => {
            const pendingExecution = await ActionsQueueExecutionsMother.create(actionsQueueExecutionsRepository, {
                action_id: uuidv4(),
                case_id: testCase.id.value,
                client_id: testCase.cliente_id.value,
                status: StatusEnum.PENDING.value,
                trigger_type: ActionTriggers.CRON_JOB.value,
            });

            const result = await actionQueueExecutor.execute();

            const response = result.toJson();
            expect(response.data.processed).toBeGreaterThanOrEqual(1);
            expect(response.data.failed).toBeGreaterThanOrEqual(1);

            const updatedExecution = await actionsQueueExecutionsRepository.find(pendingExecution.id);
            expect(updatedExecution.status.value).toBe(StatusEnum.FAILED.value);

            expect(updatedExecution.start_execution.value).not.toBeNull();
            expect(updatedExecution.end_execution.value).not.toBeNull();
        })
    );

    it(
        'should recognize when already running and skip execution',
        inTenant(async () => {
            await ActionsQueueExecutionsMother.create(actionsQueueExecutionsRepository, {
                action_id: testAction.id.value,
                case_id: testCase.id.value,
                client_id: testCase.cliente_id.value,
                status: StatusEnum.PENDING.value,
                trigger_type: ActionTriggers.CRON_JOB.value,
            });

            await backgroundExecutionService.updateBackgroundExecution(
                BackgroundProcessEnum.ACTION_QUEUE_EXECUTOR.value,
                {
                    execution_status: true,
                    start_execution: new Date().toISOString(),
                }
            );

            const result = await actionQueueExecutor.execute();

            const response = result.toJson();
            expect(response.data.skipped).toBe(true);
            expect(response.metadata.reason).toBe('already_running');
            expect(response.metadata.status).toBe('skipped');
            expect(response.data.processed).toBe(0);
            expect(response.data.successful).toBe(0);
            expect(response.data.failed).toBe(0);

            await backgroundExecutionService.updateBackgroundExecution(
                BackgroundProcessEnum.ACTION_QUEUE_EXECUTOR.value,
                {
                    execution_status: false,
                    start_execution: null,
                    end_execution: null,
                }
            );
        })
    );

    it(
        'should log an event when WS flow is executed successfully from the queue',
        inTenant(async () => {
            await ActionsQueueExecutionsMother.create(actionsQueueExecutionsRepository, {
                action_id: testAction.id.value,
                case_id: testCase.id.value,
                client_id: testCase.cliente_id.value,
                status: StatusEnum.PENDING.value,
                trigger_type: ActionTriggers.CRON_JOB.value,
            });

            const result = await actionQueueExecutor.execute();
            expect(result).toBeInstanceOf(ActionQueueExecutorResponse);

            const response = result.toJson();
            expect(response.data.successful).toBeGreaterThanOrEqual(1);

            const eventLog = await caseRepository
                .connection('event_logs')
                .select('*')
                .where({
                    aggregate_id: testAction.ws_rest_flow_id.value,
                    event_name: 'ws-rest-flows.executed',
                    case_id: testCase.id.value,
                })
                .first();

            expect(eventLog).toBeDefined();

            const body = eventLog.body;
            expect(body).toBeDefined();
            expect(eventLog.aggregate_id).toBe(testAction.ws_rest_flow_id.value);
            expect(body.trigger).toBe('action');
            expect(body.execution_status).toBe('success');
            expect(body.flow).toBeDefined();

            const oldData = eventLog.old_data;
            expect(oldData).toBeDefined();
            expect(oldData.grupo_id).toBe(testCase.grupo_id.value);
            expect(oldData.transicion_id).toBe(testCase.transicion_id.value);
            expect(oldData.responsable_id).toBe(testCase.responsable_id.value);
        })
    );
});
