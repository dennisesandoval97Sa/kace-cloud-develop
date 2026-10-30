import { ActionQueueExecutionsExecutor } from '../../src/actions-queue-executions/application/executions/ActionQueueExecutionsExecutor.js';
import { BackgroundExecutionService } from '../../src/shared/domain/services/background-execution/BackgroundExecutionService.js';
import { KnexActionsQueueExecutionsRepository } from '../../src/actions-queue-executions/infrastructure/persistence/KnexActionsQueueExecutionsRepository.js';
import { KnexActionRepository, ActionTriggers } from '../../src/actions/index.js';
import { KnexAutomationSettingsRepository } from '../../src/automation-settings/infrastructure/persistence/KnexAutomationSettingsRepository.js';
import { KnexCaseRepository } from '../../src/cases/index.js';
import { KnexBackgroundExecutionRepository } from '../../src/background-executions/infrastructure/persistence/KnexBackgroundExecutionRepository.js';
import { KnexTransitionsRepository } from '../../src/transition/index.js';
import { KnexUsersRepository } from '../../src/users/index.js';
import { KnexRoleRepository } from '../../src/role/infrastructure/persistence/KnexRoleRepository.js';
import { KnexGroupsRepository } from '../../src/grupos/infrastructure/persistence/KnexGroupsRepository.js';
import { KnexUserListsRepository } from '../../src/user-lists/infrastructure/persistence/KnexUserListsRepository.js';
import { BackgroundProcessEnum } from '../../src/shared/domain/enum/BackgroundProcessEnum.js';

import { ClassificationFactory } from '../../src/factories/ClassificationFactory.js';
import { GroupFactory } from '../../src/factories/GroupFactory.js';
import { CaseFactory } from '../../src/factories/CaseFactory.js';
import { ClientFactory } from '../../src/factories/ClientFactory.js';
import { TransitionFactory } from '../../src/factories/TransitionFactory.js';
import UsersMother from '../users/domain/UsersMother.js';
import AutomationSettingsMother from '../automation-settings/domain/AutomationSettingsMother.js';
import RoleMother from '../role/domain/RoleMother.js';
import BackgroundExecutionMother from '../background-executions/domain/BackgroundExecutionMother.js';
import ActionMother from '../actions/domain/ActionMother.js';
import { knexConfig } from '../knexfile.js';
import TestHelper from '../TestHelper.js';
import { jest } from '@jest/globals';
import { AutomatedActionsRequested } from '../../src/actions-queue-executions/domain/events/AutomatedActionsRequested.js';

const testSchema = knexConfig.config.schema;

describe('ActionQueueExecutionsExecutorIntegration', () => {
    let actionsQueueExecutionsRepository;
    let actionRepository;
    let automationSettingsRepository;
    let caseRepository;
    let backgroundExecutionRepository;
    let groupsRepository;
    let userListsRepository;
    let transitionRepository;
    let usersRepository;
    let roleRepository;
    let aggTransitions;
    let backgroundExecutionService;
    let actionQueueExecutions;
    let automations;

    const tenant = { id: { value: '00000000-0000-4000-8000-000000000099' } };

    function createActionQueueExecutionsExecutor(deps) {
        return new ActionQueueExecutionsExecutor(
            deps.actionsQueueExecutionsRepository,
            deps.actionRepository,
            deps.caseRepository,
            deps.backgroundExecutionRepository,
            deps.automationSettingsRepository,
            deps.groupsRepository,
            deps.userListsRepository,
            deps.eventPublisher,
            tenant
        );
    }

    async function setupFixtures() {
        actionsQueueExecutionsRepository = new KnexActionsQueueExecutionsRepository(knexConfig);
        actionRepository = new KnexActionRepository(knexConfig);
        automationSettingsRepository = new KnexAutomationSettingsRepository(knexConfig);
        caseRepository = new KnexCaseRepository(knexConfig);
        backgroundExecutionRepository = new KnexBackgroundExecutionRepository(knexConfig);
        groupsRepository = new KnexGroupsRepository(knexConfig);
        userListsRepository = new KnexUserListsRepository(knexConfig);

        usersRepository = new KnexUsersRepository(knexConfig);
        transitionRepository = new KnexTransitionsRepository(knexConfig);
        roleRepository = new KnexRoleRepository(knexConfig);

        backgroundExecutionService = new BackgroundExecutionService(backgroundExecutionRepository);

        const getBackgroundExecutionService = await backgroundExecutionService.findBackgroundExecution(
            BackgroundProcessEnum.ACTION_QUEUE_EXECUTION.value
        );
        if (!getBackgroundExecutionService) {
            await BackgroundExecutionMother.create(backgroundExecutionRepository, {
                proccess_description: BackgroundProcessEnum.ACTION_QUEUE_EXECUTION.value,
                execution_status: false,
            });
        }

        automations = await AutomationSettingsMother.create(automationSettingsRepository);
        const client = await new ClientFactory(knexConfig).create();

        const rol = await RoleMother.createRole(roleRepository);
        const responsible = await UsersMother.createUser(usersRepository, { rol_id: rol.id.value });

        const aggCase = await new CaseFactory(knexConfig).create({
            cliente_id: client.id.value,
            responsable_id: responsible.id.value,
            transicion_id: (await new TransitionFactory(knexConfig).create({ status: 1 })).id.value,
        });

        aggTransitions = await transitionRepository.find(aggCase.transicion_id);

        await new ClassificationFactory(knexConfig).create();
        await new GroupFactory(knexConfig).create();

        actionQueueExecutions = createActionQueueExecutionsExecutor({
            actionsQueueExecutionsRepository,
            actionRepository,
            caseRepository,
            backgroundExecutionRepository,
            automationSettingsRepository,
            groupsRepository,
            userListsRepository,
        });
    }

    beforeEach(async () => {
        await setupFixtures();
    });

    it('should connect to the database and attempt to execute action queue, but no actions should match the conditions', async () => {
        const CASE_STATUS_FIELD = 'estado.nombre';

        await ActionMother.create(actionRepository, {
            triggers: [ActionTriggers.CRON_JOB.value],
            automation_id: automations.id.value,
            conditions: {
                rules: [
                    {
                        field: CASE_STATUS_FIELD,
                        value: automations.id.value,
                        operator: '=',
                    },
                ],
                combinator: 'and',
            },
        });

        const result = await actionQueueExecutions.execute();
        const response = result.toJson();

        expect(response.data.successful).toEqual(0);
        expect(response.data.failed).toBeGreaterThanOrEqual(0);
        expect(response.data.duplicate).toBeGreaterThanOrEqual(0);
        expect(response.metadata.timestamp).toBeDefined();
        expect(response.metadata.status).toBe('completed');
    });

    it('should connect to the database and execute action queue', async () => {
        const result = await actionQueueExecutions.execute();
        const response = result.toJson();

        expect(response.data.successful).toEqual(0);
        expect(response.data.failed).toBeGreaterThanOrEqual(0);
        expect(response.data.duplicate).toBeGreaterThanOrEqual(0);
        expect(response.metadata.timestamp).toBeDefined();
        expect(response.metadata.status).toBe('completed');
    });

    it('should publish cron-job requested events after persisting executions', async () => {
        const CASE_STATUS_FIELD = 'cases.estadoActual';

        await ActionMother.create(actionRepository, {
            triggers: [ActionTriggers.CRON_JOB.value],
            automation_id: automations.id.value,
            conditions: {
                rules: [
                    {
                        field: CASE_STATUS_FIELD,
                        value: aggTransitions.siguiente_estado_id.value,
                        operator: '=',
                    },
                ],
                combinator: 'and',
            },
        });

        // El ejecutor publica un lote por tanda persistida via `publishAll`,
        // no un evento suelto por ejecucion.
        const mockEventPublisher = {
            publishAll: jest.fn().mockResolvedValue({ failedAggregateIds: [] }),
        };

        const executorWithPublisher = createActionQueueExecutionsExecutor({
            actionsQueueExecutionsRepository,
            actionRepository,
            caseRepository,
            backgroundExecutionRepository,
            automationSettingsRepository,
            groupsRepository,
            userListsRepository,
            eventPublisher: mockEventPublisher,
        });

        const result = await executorWithPublisher.execute();
        const response = result.toJson();

        expect(response.metadata.status).toBe('completed');
        expect(mockEventPublisher.publishAll).toHaveBeenCalled();

        const [publishedEvents] = mockEventPublisher.publishAll.mock.calls[0];
        expect(publishedEvents.length).toBeGreaterThanOrEqual(1);
        expect(publishedEvents[0]).toBeInstanceOf(AutomatedActionsRequested);
        expect(publishedEvents[0].eventName).toBe(AutomatedActionsRequested.EVENT_NAME);
    });

    it('should keep backward compatibility when no eventPublisher is provided', async () => {
        const executorWithoutPublisher = createActionQueueExecutionsExecutor({
            actionsQueueExecutionsRepository,
            actionRepository,
            caseRepository,
            backgroundExecutionRepository,
            automationSettingsRepository,
            groupsRepository,
            userListsRepository,
        });

        const result = await executorWithoutPublisher.execute();
        const response = result.toJson();

        expect(response.metadata.status).toBe('completed');
    });

    it('should connect to the database and execute action queue with triggered actions', async () => {
        const CASE_STATUS_FIELD = 'cases.estadoActual';

        await ActionMother.create(actionRepository, {
            triggers: [ActionTriggers.CRON_JOB.value],
            automation_id: automations.id.value,
            conditions: {
                rules: [
                    {
                        field: CASE_STATUS_FIELD,
                        value: aggTransitions.siguiente_estado_id.value,
                        operator: '=',
                    },
                ],
                combinator: 'and',
            },
        });

        const result = await actionQueueExecutions.execute();
        const response = result.toJson();

        expect(response.data.successful).toEqual(1);
        expect(response.data.failed).toBeGreaterThanOrEqual(0);
        expect(response.data.duplicate).toBeGreaterThanOrEqual(0);
        expect(response.metadata.timestamp).toBeDefined();
        expect(response.metadata.status).toBe('completed');
    });

    it('should connect to the database and execute action queue with multiple triggered actions', async () => {
        const CASE_STATUS_FIELD = 'cases.estadoActual';

        for (let i = 0; i < 10; i++) {
            await ActionMother.create(actionRepository, {
                triggers: [ActionTriggers.CRON_JOB.value],
                automation_id: automations.id.value,
                conditions: {
                    rules: [
                        {
                            field: CASE_STATUS_FIELD,
                            value: aggTransitions.siguiente_estado_id.value,
                            operator: '=',
                        },
                    ],
                    combinator: 'and',
                },
            });
        }

        const result = await actionQueueExecutions.execute();
        const response = result.toJson();

        expect(response.data.successful).toEqual(10);
        expect(response.data.failed).toBeGreaterThanOrEqual(0);
        expect(response.data.duplicate).toBeGreaterThanOrEqual(0);
        expect(response.metadata.timestamp).toBeDefined();
        expect(response.metadata.status).toBe('completed');
    });

    describe('SQL pre-filter parity', () => {
        const NIVEL1_A = 'A';
        const NIVEL1_B = 'B';
        const AUX_TIPO_VALUE = 'mecanica';

        let parityKnex;
        let parityActionsQueueExecutionsRepository;
        let parityActionRepository;
        let parityCaseRepository;
        let parityBackgroundExecutionRepository;
        let parityAutomationSettingsRepository;
        let parityAutomations;
        let parityActionIds;
        let beforeCount;

        function createParityExecutor() {
            return createActionQueueExecutionsExecutor({
                actionsQueueExecutionsRepository: parityActionsQueueExecutionsRepository,
                actionRepository: parityActionRepository,
                caseRepository: parityCaseRepository,
                backgroundExecutionRepository: parityBackgroundExecutionRepository,
                automationSettingsRepository: parityAutomationSettingsRepository,
                groupsRepository,
                userListsRepository,
            });
        }

        async function resetBackgroundExecution() {
            await parityBackgroundExecutionRepository
                .connection(`${testSchema}.background_executions`)
                .where('proccess_description', BackgroundProcessEnum.ACTION_QUEUE_EXECUTION.value)
                .update({ execution_status: false });
        }

        async function fetchPersistedPairs(executedAfterCount) {
            const rows = await parityActionsQueueExecutionsRepository
                .connection(`${testSchema}.actions_queue_executions`)
                .select('action_id', 'case_id')
                .orderBy([
                    { column: 'action_id', order: 'asc' },
                    { column: 'case_id', order: 'asc' },
                ])
                .offset(executedAfterCount);
            return rows.map((r) => `${r.action_id}:${r.case_id}`).sort();
        }

        async function runWithFlag(flagOn) {
            const original = process.env.ACTION_QUEUE_SQL_PREFILTER_ENABLED;
            process.env.ACTION_QUEUE_SQL_PREFILTER_ENABLED = flagOn ? 'true' : 'false';
            try {
                await resetBackgroundExecution();
                const executor = createParityExecutor();
                const result = await executor.execute();
                const pairs = await fetchPersistedPairs(beforeCount);
                return { pairs, result: result.toJson() };
            } finally {
                if (original === undefined) {
                    delete process.env.ACTION_QUEUE_SQL_PREFILTER_ENABLED;
                } else {
                    process.env.ACTION_QUEUE_SQL_PREFILTER_ENABLED = original;
                }
            }
        }

        beforeEach(async () => {
            parityActionsQueueExecutionsRepository = actionsQueueExecutionsRepository;
            parityActionRepository = actionRepository;
            parityCaseRepository = caseRepository;
            parityBackgroundExecutionRepository = backgroundExecutionRepository;
            parityAutomationSettingsRepository = automationSettingsRepository;
            parityKnex = actionsQueueExecutionsRepository.connection;

            parityAutomations = await AutomationSettingsMother.create(parityAutomationSettingsRepository);

            const rol = await RoleMother.createRole(roleRepository);
            const responsible = await UsersMother.createUser(usersRepository, { rol_id: rol.id.value });

            const classifA = await new ClassificationFactory(knexConfig).create({ nivel1: NIVEL1_A });
            const classifB = await new ClassificationFactory(knexConfig).create({ nivel1: NIVEL1_B });

            const clientA = await new ClientFactory(knexConfig).create();
            const clientB = await new ClientFactory(knexConfig).create();
            const clientC = await new ClientFactory(knexConfig).create();

            const transitionA = await new TransitionFactory(knexConfig).create({ status: 1 });
            const transitionB = await new TransitionFactory(knexConfig).create({ status: 1 });
            const transitionC = await new TransitionFactory(knexConfig).create({ status: 1 });

            const caseFactoryOverrides = { responsable_id: responsible.id.value };

            const case1 = await new CaseFactory(knexConfig).create({
                ...caseFactoryOverrides,
                cliente_id: clientA.id.value,
                transicion_id: transitionA.id.value,
                clasificacion_id: classifA.id.value,
            });

            const case2 = await new CaseFactory(knexConfig).create({
                ...caseFactoryOverrides,
                cliente_id: clientB.id.value,
                transicion_id: transitionB.id.value,
                clasificacion_id: classifA.id.value,
            });

            const case3 = await new CaseFactory(knexConfig).create({
                ...caseFactoryOverrides,
                cliente_id: clientC.id.value,
                transicion_id: transitionC.id.value,
                clasificacion_id: classifB.id.value,
            });

            const { v4: uuidv4 } = await import('uuid');

            const buildAuxData = (tipo) => JSON.stringify({ asistencia: { tipo } });

            await parityKnex(`${testSchema}.aux_cases`).insert({
                id: uuidv4(),
                caso_id: case1.id.value,
                data: buildAuxData(AUX_TIPO_VALUE),
                created_at: new Date().toISOString(),
                created_by: responsible.id.value,
            });

            await parityKnex(`${testSchema}.aux_cases`).insert({
                id: uuidv4(),
                caso_id: case2.id.value,
                data: buildAuxData(AUX_TIPO_VALUE),
                created_at: new Date().toISOString(),
                created_by: responsible.id.value,
            });

            await parityKnex(`${testSchema}.aux_cases`).insert({
                id: uuidv4(),
                caso_id: case3.id.value,
                data: buildAuxData('otro'),
                created_at: new Date().toISOString(),
                created_by: responsible.id.value,
            });

            const actionBaseProps = {
                triggers: [ActionTriggers.CRON_JOB.value],
                automation_id: parityAutomations.id.value,
            };

            const actionClasifA = await ActionMother.create(parityActionRepository, {
                ...actionBaseProps,
                conditions: {
                    combinator: 'and',
                    rules: [{ field: 'clasificaciones.nivel1', operator: '=', value: NIVEL1_A }],
                },
            });

            const actionAuxTipo = await ActionMother.create(parityActionRepository, {
                ...actionBaseProps,
                conditions: {
                    combinator: 'and',
                    rules: [{ field: 'aux_cases.asistencia.tipo', operator: '=', value: AUX_TIPO_VALUE }],
                },
            });

            const actionFechaNull = await ActionMother.create(parityActionRepository, {
                ...actionBaseProps,
                conditions: {
                    combinator: 'and',
                    rules: [{ field: 'cases.fecha_resolucion', operator: 'null', value: 'no_value' }],
                },
            });

            const actionCreatedAtLt = await ActionMother.create(parityActionRepository, {
                ...actionBaseProps,
                conditions: {
                    combinator: 'and',
                    rules: [
                        {
                            field: 'cases.created_at',
                            operator: '<',
                            value: 'datetime',
                            type: 'function',
                        },
                    ],
                },
            });

            parityActionIds = new Set([
                actionClasifA.id.value,
                actionAuxTipo.id.value,
                actionFechaNull.id.value,
                actionCreatedAtLt.id.value,
            ]);

            const countRow = await parityKnex(`${testSchema}.actions_queue_executions`).count('* as cnt').first();
            beforeCount = Number(countRow.cnt);
        });

        it('produces identical (action_id, case_id) pairs with flag OFF and flag ON', async () => {
            const offRun = await runWithFlag(false);

            const offPairs = offRun.pairs.filter((p) => {
                const actionId = p.split(':')[0];
                return parityActionIds.has(actionId);
            });

            // The producer-side dedup (partial UNIQUE index on unfinished rows) rejects a
            // re-insert of any (action_id, case_id) the OFF run already persisted as 'pending'.
            // This test compares selection strategies (legacy vs. SQL pre-filter), not the
            // dedup guarantee: clear the table between runs so the ON run starts clean and can
            // persist its own selection independently. Reset beforeCount so the ON run's pairs
            // are read from offset 0.
            await parityKnex.raw(`TRUNCATE TABLE ${testSchema}.actions_queue_executions`);
            beforeCount = 0;

            const onRun = await runWithFlag(true);

            const onPairs = onRun.pairs.filter((p) => {
                const actionId = p.split(':')[0];
                return parityActionIds.has(actionId);
            });

            expect(offRun.result.metadata.status).toBe('completed');
            expect(onRun.result.metadata.status).toBe('completed');
            expect(onPairs).toEqual(offPairs);
        });
    });

    describe('Event Logging', () => {
        it('should log a critical_error event when an action condition has an invalid value_type', async () => {
            const CASE_STATUS_FIELD = 'estado.nombre';

            await ActionMother.create(actionRepository, {
                triggers: [ActionTriggers.CRON_JOB.value],
                automation_id: automations.id.value,
                conditions: {
                    rules: [
                        {
                            field: CASE_STATUS_FIELD,
                            value: 'some_value',
                            operator: '=',
                            value_type: 'invalid_type',
                        },
                    ],
                    combinator: 'and',
                },
            });

            await actionQueueExecutions.execute();

            const event = await actionsQueueExecutionsRepository
                .connection(`${testSchema}.event_logs`)
                .where('event_name', 'action-queue-execution.error')
                .orderBy('occurred_at', 'desc')
                .first();

            // An invalid condition value_type currently aborts the whole run (the error is
            // thrown out of case processing and caught at the top level), so the logged event
            // is staged as 'critical_error' rather than 'initial_processing'.
            expect(event).toBeDefined();
            expect(event.body).toHaveProperty('stage', 'critical_error');
            expect(event.body).toHaveProperty('error_type');
        });

        it('should log critical errors when execution fails completely', async () => {
            const CASE_STATUS_FIELD = 'cases.estadoActual';

            await ActionMother.create(actionRepository, {
                triggers: [ActionTriggers.CRON_JOB.value],
                automation_id: automations.id.value,
                conditions: {
                    rules: [
                        {
                            field: CASE_STATUS_FIELD,
                            value: aggTransitions.siguiente_estado_id.value,
                            operator: '=',
                        },
                    ],
                    combinator: 'and',
                },
            });

            const originalValidate = caseRepository.findAllMatchingCondition;
            caseRepository.findAllMatchingCondition = jest.fn().mockRejectedValue('Database error');

            await actionQueueExecutions.execute();

            caseRepository.findAllMatchingCondition = originalValidate;

            const event = await actionsQueueExecutionsRepository
                .connection(`${testSchema}.event_logs`)
                .where('event_name', 'action-queue-execution.error')
                .orderBy('occurred_at', 'desc')
                .first();
            expect(event).toBeDefined();
            expect(event.body).toBeDefined();
            expect(event.body).toHaveProperty('stage', 'critical_error');
            expect(event.body).toHaveProperty('error_type', 'String');
        });

        it('should log a critical_error event when multiple actions have invalid conditions', async () => {
            for (let i = 0; i < 3; i++) {
                await ActionMother.create(actionRepository, {
                    triggers: [ActionTriggers.CRON_JOB.value],
                    automation_id: automations.id.value,
                    conditions: {
                        rules: [
                            {
                                field: 'invalid.field.' + i,
                                value: 'value',
                                operator: '=',
                                value_type: 'invalid_type',
                            },
                        ],
                        combinator: 'and',
                    },
                });
            }

            await actionQueueExecutions.execute();

            const event = await actionsQueueExecutionsRepository
                .connection(`${testSchema}.event_logs`)
                .where('event_name', 'action-queue-execution.error')
                .orderBy('occurred_at', 'desc')
                .first();

            // Invalid condition fields likewise abort the run and are logged as 'critical_error'.
            expect(event).toBeDefined();
            expect(event.body).toBeDefined();
            expect(event.body).toHaveProperty('stage', 'critical_error');
            expect(event.body).toHaveProperty('error_type');
        });
    });
});
