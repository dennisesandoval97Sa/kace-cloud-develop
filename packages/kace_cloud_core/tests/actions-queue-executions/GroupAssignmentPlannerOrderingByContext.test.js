import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { GroupAssignmentPlanner } from '../../src/actions-queue-executions/domain/services/GroupAssignmentPlanner.js';
import { Action } from '../../src/actions/index.js';
import { ActionTypes } from '../../src/actions/domain/ActionTypes.js';
import { CaseFactory } from '../../src/factories/CaseFactory.js';
import { GroupFactory } from '../../src/factories/GroupFactory.js';
import { StatusEnum } from '../../src/shared/domain/enum/StatusEnum.js';
import { KnexCaseRepository } from '../../src/cases/infrastructure/persistence/KnexCaseRepository.js';
import { CaseFindAllActiveService } from '../../src/cases/domain/services/CaseFindAllActiveService.js';
import { KnexGroupsRepository } from '../../src/grupos/infrastructure/persistence/KnexGroupsRepository.js';
import { KnexUserListsRepository } from '../../src/user-lists/infrastructure/persistence/KnexUserListsRepository.js';
import { knexConfig } from '../knexfile.js';
import TestHelper from '../TestHelper.js';
import ActionMother from '../actions/domain/ActionMother.js';
import UserListMother from '../user-lists/domain/UserListMother.js';
import { Case } from '../../src/cases/index.js';
import CasesMother from '../cases/domain/CasesMother.js';
import { ensureParentRow } from '../support/ensureParentRow.js';

describe('GroupAssignmentPlanner ordering by context', () => {
    const caseRepository = new KnexCaseRepository(knexConfig);
    const groupsRepository = new KnexGroupsRepository(caseRepository.connection);
    const userListsRepository = new KnexUserListsRepository(caseRepository.connection);
    const caseFindAllActiveService = new CaseFindAllActiveService(caseRepository);
    let caseActionValidator;
    let planner;
    let responsableId;

    /**
     * `GroupFactory` sortea `status` entre ACTIVE(1) e INACTIVE(2). El test que asigna por
     * codigo externo resuelve el grupo con `ActiveGroupFinderByExternalCode`, que ignora los
     * inactivos, asi que sembrar con la factoria en crudo era una moneda al aire. Se fija el
     * estado en todas las siembras del archivo para que ninguna dependa del sorteo.
     */
    const createActiveGroup = (overrides = {}) =>
        new GroupFactory(knexConfig).create({ status: StatusEnum.ACTIVE.value, ...overrides });

    /**
     * `CaseFactory` resuelve `responsable_id` con `UserFactory` cuando el llamante no lo pasa, y
     * `UserFactory` genera los apellidos con `chance.last()`, que emite `O'connor` o
     * `D'Angelo` en torno al 0.45% de las veces. `ValueObjectUserName` rechaza el apostrofe
     * ASCII, asi que cada caso sembrado sin responsable era una tirada de dados que reventaba
     * el archivo entero con un `Error creating factory instance` imputado a un `it` al azar.
     * Con un responsable propio -una fila minima en `usuarios`, sin nombres- la relacion no se
     * resuelve y no hay sorteo.
     */
    const createCase = (overrides = {}) =>
        new CaseFactory(knexConfig).create({ responsable_id: responsableId, ...overrides });

    beforeEach(async () => {
        responsableId = uuidv4();
        await ensureParentRow(caseRepository.connection, 'usuarios', responsableId);

        caseActionValidator = {
            validate: jest.fn().mockResolvedValue(true),
        };

        planner = new GroupAssignmentPlanner(caseActionValidator, {
            userListsRepository,
            groupsRepository,
            caseFindAllActiveService,
        });
    });

    afterEach(async () => {
        await caseRepository.connection('aux_cases').del();
        await caseRepository.connection('cases').del();
    });

    it('respects asc: returns 2 smallest by sla_due_date', async () => {
        const targetGroupId = uuidv4();
        await createActiveGroup({ id: targetGroupId });
        const userList = await UserListMother.createUserList(userListsRepository, { group_id: targetGroupId });
        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ASIGNAR_LISTA_ASESORES.value,
                advisor_list_id: userList.id.value,
            })
        );

        const lateCase = await createCase({
            grupo_id: targetGroupId,
            sla_due_date: '2030-01-03T10:00:00.000Z',
        });
        const firstCase = await createCase({
            grupo_id: targetGroupId,
            sla_due_date: '2030-01-01T10:00:00.000Z',
        });
        const secondCase = await createCase({
            grupo_id: targetGroupId,
            sla_due_date: '2030-01-02T10:00:00.000Z',
        });

        const result = await planner.plan({
            actions: [action],
            cases: [lateCase, firstCase, secondCase],
            workQueueCapacityContext: [
                {
                    grupo_id: targetGroupId,
                    capacidad: 2,
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

        expect(result.successOperations.map((item) => item.case.id.value)).toEqual([
            firstCase.id.value,
            secondCase.id.value,
        ]);
    });

    it('respects desc: returns 2 greatest by sla_due_date', async () => {
        const targetGroupId = uuidv4();
        const externalCode = uuidv4().substring(0, 10);
        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value,
                external_group_code: externalCode,
            })
        );

        await createActiveGroup({ id: targetGroupId, codigo_externo: externalCode });

        const lowCase = await createCase({
            grupo_id: targetGroupId,
            sla_due_date: '2030-01-01T10:00:00.000Z',
        });
        const highCase = await createCase({
            grupo_id: targetGroupId,
            sla_due_date: '2030-01-03T10:00:00.000Z',
        });
        const midCase = await createCase({
            grupo_id: targetGroupId,
            sla_due_date: '2030-01-02T10:00:00.000Z',
        });

        const result = await planner.plan({
            actions: [action],
            cases: [lowCase, highCase, midCase],
            workQueueCapacityContext: [
                {
                    grupo_id: targetGroupId,
                    capacidad: 2,
                    work_queue_sorting_rules: [
                        {
                            assign_strategy: 'sla_due_date',
                            order_type: 'desc',
                            cast_type: 'date',
                        },
                    ],
                },
            ],
        });

        expect(result.successOperations.map((item) => item.case.id.value)).toEqual([
            highCase.id.value,
            midCase.id.value,
        ]);
    });

    it('if capacity does not crop, processes all but already ordered', async () => {
        const targetGroupId = uuidv4();
        await createActiveGroup({ id: targetGroupId });
        const userList = await UserListMother.createUserList(userListsRepository, { group_id: targetGroupId });
        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ASIGNAR_LISTA_ASESORES.value,
                advisor_list_id: userList.id.value,
            })
        );

        const third = await createCase({
            grupo_id: targetGroupId,
            sla_due_date: '2030-01-03T10:00:00.000Z',
        });
        const first = await createCase({
            grupo_id: targetGroupId,
            sla_due_date: '2030-01-01T10:00:00.000Z',
        });
        const second = await createCase({
            grupo_id: targetGroupId,
            sla_due_date: '2030-01-02T10:00:00.000Z',
        });

        const result = await planner.plan({
            actions: [action],
            cases: [third, first, second],
            workQueueCapacityContext: [
                {
                    grupo_id: targetGroupId,
                    capacidad: 10,
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

        expect(result.successOperations.map((item) => item.case.id.value)).toEqual([
            first.id.value,
            second.id.value,
            third.id.value,
        ]);
    });

    it('if group has no ordering config, keeps incoming order', async () => {
        const targetGroupId = uuidv4();
        await createActiveGroup({ id: targetGroupId });
        const userList = await UserListMother.createUserList(userListsRepository, { group_id: targetGroupId });
        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ASIGNAR_LISTA_ASESORES.value,
                advisor_list_id: userList.id.value,
            })
        );

        const c1 = Case.create(CasesMother.dto());
        const c2 = Case.create(CasesMother.dto());
        const c3 = Case.create(CasesMother.dto());

        const result = await planner.plan({
            actions: [action],
            cases: [c3, c1, c2],
            workQueueCapacityContext: [{ grupo_id: targetGroupId, capacidad: 2 }],
        });

        expect(result.successOperations.map((item) => item.case.id.value)).toEqual([c3.id.value, c1.id.value]);
    });

    it('supports cast_type int ordering (ans_posicion)', async () => {
        const targetGroupId = uuidv4();
        await createActiveGroup({ id: targetGroupId });
        const userList = await UserListMother.createUserList(userListsRepository, { group_id: targetGroupId });
        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ASIGNAR_LISTA_ASESORES.value,
                advisor_list_id: userList.id.value,
            })
        );

        const pos3 = await createCase({ grupo_id: targetGroupId, ans_posicion: 3 });
        const pos1 = await createCase({ grupo_id: targetGroupId, ans_posicion: 1 });
        const pos2 = await createCase({ grupo_id: targetGroupId, ans_posicion: 2 });

        const result = await planner.plan({
            actions: [action],
            cases: [pos3, pos1, pos2],
            workQueueCapacityContext: [
                {
                    grupo_id: targetGroupId,
                    capacidad: 2,
                    work_queue_sorting_rules: [
                        {
                            assign_strategy: 'ans_posicion',
                            order_type: 'asc',
                            cast_type: 'int',
                        },
                    ],
                },
            ],
        });

        expect(result.successOperations.map((item) => item.case.id.value)).toEqual([pos1.id.value, pos2.id.value]);
    });

    it('with invalid cast_type/strategy does not crash and still respects capacity', async () => {
        const targetGroupId = uuidv4();
        await createActiveGroup({ id: targetGroupId });
        const userList = await UserListMother.createUserList(userListsRepository, { group_id: targetGroupId });
        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ASIGNAR_LISTA_ASESORES.value,
                advisor_list_id: userList.id.value,
            })
        );

        const c1 = await createCase({
            grupo_id: targetGroupId,
            sla_due_date: '2030-01-03T10:00:00.000Z',
        });
        const c2 = await createCase({
            grupo_id: targetGroupId,
            sla_due_date: '2030-01-02T10:00:00.000Z',
        });
        const c3 = await createCase({
            grupo_id: targetGroupId,
            sla_due_date: '2030-01-01T10:00:00.000Z',
        });

        const result = await planner.plan({
            actions: [action],
            cases: [c1, c2, c3],
            workQueueCapacityContext: [
                {
                    grupo_id: targetGroupId,
                    capacidad: 2,
                    work_queue_sorting_rules: [
                        {
                            assign_strategy: 'field_that_does_not_exist',
                            order_type: 'asc',
                            cast_type: 'invalid-cast',
                        },
                    ],
                },
            ],
        });

        expect(result.successOperations).toHaveLength(2);
    });

    it('on tie in ordering field, includes tied cases under capacity (no stable-order assumption)', async () => {
        const targetGroupId = uuidv4();
        await createActiveGroup({ id: targetGroupId });
        const userList = await UserListMother.createUserList(userListsRepository, { group_id: targetGroupId });
        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ASIGNAR_LISTA_ASESORES.value,
                advisor_list_id: userList.id.value,
            })
        );

        const tieA = await createCase({
            grupo_id: targetGroupId,
            sla_due_date: '2030-01-01T10:00:00.000Z',
        });
        const tieB = await createCase({
            grupo_id: targetGroupId,
            sla_due_date: '2030-01-01T10:00:00.000Z',
        });
        const later = await createCase({
            grupo_id: targetGroupId,
            sla_due_date: '2030-01-03T10:00:00.000Z',
        });

        const result = await planner.plan({
            actions: [action],
            cases: [later, tieA, tieB],
            workQueueCapacityContext: [
                {
                    grupo_id: targetGroupId,
                    capacidad: 2,
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

        const selectedIds = result.successOperations.map((item) => item.case.id.value);
        expect(selectedIds).toContain(tieA.id.value);
        expect(selectedIds).toContain(tieB.id.value);
        expect(selectedIds).not.toContain(later.id.value);
    });

    it('with ordering enabled, technical validation error continues until capacity is filled', async () => {
        const targetGroupId = uuidv4();
        await createActiveGroup({ id: targetGroupId });
        const userList = await UserListMother.createUserList(userListsRepository, { group_id: targetGroupId });
        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ASIGNAR_LISTA_ASESORES.value,
                advisor_list_id: userList.id.value,
            })
        );

        const first = await createCase({
            grupo_id: targetGroupId,
            sla_due_date: '2030-01-01T10:00:00.000Z',
        });
        const second = await createCase({
            grupo_id: targetGroupId,
            sla_due_date: '2030-01-02T10:00:00.000Z',
        });
        const third = await createCase({
            grupo_id: targetGroupId,
            sla_due_date: '2030-01-03T10:00:00.000Z',
        });

        caseActionValidator.validate.mockImplementation(async (kase) => {
            if (kase.id.value === first.id.value) {
                throw new Error('technical');
            }

            return true;
        });

        const result = await planner.plan({
            actions: [action],
            cases: [third, first, second],
            workQueueCapacityContext: [
                {
                    grupo_id: targetGroupId,
                    capacidad: 2,
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

        expect(result.successOperations.map((item) => item.case.id.value)).toEqual([second.id.value, third.id.value]);
        expect(result.errorOperations).toHaveLength(1);
    });

    it('ASIGNAR_GRUPO_EN_CURSO with mixed configs: one group ordered, another keeps input order', async () => {
        const group1 = uuidv4();
        const group2 = uuidv4();

        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value,
            })
        );

        await createActiveGroup({ id: group1 });
        await createActiveGroup({ id: group2 });

        const g1late = await createCase({
            grupo_id: group1,
            sla_due_date: '2030-01-03T10:00:00.000Z',
        });
        const g1early = await createCase({
            grupo_id: group1,
            sla_due_date: '2030-01-01T10:00:00.000Z',
        });

        const g2low = await createCase({
            grupo_id: group2,
            sla_due_date: '2030-01-01T10:00:00.000Z',
        });
        const g2high = await createCase({
            grupo_id: group2,
            sla_due_date: '2030-01-04T10:00:00.000Z',
        });

        const result = await planner.plan({
            actions: [action],
            cases: [g1late, g1early, g2low, g2high],
            workQueueCapacityContext: [
                {
                    grupo_id: group1,
                    capacidad: 1,
                    work_queue_sorting_rules: [
                        {
                            assign_strategy: 'sla_due_date',
                            order_type: 'asc',
                            cast_type: 'date',
                        },
                    ],
                },
                {
                    grupo_id: group2,
                    capacidad: 1,
                },
            ],
        });

        expect(result.successOperations.map((item) => item.case.id.value)).toEqual([g1early.id.value, g2low.id.value]);
    });

    it('sorts by sla_due_date and breaks ties using created_at', async () => {
        const targetGroupId = uuidv4();
        await createActiveGroup({ id: targetGroupId });
        const userList = await UserListMother.createUserList(userListsRepository, { group_id: targetGroupId });
        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ASIGNAR_LISTA_ASESORES.value,
                advisor_list_id: userList.id.value,
            })
        );

        const case1 = await createCase({
            grupo_id: targetGroupId,
            sla_due_date: '2030-01-01T10:00:00.000Z',
            created_at: '2030-01-01T10:00:00.000Z',
        });
        const case2 = await createCase({
            grupo_id: targetGroupId,
            sla_due_date: '2030-01-01T10:00:00.000Z',
            created_at: '2030-01-02T10:00:00.000Z',
        });
        const case3 = await createCase({
            grupo_id: targetGroupId,
            sla_due_date: '2030-01-02T10:00:00.000Z',
            created_at: '2030-01-03T10:00:00.000Z',
        });

        const result = await planner.plan({
            actions: [action],
            cases: [case3, case2, case1],
            workQueueCapacityContext: [
                {
                    grupo_id: targetGroupId,
                    capacidad: 3,
                    work_queue_sorting_rules: [
                        {
                            assign_strategy: 'sla_due_date',
                            order_type: 'asc',
                            cast_type: 'date',
                        },
                        {
                            assign_strategy: 'created_at',
                            order_type: 'asc',
                        },
                    ],
                },
            ],
        });

        expect(result.successOperations.map((item) => item.case.id.value)).toEqual([
            case1.id.value,
            case2.id.value,
            case3.id.value,
        ]);
    });

    it('when all configured sorting fields tie, it still respects capacity without crashing', async () => {
        const targetGroupId = uuidv4();
        await createActiveGroup({ id: targetGroupId });
        const userList = await UserListMother.createUserList(userListsRepository, { group_id: targetGroupId });
        const action = Action.create(
            ActionMother.dto({
                action_type: ActionTypes.ASIGNAR_LISTA_ASESORES.value,
                advisor_list_id: userList.id.value,
            })
        );

        const caseA = await createCase({
            grupo_id: targetGroupId,
            sla_due_date: '2030-01-01T10:00:00.000Z',
            created_at: '2030-01-01T10:00:00.000Z',
        });
        const caseB = await createCase({
            grupo_id: targetGroupId,
            sla_due_date: '2030-01-01T10:00:00.000Z',
            created_at: '2030-01-01T10:00:00.000Z',
        });
        const caseC = await createCase({
            grupo_id: targetGroupId,
            sla_due_date: '2030-01-01T10:00:00.000Z',
            created_at: '2030-01-01T10:00:00.000Z',
        });

        const result = await planner.plan({
            actions: [action],
            cases: [caseC, caseA, caseB],
            workQueueCapacityContext: [
                {
                    grupo_id: targetGroupId,
                    capacidad: 2,
                    work_queue_sorting_rules: [
                        {
                            assign_strategy: 'sla_due_date',
                            order_type: 'asc',
                            cast_type: 'date',
                        },
                        {
                            assign_strategy: 'created_at',
                            order_type: 'asc',
                        },
                    ],
                },
            ],
        });

        const selectedIds = result.successOperations.map((item) => item.case.id.value);
        const allIds = [caseA.id.value, caseB.id.value, caseC.id.value];

        expect(selectedIds).toHaveLength(2);
        selectedIds.forEach((id) => {
            expect(allIds).toContain(id);
        });
        expect(result.errorOperations).toHaveLength(0);
    });
});
