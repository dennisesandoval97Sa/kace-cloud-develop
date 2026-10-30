import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { globalRoleId } from '@kace/database/seeds/20241125105900_usuario_base.js';
import { knexConfig } from '../knexfile.js';
import TestHelper from '../TestHelper.js';
import { AutomatedGroupAssignmentService } from '../../src/actions-queue-executions/domain/services/AutomatedGroupAssignmentService.js';
import { AssignationService } from '../../src/shared/assignation/AssignationService.js';
import { CaseFindAllActiveService } from '../../src/cases/domain/services/CaseFindAllActiveService.js';
import { CaseFinder } from '../../src/cases/domain/CaseFinder.js';
import { ActionTypes } from '../../src/actions/domain/ActionTypes.js';
import { StatusEnum } from '../../src/shared/domain/enum/StatusEnum.js';

import { KnexGroupsRepository } from '../../src/grupos/index.js';
import { KnexCaseRepository } from '../../src/cases/index.js';
import { KnexActionRepository } from '../../src/actions/infrastructure/KnexActionRepository.js';
import { KnexUsersRepository } from '../../src/users/index.js';
import { KnexUserListsRepository } from '../../src/user-lists/index.js';
import { KnexShiftManagementRepository } from '../../src/shift-management/index.js';
import { KnexGlobalConfigurationRepository } from '../../src/global-config/index.js';
import { KnexUserGroupRelationshipRepository } from '../../src/user-group-relationships/index.js';

import { GlobalConfigurationsMother } from '../global-config/domain/GlobalConfigurationsMother.js';
import { GroupsMother } from '../grupos/domain/GroupsMother.js';
import UsersMother from '../users/domain/UsersMother.js';
import UserGroupRelationshipMother from '../user-group-relationships/domain/UserGroupRelationshipMother.js';
import UserListMother from '../user-lists/domain/UserListMother.js';
import ActionMother from '../actions/domain/ActionMother.js';
import CasesMother from '../cases/domain/CasesMother.js';
import ShiftManagementMother from '../shift-management/domain/ShiftManagementMother.js';
import { SETTINGS_WITH_WORK_QUEUE_PARAMS } from '../global-config/domain/SettingsMother.js';

const activeSessionDate = () => new Date(Date.now() + 60000).toISOString();
describe('AutomatedGroupAssignmentService — Integration', () => {
    const groupsRepository = new KnexGroupsRepository(knexConfig);
    const db = groupsRepository.connection;
    const caseRepository = new KnexCaseRepository(db);
    const actionRepository = new KnexActionRepository(db);
    const usersRepository = new KnexUsersRepository(db);
    const userListRepository = new KnexUserListsRepository(db);
    const shiftManagementRepository = new KnexShiftManagementRepository(db);
    const globalConfigurationRepository = new KnexGlobalConfigurationRepository(db);
    const userGroupRelationshipRepository = new KnexUserGroupRelationshipRepository(db);
    const caseFinder = new CaseFinder(caseRepository);

    /**
     * Creates the service with all real dependencies.
     *
     * Two dependencies are simplified for integration testing:
     *
     * 1. CaseActionValidator — stubbed to always return true.
     *    The real validator calls getCasoInfo which queries aux_cases, clients,
     *    clasificaciones, etc. — seeding those is outside the scope of
     *    testing the assignment engine itself.
     *
     * 2. CaseUserAssignmentService — uses a lightweight adapter that performs
     *    the real DB update (responsable_id, grupo_id) and saves history, but
     *    skips SLA timer recalculation. SLA timers require ANS/shift-management
     *    data that is orthogonal to assignment distribution logic.
     */
    function buildService({ excludeUsersFromValidation = [] } = {}) {
        const excludeSet = new Set(excludeUsersFromValidation);
        const caseActionValidator = {
            validate: jest.fn().mockImplementation(async (kase) => {
                const currentResponsible = kase.responsable_id?.value;
                return !excludeSet.has(currentResponsible);
            }),
        };
        const assignationService = new AssignationService(
            groupsRepository,
            globalConfigurationRepository,
            usersRepository
        );

        const caseUserAssignmentService = {
            execute: async (kase, userId, groupId) => {
                const originalValues = kase.toJson();
                kase.responsable_id = userId;
                kase.grupo_id = groupId;
                kase.updated_by = kase.updated_by?.value || kase.created_by?.value;
                kase.updated_at = new Date();

                await caseRepository.update(kase);
                await caseRepository.saveHistory(kase, originalValues);
            },
        };

        const service = new AutomatedGroupAssignmentService(caseActionValidator, {
            groupsRepository,
            userListsRepository: userListRepository,
            caseRepository,
            assignationService,
            dynamicGroupAssignmentHandler: null,
            caseUserAssignmentService,
            caseFindAllActiveService: new CaseFindAllActiveService(caseRepository),
        });

        const mockEventLogger = {
            logEvent: jest.fn().mockResolvedValue(undefined),
        };
        service.eventLogger = mockEventLogger;
        service.defaultStrategy.eventLogger = mockEventLogger;
        service.prioritizedStrategy.eventLogger = mockEventLogger;

        return service;
    }

    /**
     * Creates a cola_de_trabajo config+shift+group — exactly like GroupsFinderIntegration does.
     * @param {object} [settingsOverrides] - Overrides for the casos section of the settings.
     */
    async function createWorkQueueGroup(settingsOverrides = {}) {
        const baseSettings = JSON.parse(JSON.stringify(SETTINGS_WITH_WORK_QUEUE_PARAMS));
        Object.assign(baseSettings.behaviors.application.agente.casos, settingsOverrides);

        const config = await GlobalConfigurationsMother.createConfiguration(globalConfigurationRepository, {
            settings: baseSettings,
        });

        const shiftManagement = await ShiftManagementMother.createShiftManagement(shiftManagementRepository);
        const group = await GroupsMother.createWithCustomShiftManagementAndConfig(
            groupsRepository,
            shiftManagement,
            config,
            { rol_id: globalRoleId }
        );

        return { config, group, groupId: group.id.value };
    }

    /**
     * Creates a user that is session-active in the given group.
     * Uses `createUserWithRole` + future `last_seen_at` — same pattern as the reference tests.
     */
    async function createActiveUser(groupId) {
        const user = await UsersMother.createUserWithRole(usersRepository, {
            is_active: StatusEnum.ACTIVE.value,
            grupo_activo: groupId,
            last_seen_at: activeSessionDate(),
        });

        await UserGroupRelationshipMother.create(userGroupRelationshipRepository, {
            usuario_id: user.id.value,
            grupo_id: groupId,
        });

        return user;
    }

    /**
     * Creates an open case in the given group, assigned to the given responsible.
     */
    async function createOpenCase(groupId, responsibleId) {
        return CasesMother.createCase(caseRepository, {
            grupo_id: groupId,
            responsable_id: responsibleId,
        });
    }

    describe('ASIGNAR_GRUPO_EN_CURSO — UserSlot strategy (default)', () => {
        it('distributes unassigned cases across users respecting max_cases_per_user', async () => {
            const { groupId } = await createWorkQueueGroup({ max_cases_per_user: 2 });

            const advisor1 = await createActiveUser(groupId);
            const advisor2 = await createActiveUser(groupId);

            const defaultAssignee = await UsersMother.createUserWithRole(usersRepository);

            const case1 = await createOpenCase(groupId, defaultAssignee.id.value);
            const case2 = await createOpenCase(groupId, defaultAssignee.id.value);
            const case3 = await createOpenCase(groupId, defaultAssignee.id.value);

            const action = await ActionMother.create(actionRepository, {
                action_type: ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value,
                is_active: true,
                conditions: {},
            });

            const service = buildService();
            const result = await service.assign({ actions: [action] });

            expect(result.assigned).toBe(3);
            expect(result.errors).toBe(0);

            const updated1 = await caseFinder.execute(case1.id.value);
            const updated2 = await caseFinder.execute(case2.id.value);
            const updated3 = await caseFinder.execute(case3.id.value);

            const assignedIds = [
                updated1.responsable_id.value,
                updated2.responsable_id.value,
                updated3.responsable_id.value,
            ];

            const advisorIds = [advisor1.id.value, advisor2.id.value];
            expect(assignedIds.every((id) => advisorIds.includes(id))).toBe(true);

            const countByAdvisor = advisorIds.map((id) => assignedIds.filter((a) => a === id).length);
            expect(countByAdvisor.sort()).toEqual([1, 2]);

            expect(service.eventLogger.logEvent).toHaveBeenCalledTimes(3);
            expect(service.eventLogger.logEvent).toHaveBeenCalled();
        });

        it('stops when no user has remaining capacity', async () => {
            const { groupId } = await createWorkQueueGroup({ max_cases_per_user: 1 });

            const advisor = await createActiveUser(groupId);
            const defaultAssignee = await UsersMother.createUserWithRole(usersRepository);

            await createOpenCase(groupId, advisor.id.value);

            await createOpenCase(groupId, defaultAssignee.id.value);

            const action = await ActionMother.create(actionRepository, {
                action_type: ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value,
                conditions: {},
            });

            const service = buildService();
            const result = await service.assign({ actions: [action] });

            expect(result.assigned).toBe(0);
        });

        it('handles multiple groups independently in a single assign() call', async () => {
            const { groupId: groupIdA } = await createWorkQueueGroup({ max_cases_per_user: 1 });
            const advisorA = await createActiveUser(groupIdA);
            const defaultA = await UsersMother.createUserWithRole(usersRepository);
            const caseA = await createOpenCase(groupIdA, defaultA.id.value);

            const { groupId: groupIdB } = await createWorkQueueGroup({ max_cases_per_user: 1 });
            const advisorB = await createActiveUser(groupIdB);
            const defaultB = await UsersMother.createUserWithRole(usersRepository);
            const caseB = await createOpenCase(groupIdB, defaultB.id.value);

            const action = await ActionMother.create(actionRepository, {
                action_type: ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value,
                conditions: {},
            });

            const service = buildService();
            const result = await service.assign({ actions: [action] });

            expect(result.assigned).toBe(2);

            const updatedA = await caseFinder.execute(caseA.id.value);
            const updatedB = await caseFinder.execute(caseB.id.value);

            expect(updatedA.responsable_id.value).toBe(advisorA.id.value);
            expect(updatedB.responsable_id.value).toBe(advisorB.id.value);
        });
    });

    describe('ASIGNAR_GRUPO_EN_CURSO — PrioritizedAssignment strategy', () => {
        it('assigns case to its last non-default responsible from history', async () => {
            const { groupId } = await createWorkQueueGroup({
                max_cases_per_user: 1,
                assignLastResponsibleIgnoreDefault: true,
            });

            const historicalResponsible = await createActiveUser(groupId);
            const fallbackUser = await createActiveUser(groupId);
            const defaultAssignee = await UsersMother.createUserWithRole(usersRepository);

            const kase = await createOpenCase(groupId, defaultAssignee.id.value);

            await db('history_cases').insert({
                id: uuidv4(),
                entity_id: kase.id.value,
                changed_attributes: JSON.stringify({ responsable_id: historicalResponsible.id.value }),
                new_attributes: JSON.stringify({ responsable_id: historicalResponsible.id.value }),
                original_attributes: JSON.stringify({ responsable_id: defaultAssignee.id.value }),
                created_at: new Date(Date.now() + 60000).toISOString(),
                created_by: defaultAssignee.id.value,
            });

            const action = await ActionMother.create(actionRepository, {
                action_type: ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value,
                conditions: {},
            });

            const service = buildService();
            const result = await service.assign({ actions: [action] });

            expect(result.assigned).toBe(1);

            const updatedCase = await caseFinder.execute(kase.id.value);
            expect(updatedCase.responsable_id.value).toBe(historicalResponsible.id.value);

            expect(service.eventLogger.logEvent).toHaveBeenCalled();
        });

        it('skips DEFAULT_ASSIGNEE users in history and falls back to next user', async () => {
            const { groupId } = await createWorkQueueGroup({
                max_cases_per_user: 1,
                assignLastResponsibleIgnoreDefault: true,
            });

            const defaultAssigneeUser = await createActiveUser(groupId);
            await db('usuarios')
                .where({ id: defaultAssigneeUser.id.value })
                .update({
                    codigos_externos: JSON.stringify(['DEFAULT_ASSIGNEE']),
                });

            const realAdvisor = await createActiveUser(groupId);
            const currentOwner = await UsersMother.createUserWithRole(usersRepository);

            const kase = await createOpenCase(groupId, currentOwner.id.value);

            await db('history_cases').insert({
                id: uuidv4(),
                entity_id: kase.id.value,
                changed_attributes: JSON.stringify({ responsable_id: realAdvisor.id.value }),
                new_attributes: JSON.stringify({ responsable_id: realAdvisor.id.value }),
                original_attributes: JSON.stringify({ responsable_id: currentOwner.id.value }),
                created_at: new Date(Date.now() + 60000).toISOString(),
                created_by: currentOwner.id.value,
            });

            await db('history_cases').insert({
                id: uuidv4(),
                entity_id: kase.id.value,
                changed_attributes: JSON.stringify({ responsable_id: defaultAssigneeUser.id.value }),
                new_attributes: JSON.stringify({ responsable_id: defaultAssigneeUser.id.value }),
                original_attributes: JSON.stringify({ responsable_id: realAdvisor.id.value }),
                created_at: new Date(Date.now() + 120000).toISOString(),
                created_by: currentOwner.id.value,
            });

            const action = await ActionMother.create(actionRepository, {
                action_type: ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value,
                conditions: {},
            });

            const service = buildService();
            const result = await service.assign({ actions: [action] });

            expect(result.assigned).toBe(1);

            const updatedCase = await caseFinder.execute(kase.id.value);
            expect(updatedCase.responsable_id.value).not.toBe(defaultAssigneeUser.id.value);
            expect(updatedCase.responsable_id.value).toBe(realAdvisor.id.value);
        });

        it('respects capacity: prioritized user with full slots gets skipped', async () => {
            const { groupId } = await createWorkQueueGroup({
                max_cases_per_user: 1,
                assignLastResponsibleIgnoreDefault: true,
            });

            const historicalResponsible = await createActiveUser(groupId);
            const fallbackUser = await createActiveUser(groupId);

            await createOpenCase(groupId, historicalResponsible.id.value);

            const currentOwner = await UsersMother.createUserWithRole(usersRepository);
            const kase = await createOpenCase(groupId, currentOwner.id.value);

            await db('history_cases').insert({
                id: uuidv4(),
                entity_id: kase.id.value,
                changed_attributes: JSON.stringify({ responsable_id: historicalResponsible.id.value }),
                new_attributes: JSON.stringify({ responsable_id: historicalResponsible.id.value }),
                original_attributes: JSON.stringify({ responsable_id: currentOwner.id.value }),
                created_at: new Date(Date.now() + 60000).toISOString(),
                created_by: currentOwner.id.value,
            });

            const action = await ActionMother.create(actionRepository, {
                action_type: ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value,
                conditions: {},
            });

            const service = buildService({
                excludeUsersFromValidation: [historicalResponsible.id.value],
            });
            const result = await service.assign({ actions: [action] });

            expect(result.assigned).toBe(1);

            const updatedCase = await caseFinder.execute(kase.id.value);
            expect(updatedCase.responsable_id.value).toBe(fallbackUser.id.value);
        });
    });

    describe('ASIGNAR_LISTA_ASESORES — Work queue path', () => {
        it('resolves group from advisor list and assigns within cola_de_trabajo', async () => {
            const { groupId } = await createWorkQueueGroup({ max_cases_per_user: 2 });

            const advisor = await createActiveUser(groupId);
            const currentOwner = await UsersMother.createUserWithRole(usersRepository);

            const advisorList = await UserListMother.createUserList(userListRepository, {
                group_id: groupId,
                lista_usuarios: [{ id: advisor.id.value, name: 'Advisor' }],
            });

            const kase = await createOpenCase(groupId, currentOwner.id.value);

            const action = await ActionMother.create(actionRepository, {
                action_type: ActionTypes.ASIGNAR_LISTA_ASESORES.value,
                advisor_list_id: advisorList.id.value,
                conditions: {},
            });

            const service = buildService();
            const result = await service.assign({ actions: [action] });

            expect(result.assigned).toBe(1);

            const updatedCase = await caseFinder.execute(kase.id.value);
            expect(updatedCase.responsable_id.value).toBe(advisor.id.value);

            expect(service.eventLogger.logEvent).toHaveBeenCalled();
        });

        it('only assigns to users present in the advisor list, not all group users', async () => {
            const { groupId } = await createWorkQueueGroup({ max_cases_per_user: 5 });

            const listedAdvisor = await createActiveUser(groupId);
            const unlistedAdvisor = await createActiveUser(groupId);
            const currentOwner = await UsersMother.createUserWithRole(usersRepository);

            const advisorList = await UserListMother.createUserList(userListRepository, {
                group_id: groupId,
                lista_usuarios: [{ id: listedAdvisor.id.value, name: 'Listed Advisor' }],
            });

            const case1 = await createOpenCase(groupId, currentOwner.id.value);
            const case2 = await createOpenCase(groupId, currentOwner.id.value);
            const case3 = await createOpenCase(groupId, currentOwner.id.value);

            const action = await ActionMother.create(actionRepository, {
                action_type: ActionTypes.ASIGNAR_LISTA_ASESORES.value,
                advisor_list_id: advisorList.id.value,
                conditions: {},
            });

            const service = buildService();
            const result = await service.assign({ actions: [action] });

            expect(result.assigned).toBe(3);
            expect(result.errors).toBe(0);

            const [updated1, updated2, updated3] = await Promise.all([
                caseFinder.execute(case1.id.value),
                caseFinder.execute(case2.id.value),
                caseFinder.execute(case3.id.value),
            ]);

            expect(updated1.responsable_id.value).toBe(listedAdvisor.id.value);
            expect(updated2.responsable_id.value).toBe(listedAdvisor.id.value);
            expect(updated3.responsable_id.value).toBe(listedAdvisor.id.value);
            expect(updated1.responsable_id.value).not.toBe(unlistedAdvisor.id.value);
        });
    });

    describe('ASIGNAR_GRUPO_POR_CODIGO_EXTERNO — Work queue path', () => {
        it('resolves group via codigo_externo and assigns cases', async () => {
            const EXTERNAL_CODE = `EXT-${uuidv4().substring(0, 8)}`;
            const { groupId, group } = await createWorkQueueGroup({ max_cases_per_user: 1 });

            await db('grupos').where({ id: groupId }).update({ codigo_externo: EXTERNAL_CODE });

            const advisor = await createActiveUser(groupId);
            const currentOwner = await UsersMother.createUserWithRole(usersRepository);
            const kase = await createOpenCase(groupId, currentOwner.id.value);

            const action = await ActionMother.create(actionRepository, {
                action_type: ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value,
                external_group_code: EXTERNAL_CODE,
                conditions: {},
            });

            const service = buildService();
            const result = await service.assign({ actions: [action] });

            expect(result.assigned).toBe(1);

            const updatedCase = await caseFinder.execute(kase.id.value);
            expect(updatedCase.responsable_id.value).toBe(advisor.id.value);

            expect(service.eventLogger.logEvent).toHaveBeenCalled();
        });

        it('records an error when no group matches the external code', async () => {
            const action = await ActionMother.create(actionRepository, {
                action_type: ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value,
                external_group_code: 'NONEXISTENT-CODE',
                conditions: {},
            });

            const service = buildService();
            const result = await service.assign({ actions: [action] });

            expect(result.skipped).toBe(1);
            expect(result.assigned).toBe(0);
        });
    });

    describe('capacity tracking across cases in the same run', () => {
        it('correctly decrements capacity as users receive cases during a single execution', async () => {
            const { groupId } = await createWorkQueueGroup({ max_cases_per_user: 2 });

            const advisor1 = await createActiveUser(groupId);
            await createOpenCase(groupId, advisor1.id.value);

            const advisor2 = await createActiveUser(groupId);

            const defaultAssignee = await UsersMother.createUserWithRole(usersRepository);

            const case1 = await createOpenCase(groupId, defaultAssignee.id.value);
            const case2 = await createOpenCase(groupId, defaultAssignee.id.value);
            const case3 = await createOpenCase(groupId, defaultAssignee.id.value);
            const case4 = await createOpenCase(groupId, defaultAssignee.id.value);

            const action = await ActionMother.create(actionRepository, {
                action_type: ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value,
                conditions: {},
            });

            const service = buildService({
                excludeUsersFromValidation: [advisor1.id.value],
            });
            const result = await service.assign({ actions: [action] });

            expect(result.assigned).toBe(3);

            const allUpdated = await Promise.all([
                caseFinder.execute(case1.id.value),
                caseFinder.execute(case2.id.value),
                caseFinder.execute(case3.id.value),
                caseFinder.execute(case4.id.value),
            ]);

            const assignedIds = allUpdated.slice(0, 3).map((c) => c.responsable_id.value);
            const advisor1Count = assignedIds.filter((id) => id === advisor1.id.value).length;
            const advisor2Count = assignedIds.filter((id) => id === advisor2.id.value).length;

            expect(advisor1Count).toBe(1);
            expect(advisor2Count).toBe(2);
            expect(allUpdated[3].responsable_id.value).toBe(defaultAssignee.id.value);
        });
    });

    describe('capacity tracking across multiple actions in the same run (UserSlot)', () => {
        it('baseline: single action with max=1, 1 advisor and 3 candidates assigns only 1 case', async () => {
            const { groupId } = await createWorkQueueGroup({ max_cases_per_user: 1 });
            const advisor = await createActiveUser(groupId);
            const defaultAssignee = await UsersMother.createUserWithRole(usersRepository);

            const case1 = await createOpenCase(groupId, defaultAssignee.id.value);
            const case2 = await createOpenCase(groupId, defaultAssignee.id.value);
            const case3 = await createOpenCase(groupId, defaultAssignee.id.value);

            const action = await ActionMother.create(actionRepository, {
                action_type: ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value,
                conditions: {},
            });

            const service = buildService();
            const result = await service.assign({ actions: [action] });

            expect(result.assigned).toBe(1);
            expect(result.errors).toBe(0);

            const updated = await Promise.all([
                caseFinder.execute(case1.id.value),
                caseFinder.execute(case2.id.value),
                caseFinder.execute(case3.id.value),
            ]);
            const advisorCount = updated.filter((c) => c.responsable_id.value === advisor.id.value).length;
            expect(advisorCount).toBe(1);
        });

        it('two ASIGNAR_GRUPO_POR_CODIGO_EXTERNO actions sharing the same group must respect max=1', async () => {
            const EXTERNAL_CODE = `EXT-${uuidv4().substring(0, 8)}`;
            const { groupId } = await createWorkQueueGroup({ max_cases_per_user: 1 });
            await db('grupos').where({ id: groupId }).update({ codigo_externo: EXTERNAL_CODE });

            const advisor = await createActiveUser(groupId);
            const defaultAssignee = await UsersMother.createUserWithRole(usersRepository);

            const caseA = await createOpenCase(groupId, defaultAssignee.id.value);
            const caseB = await createOpenCase(groupId, defaultAssignee.id.value);

            const action1 = await ActionMother.create(actionRepository, {
                action_type: ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value,
                external_group_code: EXTERNAL_CODE,
                conditions: {},
            });
            const action2 = await ActionMother.create(actionRepository, {
                action_type: ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value,
                external_group_code: EXTERNAL_CODE,
                conditions: {},
            });

            const service = buildService({
                excludeUsersFromValidation: [advisor.id.value],
            });
            const result = await service.assign({ actions: [action1, action2] });

            const updatedA = await caseFinder.execute(caseA.id.value);
            const updatedB = await caseFinder.execute(caseB.id.value);
            const advisorCount = [updatedA, updatedB].filter((c) => c.responsable_id.value === advisor.id.value).length;

            expect(advisorCount).toBe(1);
            expect(result.assigned).toBe(1);
        });

        it('mixed action types targeting the same group must respect max=1', async () => {
            const EXTERNAL_CODE = `EXT-${uuidv4().substring(0, 8)}`;
            const { groupId } = await createWorkQueueGroup({ max_cases_per_user: 1 });
            await db('grupos').where({ id: groupId }).update({ codigo_externo: EXTERNAL_CODE });

            const advisor = await createActiveUser(groupId);
            const defaultAssignee = await UsersMother.createUserWithRole(usersRepository);

            const caseA = await createOpenCase(groupId, defaultAssignee.id.value);
            const caseB = await createOpenCase(groupId, defaultAssignee.id.value);

            const externalAction = await ActionMother.create(actionRepository, {
                action_type: ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value,
                external_group_code: EXTERNAL_CODE,
                conditions: {},
            });
            const enCursoAction = await ActionMother.create(actionRepository, {
                action_type: ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value,
                conditions: {},
            });

            const service = buildService({
                excludeUsersFromValidation: [advisor.id.value],
            });
            const result = await service.assign({ actions: [externalAction, enCursoAction] });

            const updatedA = await caseFinder.execute(caseA.id.value);
            const updatedB = await caseFinder.execute(caseB.id.value);
            const advisorCount = [updatedA, updatedB].filter((c) => c.responsable_id.value === advisor.id.value).length;

            expect(advisorCount).toBe(1);
            expect(result.assigned).toBe(1);
        });

        it('two actions sharing the same group must respect max=1 under PrioritizedAssignment', async () => {
            const EXTERNAL_CODE = `EXT-${uuidv4().substring(0, 8)}`;
            const { groupId } = await createWorkQueueGroup({
                max_cases_per_user: 1,
                assignLastResponsibleIgnoreDefault: true,
            });
            await db('grupos').where({ id: groupId }).update({ codigo_externo: EXTERNAL_CODE });

            const advisor = await createActiveUser(groupId);
            const defaultAssignee = await UsersMother.createUserWithRole(usersRepository);

            const caseA = await createOpenCase(groupId, defaultAssignee.id.value);
            const caseB = await createOpenCase(groupId, defaultAssignee.id.value);

            const action1 = await ActionMother.create(actionRepository, {
                action_type: ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value,
                external_group_code: EXTERNAL_CODE,
                conditions: {},
            });
            const action2 = await ActionMother.create(actionRepository, {
                action_type: ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value,
                external_group_code: EXTERNAL_CODE,
                conditions: {},
            });

            const service = buildService({
                excludeUsersFromValidation: [advisor.id.value],
            });
            const result = await service.assign({ actions: [action1, action2] });

            const updatedA = await caseFinder.execute(caseA.id.value);
            const updatedB = await caseFinder.execute(caseB.id.value);
            const advisorCount = [updatedA, updatedB].filter((c) => c.responsable_id.value === advisor.id.value).length;

            expect(advisorCount).toBe(1);
            expect(result.assigned).toBe(1);
        });
    });

    describe('edge cases', () => {
        it('returns zeroed result when there are no actions', async () => {
            const service = buildService();
            const result = await service.assign({ actions: [] });

            expect(result).toEqual({ assigned: 0, skipped: 0, errors: 0 });
        });

        it('skips inactive users when activeUsers_filter_bool is true', async () => {
            const { groupId } = await createWorkQueueGroup({ max_cases_per_user: 2 });

            const inactiveUser = await UsersMother.createUserWithRole(usersRepository, {
                is_active: StatusEnum.ACTIVE.value,
                grupo_activo: uuidv4(),
                last_seen_at: new Date(Date.now() - 3600000 * 24).toISOString(),
            });
            await UserGroupRelationshipMother.create(userGroupRelationshipRepository, {
                usuario_id: inactiveUser.id.value,
                grupo_id: groupId,
            });

            const defaultAssignee = await UsersMother.createUserWithRole(usersRepository);
            await createOpenCase(groupId, defaultAssignee.id.value);

            const action = await ActionMother.create(actionRepository, {
                action_type: ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value,
                conditions: {},
            });

            const service = buildService();
            const result = await service.assign({ actions: [action] });

            expect(result.assigned).toBe(0);
        });

        it('is resilient to errors in individual actions — continues processing', async () => {
            const { groupId } = await createWorkQueueGroup({ max_cases_per_user: 1 });
            const advisor = await createActiveUser(groupId);
            const defaultAssignee = await UsersMother.createUserWithRole(usersRepository);
            const kase = await createOpenCase(groupId, defaultAssignee.id.value);

            const badAction = await ActionMother.create(actionRepository, {
                action_type: ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value,
                external_group_code: 'NONEXISTENT',
                conditions: {},
            });

            const goodAction = await ActionMother.create(actionRepository, {
                action_type: ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value,
                conditions: {},
            });

            const service = buildService();
            const result = await service.assign({ actions: [badAction, goodAction] });

            expect(result.skipped).toBe(1);
            expect(result.assigned).toBe(1);

            const updatedCase = await caseFinder.execute(kase.id.value);
            expect(updatedCase.responsable_id.value).toBe(advisor.id.value);
        });
    });
});
