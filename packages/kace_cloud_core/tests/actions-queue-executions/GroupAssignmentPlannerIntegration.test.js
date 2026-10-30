import { jest } from '@jest/globals';
import { GroupAssignmentPlanner } from '../../src/actions-queue-executions/domain/services/GroupAssignmentPlanner.js';
import { ActionTypes } from '../../src/actions/domain/ActionTypes.js';

import { KnexUserListsRepository } from '../../src/user-lists/infrastructure/persistence/KnexUserListsRepository.js';
import { KnexGroupsRepository } from '../../src/grupos/infrastructure/persistence/KnexGroupsRepository.js';
import UserListMother from '../user-lists/domain/UserListMother.js';
import { GroupFactory } from '../../src/factories/GroupFactory.js';
import { StatusEnum } from '../../src/shared/domain/enum/StatusEnum.js';
import ActionMother from '../actions/domain/ActionMother.js';
import CasesMother from '../cases/domain/CasesMother.js';
import { Action } from '../../src/actions/index.js';
import { Case } from '../../src/cases/index.js';

import { knexConfig } from '../knexfile.js';
import { v4 as uuidv4 } from 'uuid';
import TestHelper from '../TestHelper.js';

describe('GroupAssignmentPlanner', () => {
    const groupsRepository = new KnexGroupsRepository(knexConfig);
    const db = groupsRepository.connection;
    const userListsRepository = new KnexUserListsRepository(db);
    let caseActionValidator;
    let planner;

    /**
     * `GroupFactory` sortea `status` entre ACTIVE(1) e INACTIVE(2), y la resolucion por
     * codigo externo (`ActiveGroupFinderByExternalCode`) descarta los grupos inactivos.
     * Con la factoria en crudo, los dos tests de codigo externo salian cara o cruz: la
     * mitad de las corridas sembraban un grupo inactivo y el planner respondia
     * "Group not found". Se fija el estado en todas las siembras del archivo para que
     * ninguna dependa del sorteo.
     */
    const createActiveGroup = (overrides = {}) =>
        new GroupFactory(knexConfig).create({ status: StatusEnum.ACTIVE.value, ...overrides });

    beforeEach(() => {
        caseActionValidator = {
            validate: jest.fn(),
        };

        planner = new GroupAssignmentPlanner(caseActionValidator, { userListsRepository, groupsRepository }, 2);
    });

    it('uses candidate cases as input source when no critical ordering is configured', async () => {
        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value,
            })
        );

        const groupId = uuidv4();
        const cases = [
            Case.create(CasesMother.dto({ grupo_id: groupId })),
            Case.create(CasesMother.dto({ grupo_id: groupId })),
            Case.create(CasesMother.dto({ grupo_id: groupId })),
        ];

        caseActionValidator.validate.mockResolvedValue(true);

        const result = await planner.plan({
            actions: [action],
            cases,
            workQueueCapacityContext: [],
        });

        expect(result.successOperations).toHaveLength(3);
        expect(result.failedOperations).toHaveLength(0);
        expect(result.errorOperations).toHaveLength(0);
        expect(caseActionValidator.validate).toHaveBeenCalledTimes(3);
    });

    it('ignores candidate cases and reloads active universe from DB when critical ordering is configured', async () => {
        const group = await createActiveGroup();

        const userList = await UserListMother.createUserList(userListsRepository, {
            group_id: group.id.value,
        });

        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ASIGNAR_LISTA_ASESORES.value,
                advisor_list_id: userList.id.value,
            })
        );

        const candidateA = Case.create(CasesMother.dto());
        const candidateB = Case.create(CasesMother.dto());
        const reloadedCase = Case.create(CasesMother.dto());

        const mockCaseFindAllActiveService = {
            execute: jest.fn().mockResolvedValue([reloadedCase]),
        };

        const criticalPlanner = new GroupAssignmentPlanner(
            caseActionValidator,
            {
                userListsRepository,
                groupsRepository,
                caseFindAllActiveService: mockCaseFindAllActiveService,
            },
            2
        );

        caseActionValidator.validate.mockResolvedValue(true);

        const result = await criticalPlanner.plan({
            actions: [action],
            candidateCases: [candidateA, candidateB],
            workQueueCapacityContext: [
                {
                    grupo_id: group.id.value,
                    capacidad: 1,
                    // El planner lee las reglas de orden de `work_queue_sorting_rules`;
                    // sueltas en la raiz del item no las ve y no recarga el universo.
                    work_queue_sorting_rules: [
                        {
                            assign_strategy: 'sla_due_date',
                            order_type: 'asc',
                            cast_type: 'date',
                        },
                    ],
                },
            ],
        });

        expect(mockCaseFindAllActiveService.execute).toHaveBeenCalledTimes(1);
        expect(result.successOperations).toHaveLength(1);
        expect(result.successOperations[0].case.id.value).toBe(reloadedCase.id.value);
        expect(result.successOperations[0].case.id.value).not.toBe(candidateA.id.value);
    });

    it('does not query DB for critical ordering when capacity is zero', async () => {
        const group = await createActiveGroup();

        const userList = await UserListMother.createUserList(userListsRepository, {
            group_id: group.id.value,
        });

        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ASIGNAR_LISTA_ASESORES.value,
                advisor_list_id: userList.id.value,
            })
        );

        const mockCaseFindAllActiveService = {
            execute: jest.fn().mockResolvedValue([Case.create(CasesMother.dto())]),
        };

        const criticalPlanner = new GroupAssignmentPlanner(
            caseActionValidator,
            {
                userListsRepository,
                groupsRepository,
                caseFindAllActiveService: mockCaseFindAllActiveService,
            },
            2
        );

        const result = await criticalPlanner.plan({
            actions: [action],
            candidateCases: [Case.create(CasesMother.dto())],
            workQueueCapacityContext: [
                {
                    grupo_id: group.id.value,
                    capacidad: 0,
                    // Con las reglas bien puestas el test comprueba lo que dice:
                    // que la capacidad cero corta antes de ordenar. Sueltas en la
                    // raiz pasaba por no haber orden configurado en absoluto.
                    work_queue_sorting_rules: [
                        {
                            assign_strategy: 'sla_due_date',
                            order_type: 'asc',
                            cast_type: 'date',
                        },
                    ],
                },
            ],
        });

        expect(mockCaseFindAllActiveService.execute).not.toHaveBeenCalled();
        expect(caseActionValidator.validate).not.toHaveBeenCalled();
        expect(result.successOperations).toHaveLength(0);
        expect(result.failedOperations).toHaveLength(0);
        expect(result.errorOperations).toHaveLength(0);
    });

    it('stops validating once group capacity is reached', async () => {
        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value,
            })
        );

        const groupId = uuidv4();
        const c1 = Case.create(CasesMother.dto({ grupo_id: groupId }));
        const c2 = Case.create(CasesMother.dto({ grupo_id: groupId }));
        const c3 = Case.create(CasesMother.dto({ grupo_id: groupId }));
        const c4 = Case.create(CasesMother.dto({ grupo_id: groupId }));

        const cases = [c1, c2, c3, c4];

        caseActionValidator.validate
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(true);

        const result = await planner.plan({
            actions: [action],
            cases,
            workQueueCapacityContext: [{ grupo_id: groupId, capacidad: 2 }],
        });

        expect(result.successOperations).toHaveLength(2);
        expect(result.successOperations.map((item) => item.case.id.value)).toEqual([c1.id.value, c3.id.value]);
        expect(result.failedOperations).toHaveLength(0);
        expect(result.errorOperations).toHaveLength(0);
        expect(caseActionValidator.validate).toHaveBeenCalledTimes(3);
    });

    it('returns no operations when target group capacity is zero', async () => {
        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value,
            })
        );

        const groupId = uuidv4();
        const cases = [
            Case.create(CasesMother.dto({ grupo_id: groupId })),
            Case.create(CasesMother.dto({ grupo_id: groupId })),
        ];

        const result = await planner.plan({
            actions: [action],
            cases,
            workQueueCapacityContext: [{ grupo_id: groupId, capacidad: 0 }],
        });

        expect(result.successOperations).toHaveLength(0);
        expect(result.failedOperations).toHaveLength(0);
        expect(result.errorOperations).toHaveLength(0);
        expect(caseActionValidator.validate).not.toHaveBeenCalled();
    });

    it('continues evaluating when a technical error occurs before reaching capacity', async () => {
        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value,
            })
        );

        const groupId = uuidv4();
        const c1 = Case.create(CasesMother.dto({ grupo_id: groupId }));
        const c2 = Case.create(CasesMother.dto({ grupo_id: groupId }));
        const c3 = Case.create(CasesMother.dto({ grupo_id: groupId }));

        const cases = [c1, c2, c3];

        caseActionValidator.validate
            .mockResolvedValueOnce(true)
            .mockRejectedValueOnce(new Error('Tech Error'))
            .mockResolvedValueOnce(true);

        const result = await planner.plan({
            actions: [action],
            cases,
            workQueueCapacityContext: [{ grupo_id: groupId, capacidad: 2 }],
        });

        expect(result.successOperations).toHaveLength(2);
        expect(result.successOperations.map((o) => o.case.id.value)).toEqual([c1.id.value, c3.id.value]);
        expect(result.errorOperations).toHaveLength(1);
        expect(result.errorOperations[0].error.message).toBe('Tech Error');
        expect(result.failedOperations).toHaveLength(0);
        expect(caseActionValidator.validate).toHaveBeenCalledTimes(3);
    });

    it('evaluates all cases and returns empty arrays if no case fulfills the constraints when capacity is available', async () => {
        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value,
            })
        );

        const groupId = uuidv4();
        const cases = [
            Case.create(CasesMother.dto({ grupo_id: groupId })),
            Case.create(CasesMother.dto({ grupo_id: groupId })),
            Case.create(CasesMother.dto({ grupo_id: groupId })),
        ];

        caseActionValidator.validate.mockResolvedValue(false);

        const result = await planner.plan({
            actions: [action],
            cases,
            workQueueCapacityContext: [{ grupo_id: groupId, capacidad: 5 }],
        });

        expect(result.successOperations).toHaveLength(0);
        expect(result.errorOperations).toHaveLength(0);
        expect(result.failedOperations).toHaveLength(0);
        expect(caseActionValidator.validate).toHaveBeenCalledTimes(3);
    });

    it('applies capacity independently for each current group', async () => {
        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value,
            })
        );

        const groupId1 = uuidv4();
        const groupId2 = uuidv4();

        const c1 = Case.create(CasesMother.dto({ grupo_id: groupId1 }));
        const c2 = Case.create(CasesMother.dto({ grupo_id: groupId1 }));
        const c3 = Case.create(CasesMother.dto({ grupo_id: groupId2 }));
        const c4 = Case.create(CasesMother.dto({ grupo_id: groupId2 }));
        const c5 = Case.create(CasesMother.dto({ grupo_id: groupId2 }));

        const cases = [c1, c2, c3, c4, c5];

        caseActionValidator.validate.mockResolvedValue(true);

        const result = await planner.plan({
            actions: [action],
            cases,
            workQueueCapacityContext: [
                { grupo_id: groupId1, capacidad: 1 },
                { grupo_id: groupId2, capacidad: 2 },
            ],
        });

        expect(result.successOperations).toHaveLength(3);
        expect(result.successOperations.map((item) => item.case.id.value)).toEqual([
            c1.id.value,
            c3.id.value,
            c4.id.value,
        ]);
        expect(caseActionValidator.validate).toHaveBeenCalledTimes(3);
    });

    it('resolves advisor list group and applies capacity (REAL DATABASE)', async () => {
        const group = await createActiveGroup();

        const userList = await UserListMother.createUserList(userListsRepository, {
            group_id: group.id.value,
        });

        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ASIGNAR_LISTA_ASESORES.value,
                advisor_list_id: userList.id.value,
            })
        );

        const cases = [Case.create(CasesMother.dto()), Case.create(CasesMother.dto()), Case.create(CasesMother.dto())];

        caseActionValidator.validate.mockResolvedValueOnce(true).mockResolvedValueOnce(true);

        const result = await planner.plan({
            actions: [action],
            cases,
            workQueueCapacityContext: [{ grupo_id: group.id.value, capacidad: 2 }],
        });

        expect(result.successOperations).toHaveLength(2);
        expect(result.failedOperations).toHaveLength(0);
        expect(result.errorOperations).toHaveLength(0);
        expect(caseActionValidator.validate).toHaveBeenCalledTimes(2);
    });

    it('processes advisor list assignment normally when resolved group has no capacity config', async () => {
        const group = await createActiveGroup();

        const userList = await UserListMother.createUserList(userListsRepository, {
            group_id: group.id.value,
        });

        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ASIGNAR_LISTA_ASESORES.value,
                advisor_list_id: userList.id.value,
            })
        );

        const cases = [Case.create(CasesMother.dto()), Case.create(CasesMother.dto()), Case.create(CasesMother.dto())];

        caseActionValidator.validate
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(true);

        const result = await planner.plan({
            actions: [action],
            cases,
            workQueueCapacityContext: [],
        });

        expect(result.successOperations).toHaveLength(2);
        expect(result.failedOperations).toHaveLength(1);
        expect(result.errorOperations).toHaveLength(0);
        expect(caseActionValidator.validate).toHaveBeenCalledTimes(3);
    });

    it('resolves external group code using primary search', async () => {
        const externalCodeParam = uuidv4().substring(0, 10);
        const group = await createActiveGroup({ codigo_externo: externalCodeParam });

        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value,
                external_group_code: externalCodeParam,
            })
        );

        const c1 = Case.create(CasesMother.dto());
        const cases = [c1, Case.create(CasesMother.dto())];

        caseActionValidator.validate.mockResolvedValue(true);

        const result = await planner.plan({
            actions: [action],
            cases,
            workQueueCapacityContext: [{ grupo_id: group.id.value, capacidad: 1 }],
        });

        expect(result.successOperations).toHaveLength(1);
        expect(result.successOperations[0].case.id.value).toBe(c1.id.value);
        expect(result.errorOperations).toHaveLength(0);
    });

    it('resolves external group code using fallback search when primary returns no groups', async () => {
        const fallbackCode = uuidv4().substring(0, 10);
        const group = await createActiveGroup();

        await groupsRepository
            .connection('grupos')
            .where('id', group.id.value)
            .update({ codigos_externos: JSON.stringify([fallbackCode]) });

        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value,
                external_group_code: fallbackCode,
            })
        );

        const cases = [Case.create(CasesMother.dto())];

        caseActionValidator.validate.mockResolvedValue(true);

        const result = await planner.plan({
            actions: [action],
            cases,
            workQueueCapacityContext: [],
        });

        expect(result.successOperations).toHaveLength(1);
        expect(result.errorOperations).toHaveLength(0);
    });

    it('returns action error when advisor list id is missing', async () => {
        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ASIGNAR_LISTA_ASESORES.value,
            })
        );

        const result = await planner.plan({
            actions: [action],
            cases: [Case.create(CasesMother.dto())],
            workQueueCapacityContext: [],
        });

        expect(result.successOperations).toHaveLength(0);
        expect(result.failedOperations).toHaveLength(0);
        expect(result.errorOperations).toHaveLength(1);
        expect(result.errorOperations[0].error.message).toMatch(/Missing advisor list id/i);
    });

    it('returns action error when advisor list is not found', async () => {
        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ASIGNAR_LISTA_ASESORES.value,
                advisor_list_id: uuidv4(),
            })
        );

        const result = await planner.plan({
            actions: [action],
            cases: [Case.create(CasesMother.dto())],
            workQueueCapacityContext: [],
        });

        expect(result.successOperations).toHaveLength(0);
        expect(result.errorOperations).toHaveLength(1);
        expect(result.errorOperations[0].error.message).toMatch(/not found/i);
    });

    it('returns action error when advisor list is found but has no group_id', async () => {
        const userList = await UserListMother.createUserList(userListsRepository);
        await userListsRepository
            .connection('lista_usuarios')
            .where('id', userList.id.value)
            .update({ group_id: null });

        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ASIGNAR_LISTA_ASESORES.value,
                advisor_list_id: userList.id.value,
            })
        );

        const result = await planner.plan({
            actions: [action],
            cases: [Case.create(CasesMother.dto())],
            workQueueCapacityContext: [],
        });

        expect(result.successOperations).toHaveLength(0);
        expect(result.errorOperations).toHaveLength(1);
        expect(result.errorOperations[0].error.message).toMatch(/has no group_id/i);
    });

    it('returns action error when external group code cannot be resolved', async () => {
        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value,
                external_group_code: uuidv4(),
            })
        );

        const result = await planner.plan({
            actions: [action],
            cases: [Case.create(CasesMother.dto())],
            workQueueCapacityContext: [],
        });

        expect(result.successOperations).toHaveLength(0);
        expect(result.failedOperations).toHaveLength(0);
        expect(result.errorOperations).toHaveLength(1);
        expect(result.errorOperations[0].error.message).toMatch(/Group not found/i);
    });

    it('records technical errors strictly in errorOperations without duplicate in failedOperations for unconstrained groups', async () => {
        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value,
            })
        );

        const cases = [Case.create(CasesMother.dto())];

        caseActionValidator.validate.mockRejectedValue(new Error('boom'));

        const result = await planner.plan({
            actions: [action],
            cases,
            workQueueCapacityContext: [],
        });

        expect(result.successOperations).toHaveLength(0);
        expect(result.failedOperations).toHaveLength(0);
        expect(result.errorOperations).toHaveLength(1);
        expect(result.errorOperations[0].error.message).toBe('boom');
    });

    it('records invalid validations correctly in failedOperations for unconstrained groups', async () => {
        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value,
            })
        );

        const cases = [Case.create(CasesMother.dto())];

        caseActionValidator.validate.mockResolvedValue(false);

        const result = await planner.plan({
            actions: [action],
            cases,
            workQueueCapacityContext: [],
        });

        expect(result.successOperations).toHaveLength(0);
        expect(result.failedOperations).toHaveLength(1);
        expect(result.errorOperations).toHaveLength(0);
    });
});
