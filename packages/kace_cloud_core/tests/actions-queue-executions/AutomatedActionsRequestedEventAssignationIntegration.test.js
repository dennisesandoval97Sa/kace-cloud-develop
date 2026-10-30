import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { DomainEvent } from '../../src/shared/domain/events/DomainEvent.js';
import { ActionTriggers } from '../../src/shared/domain/enum/ActionTriggersEnum.js';
import { AutomatedActionsRequested } from '../../src/actions-queue-executions/domain/events/AutomatedActionsRequested.js';
import { ProcessActionQueueOnCronJobRequested } from '../../src/actions-queue-executions/application/event-handlers/ProcessActionQueueOnCronJobRequested.js';
import { ActionQueueExecutor } from '../../src/actions-queue-executions/application/executor/ActionQueueExecutor.js';
import { KnexActionsQueueExecutionsRepository } from '../../src/actions-queue-executions/infrastructure/persistence/KnexActionsQueueExecutionsRepository.js';
import { KnexCaseRepository } from '../../src/cases/index.js';
import { CaseFinder } from '../../src/cases/domain/CaseFinder.js';
import { KnexActionRepository } from '../../src/actions/infrastructure/KnexActionRepository.js';
import { ActionTypes } from '../../src/actions/domain/ActionTypes.js';
import { KnexGlobalConfigurationRepository } from '../../src/global-config/index.js';
import { KnexGroupsRepository } from '../../src/grupos/index.js';
import { KnexRoleRepository } from '../../src/role/infrastructure/persistence/KnexRoleRepository.js';
import { KnexUserListsRepository } from '../../src/user-lists/index.js';
import { KnexShiftManagementRepository } from '../../src/shift-management/index.js';
import { KnexUserGroupRelationshipRepository } from '../../src/user-group-relationships/index.js';
import { KnexUsersRepository } from '../../src/users/index.js';
import { CaseFactory } from '../../src/factories/CaseFactory.js';
import ActionMother from '../actions/domain/ActionMother.js';
import UserListMother from '../user-lists/domain/UserListMother.js';
import { GlobalConfigurationsMother } from '../global-config/domain/GlobalConfigurationsMother.js';
import { GroupsMother } from '../grupos/domain/GroupsMother.js';
import RoleMother from '../role/domain/RoleMother.js';
import UserGroupRelationshipMother from '../user-group-relationships/domain/UserGroupRelationshipMother.js';
import UsersMother from '../users/domain/UsersMother.js';

describe('AutomatedActionsRequested -> Assignation integration', () => {
    const groupsRepository = new KnexGroupsRepository(knexConfig);
    const usersRepository = new KnexUsersRepository(groupsRepository.connection);
    const caseRepository = new KnexCaseRepository(groupsRepository.connection);
    const actionRepository = new KnexActionRepository(groupsRepository.connection);
    const roleRepository = new KnexRoleRepository(groupsRepository.connection);
    const userListRepository = new KnexUserListsRepository(groupsRepository.connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(groupsRepository.connection);
    const globalConfigurationRepository = new KnexGlobalConfigurationRepository(groupsRepository.connection);
    const userGroupRelationshipRepository = new KnexUserGroupRelationshipRepository(groupsRepository.connection);
    const queueExecutionsRepository = new KnexActionsQueueExecutionsRepository(groupsRepository.connection);
    const caseFinder = new CaseFinder(caseRepository);
    const caseFactory = new CaseFactory(knexConfig);

    it('should prioritize last non-default responsible from history when assignLastResponsibleIgnoreDefault is enabled', async () => {
        const baseSettings = JSON.parse(JSON.stringify(GlobalConfigurationsMother.settings));
        baseSettings.behaviors.application.agente.casos.type_assignment = 'cola_de_trabajo';
        baseSettings.behaviors.application.agente.casos.assignLastResponsibleIgnoreDefault = true;
        baseSettings.behaviors.application.agente.casos.max_cases_per_user = 1;
        baseSettings.behaviors.application.agente.casos.activeUsers_filter_bool = true;

        const globalConfiguration = await GlobalConfigurationsMother.createConfiguration(
            globalConfigurationRepository,
            {
                settings: baseSettings,
            }
        );

        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository, {
            configuration_id: globalConfiguration.id.value,
        });

        const role = await RoleMother.createRole(roleRepository, { descripcion: 'agente' });

        const now = new Date().toISOString();

        const currentAdvisor = await UsersMother.createUser(usersRepository, {
            grupo_activo: group.id.value,
            rol_id: role.id.value,
        });

        const historicalResponsible = await UsersMother.createUser(usersRepository, {
            grupo_activo: group.id.value,
            rol_id: role.id.value,
        });

        const fallbackResponsible = await UsersMother.createUser(usersRepository, {
            grupo_activo: group.id.value,
            rol_id: role.id.value,
        });

        const defaultResponsible = await UsersMother.createUser(usersRepository, {
            grupo_activo: group.id.value,
            rol_id: role.id.value,
        });

        await usersRepository
            .connection('usuarios')
            .where({ id: currentAdvisor.id.value })
            .update({
                last_seen_at: new Date(Date.now() - 3600000).toISOString(),
            });

        await usersRepository
            .connection('usuarios')
            .where({ id: historicalResponsible.id.value })
            .update({
                last_seen_at: now,
                last_login_at: new Date(Date.now() - 60000).toISOString(),
            });

        await usersRepository
            .connection('usuarios')
            .where({ id: fallbackResponsible.id.value })
            .update({
                last_seen_at: now,
                last_login_at: new Date(Date.now() - 10000).toISOString(),
            });

        await usersRepository
            .connection('usuarios')
            .where({ id: defaultResponsible.id.value })
            .update({
                codigos_externos: JSON.stringify(['DEFAULT_ASSIGNEE']),
                last_seen_at: now,
                last_login_at: new Date(Date.now() - 5000).toISOString(),
            });

        await UserGroupRelationshipMother.create(userGroupRelationshipRepository, {
            usuario_id: historicalResponsible.id.value,
            grupo_id: group.id.value,
        });
        await UserGroupRelationshipMother.create(userGroupRelationshipRepository, {
            usuario_id: fallbackResponsible.id.value,
            grupo_id: group.id.value,
        });
        await UserGroupRelationshipMother.create(userGroupRelationshipRepository, {
            usuario_id: defaultResponsible.id.value,
            grupo_id: group.id.value,
        });

        const advisorList = await UserListMother.createUserList(userListRepository, {
            group_id: group.id.value,
            lista_usuarios: [
                { id: historicalResponsible.id.value, name: historicalResponsible.nombres.value },
                { id: fallbackResponsible.id.value, name: fallbackResponsible.nombres.value },
                { id: defaultResponsible.id.value, name: defaultResponsible.nombres.value },
            ],
        });

        const firstCase = await caseFactory.create({
            responsable_id: currentAdvisor.id.value,
            created_by: currentAdvisor.id.value,
            updated_by: currentAdvisor.id.value,
            grupo_id: group.id.value,
            created_at: now,
        });

        const secondCase = await caseFactory.create({
            responsable_id: currentAdvisor.id.value,
            created_by: currentAdvisor.id.value,
            updated_by: currentAdvisor.id.value,
            grupo_id: group.id.value,
            created_at: now,
        });

        await usersRepository.connection('history_cases').insert([
            {
                id: uuidv4(),
                entity_id: firstCase.id.value,
                changed_attributes: JSON.stringify({ responsable_id: historicalResponsible.id.value }),
                new_attributes: JSON.stringify({ responsable_id: historicalResponsible.id.value }),
                original_attributes: JSON.stringify({ responsable_id: currentAdvisor.id.value }),
                created_at: new Date(Date.now() - 60000).toISOString(),
                created_by: currentAdvisor.id.value,
            },
            {
                id: uuidv4(),
                entity_id: firstCase.id.value,
                changed_attributes: JSON.stringify({ responsable_id: defaultResponsible.id.value }),
                new_attributes: JSON.stringify({ responsable_id: defaultResponsible.id.value }),
                original_attributes: JSON.stringify({ responsable_id: historicalResponsible.id.value }),
                created_at: now,
                created_by: currentAdvisor.id.value,
            },
        ]);

        const action = await ActionMother.create(actionRepository, {
            action_type: ActionTypes.ASIGNAR_LISTA_ASESORES.value,
            is_active: true,
            created_by: currentAdvisor.id.value,
            advisor_list_id: advisorList.id.value,
        });

        const executor = new ActionQueueExecutor(queueExecutionsRepository);
        const handler = new ProcessActionQueueOnCronJobRequested(executor);

        const emitEvent = (caseId, clientId) =>
            DomainEvent.fromJson(
                new AutomatedActionsRequested({
                    executionId: uuidv4(),
                    actionId: action.id.value,
                    caseId,
                    clientId,
                    triggerType: ActionTriggers.CRON_JOB.value,
                    metadata: {
                        tenant_id: 'tenant-test',
                        user_id: currentAdvisor.id.value,
                    },
                }).toJson()
            );

        await handler.handle(emitEvent(firstCase.id.value, firstCase.cliente_id.value));

        const updatedFirstCase = await caseFinder.execute(firstCase.id.value);
        expect(updatedFirstCase.responsable_id.value).not.toBe(defaultResponsible.id.value);
        expect(updatedFirstCase.responsable_id.value).toBe(historicalResponsible.id.value);

        await handler.handle(emitEvent(secondCase.id.value, secondCase.cliente_id.value));

        const updatedSecondCase = await caseFinder.execute(secondCase.id.value);
        expect(updatedSecondCase.responsable_id.value).not.toBe(historicalResponsible.id.value);
        expect(updatedSecondCase.responsable_id.value).toBe(fallbackResponsible.id.value);

        const thirdCase = await caseFactory.create({
            responsable_id: currentAdvisor.id.value,
            created_by: currentAdvisor.id.value,
            updated_by: currentAdvisor.id.value,
            grupo_id: group.id.value,
            created_at: now,
        });

        await handler.handle(emitEvent(thirdCase.id.value, thirdCase.cliente_id.value));

        const updatedThirdCase = await caseFinder.execute(thirdCase.id.value);
        expect(updatedThirdCase.responsable_id.value).not.toBe(historicalResponsible.id.value);
        expect(updatedThirdCase.responsable_id.value).not.toBe(fallbackResponsible.id.value);
        expect(updatedThirdCase.responsable_id.value).toBe(defaultResponsible.id.value);
    });
});
