import { EntityActionExecutionService } from '../../../../src/shared/domain/services/EntityActionExecutionService.js';
import { Action, ActionTypes, ActionTriggers } from '../../../../src/actions/index.js';
import { KnexUsersRepository } from '../../../../src/users/index.js';
import { KnexGroupsRepository } from '../../../../src/grupos/index.js';
import { KnexShiftManagementRepository } from '../../../../src/shift-management/index.js';
import ActionMother from '../../../actions/domain/ActionMother.js';
import UsersMother from '../../../users/domain/UsersMother.js';
import { GroupsMother } from '../../../grupos/domain/GroupsMother.js';
import { knexConfig } from '../../../knexfile.js';
import { RuleOperator } from '../../../../src/actions/domain/QueryTranslator/RuleOperator.js';

describe('EntityActionExecutionService', () => {
    const usersRepository = new KnexUsersRepository(knexConfig);
    const groupsRepository = new KnexGroupsRepository(knexConfig);
    const shiftManagementRepository = new KnexShiftManagementRepository(knexConfig);

    let actionRepository;
    let actionExecutor;
    let service;
    let executorCalls;
    let repositoryActions;

    beforeEach(async () => {
        executorCalls = [];
        repositoryActions = [];

        /**
         * `EntityActionExecutionService.execute` no habla con el repositorio:
         * delega en `FinderByTrigger`, que arma un `Criteria` y llama a
         * `search`. El doble solo ofrecia `findByTrigger`, asi que `search` era
         * `undefined`; el TypeError se lo tragaba el try/catch de
         * `FinderByTrigger`, que devolvia `undefined`, y `execute` salia por
         * `if (!actions) return` sin ejecutar ni una accion. De ahi que los
         * siete casos que esperaban una ejecucion vieran 0 y los negativos
         * pasaran por el motivo equivocado.
         *
         * El doble ignora el `Criteria` a proposito: el filtrado por trigger,
         * `is_active` y `deleted_at` es responsabilidad de `KnexActionRepository`
         * y aqui se controla poniendo en `repositoryActions` justo lo que cada
         * caso quiere que el servicio reciba.
         */
        actionRepository = {
            search: async (_criteria) => {
                return repositoryActions;
            },
        };

        actionExecutor = {
            execute: async (...args) => {
                executorCalls.push(args);
                return true;
            },
        };

        service = new EntityActionExecutionService(actionRepository, actionExecutor);
    });

    describe('execute', () => {
        it('should execute actions that meet conditions for user entity', async () => {
            const user = await UsersMother.createUser(usersRepository, {
                nombres: 'John',
            });

            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'nombres',
                        operator: RuleOperator.EQUALS,
                        value: 'John',
                        type: 'manual_input',
                    },
                ],
            };

            const action = new Action(
                ActionMother.dto({
                    action_type: ActionTypes.ENVIO_CORREO.value,
                    entity: 'user',
                    triggers: [ActionTriggers.CREATE_USER.value],
                    conditions,
                    is_active: true,
                })
            );

            repositoryActions.push(action);

            await service.execute(ActionTriggers.CREATE_USER.value, user, {});

            expect(executorCalls.length).toBe(1);
            expect(executorCalls[0][0]).toBeInstanceOf(Action);
            expect(executorCalls[0][1]).toBe(user);
            expect(executorCalls[0][2]).toEqual({});
            expect(executorCalls[0][3]).toBe(ActionTriggers.CREATE_USER.value);
        });

        it('should not execute actions that do not meet conditions', async () => {
            const user = await UsersMother.createUser(usersRepository, {
                nombres: 'Jane',
            });

            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'nombres',
                        operator: RuleOperator.EQUALS,
                        value: 'John',
                        type: 'manual_input',
                    },
                ],
            };

            const action = new Action(
                ActionMother.dto({
                    action_type: ActionTypes.ENVIO_CORREO.value,
                    entity: 'user',
                    triggers: [ActionTriggers.CREATE_USER.value],
                    conditions,
                    is_active: true,
                })
            );

            repositoryActions.push(action);

            await service.execute(ActionTriggers.CREATE_USER.value, user, {});

            expect(executorCalls.length).toBe(0);
        });

        it('should execute multiple actions that meet conditions', async () => {
            const user = await UsersMother.createUser(usersRepository, {
                nombres: 'John',
            });

            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'nombres',
                        operator: RuleOperator.EQUALS,
                        value: 'John',
                        type: 'manual_input',
                    },
                ],
            };

            const action1 = new Action(
                ActionMother.dto({
                    action_type: ActionTypes.ENVIO_CORREO.value,
                    entity: 'user',
                    triggers: [ActionTriggers.CREATE_USER.value],
                    conditions,
                    is_active: true,
                    priority: 1,
                })
            );

            const action2 = new Action(
                ActionMother.dto({
                    action_type: ActionTypes.ENVIO_CORREO.value,
                    entity: 'user',
                    triggers: [ActionTriggers.CREATE_USER.value],
                    conditions,
                    is_active: true,
                    priority: 2,
                })
            );

            repositoryActions.push(action1, action2);

            await service.execute(ActionTriggers.CREATE_USER.value, user, {});

            expect(executorCalls.length).toBe(2);
        });

        it('should handle when no actions are found for trigger', async () => {
            const user = await UsersMother.createUser(usersRepository);

            await service.execute(ActionTriggers.UPDATE_USER.value, user, {});

            expect(executorCalls.length).toBe(0);
        });

        it('should execute actions with empty conditions', async () => {
            const user = await UsersMother.createUser(usersRepository);

            const conditions = {
                combinator: 'and',
                rules: [],
            };

            const action = new Action(
                ActionMother.dto({
                    action_type: ActionTypes.ENVIO_CORREO.value,
                    entity: 'user',
                    triggers: [ActionTriggers.CREATE_USER.value],
                    conditions,
                    is_active: true,
                })
            );

            repositoryActions.push(action);

            await service.execute(ActionTriggers.CREATE_USER.value, user, {});

            expect(executorCalls.length).toBe(1);
        });

        it('should execute actions for group entity', async () => {
            const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'nombre',
                        operator: RuleOperator.CONTAINS,
                        value: 'Grupo',
                        type: 'manual_input',
                    },
                ],
            };

            const action = new Action(
                ActionMother.dto({
                    action_type: ActionTypes.ENVIO_CORREO.value,
                    entity: 'group',
                    triggers: [ActionTriggers.CREATE_GROUP.value],
                    conditions,
                    is_active: true,
                })
            );

            repositoryActions.push(action);

            await service.execute(ActionTriggers.CREATE_GROUP.value, group, {});

            expect(executorCalls.length).toBe(1);
            expect(executorCalls[0][0]).toBeInstanceOf(Action);
            expect(executorCalls[0][1]).toBe(group);
            expect(executorCalls[0][2]).toEqual({});
            expect(executorCalls[0][3]).toBe(ActionTriggers.CREATE_GROUP.value);
        });

        it('should pass additional content to action executor', async () => {
            const user = await UsersMother.createUser(usersRepository);

            const conditions = {
                combinator: 'and',
                rules: [],
            };

            const action = new Action(
                ActionMother.dto({
                    action_type: ActionTypes.ENVIO_CORREO.value,
                    entity: 'user',
                    triggers: [ActionTriggers.CREATE_USER.value],
                    conditions,
                    is_active: true,
                })
            );

            repositoryActions.push(action);

            const additionalContent = { customField: 'customValue' };

            await service.execute(ActionTriggers.CREATE_USER.value, user, additionalContent);

            expect(executorCalls.length).toBe(1);
            expect(executorCalls[0][0]).toBeInstanceOf(Action);
            expect(executorCalls[0][1]).toBe(user);
            expect(executorCalls[0][2]).toEqual(additionalContent);
            expect(executorCalls[0][3]).toBe(ActionTriggers.CREATE_USER.value);
        });

        it('should handle complex nested conditions', async () => {
            const user = await UsersMother.createUser(usersRepository, {
                nombres: 'John',
                apellido1: 'Doe',
            });

            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'nombres',
                        operator: RuleOperator.EQUALS,
                        value: 'John',
                        type: 'manual_input',
                    },
                    {
                        combinator: 'or',
                        rules: [
                            {
                                field: 'apellido1',
                                operator: RuleOperator.EQUALS,
                                value: 'Doe',
                                type: 'manual_input',
                            },
                            {
                                field: 'apellido1',
                                operator: RuleOperator.EQUALS,
                                value: 'Smith',
                                type: 'manual_input',
                            },
                        ],
                    },
                ],
            };

            const action = new Action(
                ActionMother.dto({
                    action_type: ActionTypes.ENVIO_CORREO.value,
                    entity: 'user',
                    triggers: [ActionTriggers.CREATE_USER.value],
                    conditions,
                    is_active: true,
                })
            );

            repositoryActions.push(action);

            await service.execute(ActionTriggers.CREATE_USER.value, user, {});

            expect(executorCalls.length).toBe(1);
        });

        it('should not execute actions when conditions partially match', async () => {
            const user = await UsersMother.createUser(usersRepository, {
                nombres: 'John',
            });

            const conditions = {
                combinator: 'and',
                rules: [
                    {
                        field: 'nombres',
                        operator: RuleOperator.EQUALS,
                        value: 'John',
                        type: 'manual_input',
                    },
                    {
                        field: 'nombres',
                        operator: RuleOperator.EQUALS,
                        value: 'Jane',
                        type: 'manual_input',
                    },
                ],
            };

            const action = new Action(
                ActionMother.dto({
                    action_type: ActionTypes.ENVIO_CORREO.value,
                    entity: 'user',
                    triggers: [ActionTriggers.CREATE_USER.value],
                    conditions,
                    is_active: true,
                })
            );

            repositoryActions.push(action);

            await service.execute(ActionTriggers.CREATE_USER.value, user, {});

            expect(executorCalls.length).toBe(0);
        });

        it('should execute only actions that meet conditions when multiple actions exist', async () => {
            const user = await UsersMother.createUser(usersRepository, {
                nombres: 'John',
            });

            const action1 = new Action(
                ActionMother.dto({
                    action_type: ActionTypes.ENVIO_CORREO.value,
                    entity: 'user',
                    triggers: [ActionTriggers.CREATE_USER.value],
                    conditions: {
                        combinator: 'and',
                        rules: [
                            {
                                field: 'nombres',
                                operator: RuleOperator.EQUALS,
                                value: 'John',
                                type: 'manual_input',
                            },
                        ],
                    },
                    is_active: true,
                    priority: 1,
                })
            );

            const action2 = new Action(
                ActionMother.dto({
                    action_type: ActionTypes.ENVIO_CORREO.value,
                    entity: 'user',
                    triggers: [ActionTriggers.CREATE_USER.value],
                    conditions: {
                        combinator: 'and',
                        rules: [
                            {
                                field: 'nombres',
                                operator: RuleOperator.EQUALS,
                                value: 'Jane',
                                type: 'manual_input',
                            },
                        ],
                    },
                    is_active: true,
                    priority: 2,
                })
            );

            repositoryActions.push(action1, action2);

            await service.execute(ActionTriggers.CREATE_USER.value, user, {});

            expect(executorCalls.length).toBe(1);
        });
    });

    describe('executeForCron', () => {
        it('returns zero counters when actions list is empty', async () => {
            const result = await service.executeForCron([], [{ id: { value: 'u1' } }]);
            expect(result).toEqual({ processed: 0, matched: 0, executed: 0, failed: 0 });
            expect(executorCalls).toHaveLength(0);
        });

        it('returns zero counters when entities list is empty', async () => {
            const action = new Action(
                ActionMother.dto({
                    action_type: ActionTypes.ENVIO_CORREO.value,
                    entity: 'user',
                    triggers: [ActionTriggers.CRON_JOB.value],
                    is_active: true,
                })
            );

            const result = await service.executeForCron([action], []);
            expect(result).toEqual({ processed: 0, matched: 0, executed: 0, failed: 0 });
            expect(executorCalls).toHaveLength(0);
        });

        it('executes action for each entity whose conditions match', async () => {
            const matching = await UsersMother.createUser(usersRepository, { nombres: 'John' });
            const nonMatching = await UsersMother.createUser(usersRepository, { nombres: 'Jane' });

            const conditions = {
                combinator: 'and',
                rules: [{ field: 'nombres', operator: RuleOperator.EQUALS, value: 'John', type: 'manual_input' }],
            };

            const action = new Action(
                ActionMother.dto({
                    action_type: ActionTypes.ENVIO_CORREO.value,
                    entity: 'user',
                    triggers: [ActionTriggers.CRON_JOB.value],
                    conditions,
                    is_active: true,
                })
            );

            const result = await service.executeForCron([action], [matching, nonMatching]);

            expect(result).toEqual({ processed: 2, matched: 1, executed: 1, failed: 0 });
            expect(executorCalls).toHaveLength(1);
            expect(executorCalls[0][1]).toBe(matching);
            expect(executorCalls[0][3]).toBe(ActionTriggers.CRON_JOB.value);
        });

        it('counts a failure when executor returns falsy and continues with next pair', async () => {
            const u1 = await UsersMother.createUser(usersRepository, { nombres: 'John' });
            const u2 = await UsersMother.createUser(usersRepository, { nombres: 'John' });

            const conditions = {
                combinator: 'and',
                rules: [{ field: 'nombres', operator: RuleOperator.EQUALS, value: 'John', type: 'manual_input' }],
            };

            const action = new Action(
                ActionMother.dto({
                    action_type: ActionTypes.ENVIO_CORREO.value,
                    entity: 'user',
                    triggers: [ActionTriggers.CRON_JOB.value],
                    conditions,
                    is_active: true,
                })
            );

            // Override executor: succeed for u1, fail for u2.
            actionExecutor.execute = async (_action, entity) => entity.id.value !== u2.id.value;

            const result = await service.executeForCron([action], [u1, u2]);

            expect(result).toEqual({ processed: 2, matched: 2, executed: 1, failed: 1 });
        });

        it('counts a failure when executor throws and continues with next pair', async () => {
            const u1 = await UsersMother.createUser(usersRepository, { nombres: 'John' });
            const u2 = await UsersMother.createUser(usersRepository, { nombres: 'John' });

            const conditions = {
                combinator: 'and',
                rules: [{ field: 'nombres', operator: RuleOperator.EQUALS, value: 'John', type: 'manual_input' }],
            };

            const action = new Action(
                ActionMother.dto({
                    action_type: ActionTypes.ENVIO_CORREO.value,
                    entity: 'user',
                    triggers: [ActionTriggers.CRON_JOB.value],
                    conditions,
                    is_active: true,
                })
            );

            actionExecutor.execute = async (_action, entity) => {
                if (entity.id.value === u1.id.value) {
                    throw new Error('executor blew up');
                }
                return true;
            };

            const result = await service.executeForCron([action], [u1, u2]);

            expect(result).toEqual({ processed: 2, matched: 2, executed: 1, failed: 1 });
        });

        it('respects custom concurrency option', async () => {
            const u1 = await UsersMother.createUser(usersRepository, { nombres: 'John' });
            const u2 = await UsersMother.createUser(usersRepository, { nombres: 'John' });

            const conditions = {
                combinator: 'and',
                rules: [{ field: 'nombres', operator: RuleOperator.EQUALS, value: 'John', type: 'manual_input' }],
            };

            const action = new Action(
                ActionMother.dto({
                    action_type: ActionTypes.ENVIO_CORREO.value,
                    entity: 'user',
                    triggers: [ActionTriggers.CRON_JOB.value],
                    conditions,
                    is_active: true,
                })
            );

            const result = await service.executeForCron([action], [u1, u2], { concurrency: 1 });

            expect(result.processed).toBe(2);
            expect(result.matched).toBe(2);
            expect(result.executed).toBe(2);
        });
    });
});
