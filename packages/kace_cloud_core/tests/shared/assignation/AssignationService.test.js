import {
    AssignationsEnum,
    AssignationService,
    EquivalentAssignmentService,
    StatusEnum,
    WorkQueueService,
} from '../../../src/shared/index.js';
import { CASE_ASSIGNMENT_GROUP_UNAVAILABLE } from '@kace/error-codes';
import { GroupsMother } from '../../grupos/domain/GroupsMother.js';
import { KnexCaseRepository } from '../../../src/cases/index.js';
import { knexConfig } from '../../knexfile.js';
import { KnexGlobalConfigurationRepository } from '../../../src/global-config/index.js';
import { KnexGroupsRepository } from '../../../src/grupos/index.js';
import { KnexRoleRepository } from '../../../src/role/infrastructure/persistence/KnexRoleRepository.js';
import { KnexShiftManagementRepository } from '../../../src/shift-management/index.js';
import { KnexUserGroupRelationshipRepository } from '../../../src/user-group-relationships/index.js';
import { KnexUsersRepository } from '../../../src/users/index.js';
import { CaseUserAssigner } from '../../../src/cases/application/assign/CaseUserAssigner.js';
import CasesMother from '../../cases/domain/CasesMother.js';
import RoleMother from '../../role/domain/RoleMother.js';
import UserGroupRelationshipMother from '../../user-group-relationships/domain/UserGroupRelationshipMother.js';
import UsersMother from '../../users/domain/UsersMother.js';
import { GlobalConfigurationsMother } from '../../global-config/domain/GlobalConfigurationsMother.js';

describe('Assignation Tests', () => {
    const groupsRepository = new KnexGroupsRepository(knexConfig);
    const usersRepository = new KnexUsersRepository(groupsRepository.connection);
    const caseRepository = new KnexCaseRepository(groupsRepository.connection);
    const roleRepository = new KnexRoleRepository(groupsRepository.connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(groupsRepository.connection);
    const globalConfigurationRepository = new KnexGlobalConfigurationRepository(groupsRepository.connection);
    const userGroupRelationshipRepository = new KnexUserGroupRelationshipRepository(groupsRepository.connection);
    let grupoTest, role, usuario1, usuario2, usuario3;

    beforeEach(async () => {
        grupoTest = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
        role = await RoleMother.createRole(roleRepository, { descripcion: 'agente' });
        usuario1 = await UsersMother.createUser(usersRepository, { rol_id: role.id.value });
        usuario2 = await UsersMother.createUser(usersRepository, { rol_id: role.id.value });
        usuario3 = await UsersMother.createUser(usersRepository, { rol_id: role.id.value });

        await usersRepository.connection('usuarios').where({ id: usuario1.id.value }).update({
            last_seen_at: new Date().toISOString(),
            grupo_activo: grupoTest.id.value,
        });

        await usersRepository.connection('usuarios').where({ id: usuario2.id.value }).update({
            last_seen_at: new Date().toISOString(),
            grupo_activo: grupoTest.id.value,
        });

        await usersRepository.connection('usuarios').where({ id: usuario3.id.value }).update({
            last_seen_at: new Date().toISOString(),
            grupo_activo: grupoTest.id.value,
        });

        await UserGroupRelationshipMother.create(userGroupRelationshipRepository, {
            usuario_id: usuario1.id.value,
            grupo_id: grupoTest.id.value,
        });
        await UserGroupRelationshipMother.create(userGroupRelationshipRepository, {
            usuario_id: usuario2.id.value,
            grupo_id: grupoTest.id.value,
        });
        await UserGroupRelationshipMother.create(userGroupRelationshipRepository, {
            usuario_id: usuario3.id.value,
            grupo_id: grupoTest.id.value,
        });

        await CasesMother.createCase(caseRepository, {
            responsable_id: usuario1.id.value,
            grupo_id: grupoTest.id.value,
            created_at: new Date().toISOString(),
        });
        await CasesMother.createCase(caseRepository, {
            responsable_id: usuario2.id.value,
            grupo_id: grupoTest.id.value,
            created_at: new Date().toISOString(),
        });
        await CasesMother.createCase(caseRepository, {
            responsable_id: usuario3.id.value,
            grupo_id: grupoTest.id.value,
            created_at: new Date().toISOString(),
        });
    });

    describe('WorkQueueService', () => {
        it('should return the responsible person with the fewest cases', async () => {
            await CasesMother.createCase(caseRepository, {
                responsable_id: usuario1.id.value,
                grupo_id: grupoTest.id.value,
            });
            await CasesMother.createCase(caseRepository, {
                responsable_id: usuario2.id.value,
                grupo_id: grupoTest.id.value,
            });

            const workQueue = new WorkQueueService(usersRepository);
            const responsible = await workQueue.execute(grupoTest);

            expect(responsible).toBe(usuario3.id.value);
        });

        it('should return null if there are no users', async () => {
            const newGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
            const workQueueService = new WorkQueueService(usersRepository);
            const responsible = await workQueueService.execute(newGroup);

            expect(responsible).toBeNull();
        });

        it('should assign a supervisor if the group has permissions', async () => {
            grupoTest.comportamientos = { asignacionSupervisor: true };
            await groupsRepository.update(grupoTest);

            const supervisoryRole = await RoleMother.createRole(roleRepository, { descripcion: 'supervisor' });
            const supervisingUser = await UsersMother.createUser(usersRepository, { rol_id: supervisoryRole.id.value });
            await UserGroupRelationshipMother.create(userGroupRelationshipRepository, {
                usuario_id: supervisingUser.id.value,
                grupo_id: grupoTest.id.value,
            });

            const workQueueService = new WorkQueueService(usersRepository);
            const responsible = await workQueueService.execute(grupoTest);

            expect(responsible).toBe(supervisingUser.id.value);
        });

        it('should handle ties by selecting the user who connected first (oldest last_login_at)', async () => {
            await usersRepository
                .connection('usuarios')
                .where({ id: usuario1.id.value })
                .update({ last_login_at: new Date(Date.now() - 60 * 60000).toISOString() });
            await usersRepository
                .connection('usuarios')
                .where({ id: usuario2.id.value })
                .update({ last_login_at: new Date(Date.now() - 120 * 60000).toISOString() });
            await usersRepository
                .connection('usuarios')
                .where({ id: usuario3.id.value })
                .update({ last_login_at: new Date(Date.now() - 10 * 60000).toISOString() });

            const workQueueService = new WorkQueueService(usersRepository);
            const responsible = await workQueueService.execute(grupoTest);

            expect(responsible).toBe(usuario2.id.value);
        });

        it('should keep the first connected user as the candidate when a new user connects with the same case load', async () => {
            await usersRepository
                .connection('usuarios')
                .where({ id: usuario1.id.value })
                .update({ last_login_at: new Date(Date.now() - 60 * 60000).toISOString() });
            await usersRepository
                .connection('usuarios')
                .where({ id: usuario2.id.value })
                .update({ last_login_at: new Date(Date.now() - 120 * 60000).toISOString() });
            await usersRepository
                .connection('usuarios')
                .where({ id: usuario3.id.value })
                .update({ last_login_at: new Date(Date.now() - 10 * 60000).toISOString() });

            const workQueueService = new WorkQueueService(usersRepository);
            const before = await workQueueService.execute(grupoTest);

            const newUser = await UsersMother.createUser(usersRepository, { rol_id: role.id.value });
            await usersRepository.connection('usuarios').where({ id: newUser.id.value }).update({
                last_seen_at: new Date().toISOString(),
                grupo_activo: grupoTest.id.value,
                last_login_at: new Date().toISOString(),
            });
            await UserGroupRelationshipMother.create(userGroupRelationshipRepository, {
                usuario_id: newUser.id.value,
                grupo_id: grupoTest.id.value,
            });
            await CasesMother.createCase(caseRepository, {
                responsable_id: newUser.id.value,
                grupo_id: grupoTest.id.value,
                created_at: new Date().toISOString(),
            });

            const after = await workQueueService.execute(grupoTest);

            expect(before).toBe(usuario2.id.value);
            expect(after).toBe(usuario2.id.value);
        });

        it('should return last valid responsible from history', async () => {
            const targetCase = await CasesMother.createCase(caseRepository, {
                responsable_id: usuario3.id.value,
                grupo_id: grupoTest.id.value,
                created_at: new Date().toISOString(),
            });

            await usersRepository.connection('history_cases').insert([
                {
                    id: crypto.randomUUID(),
                    entity_id: targetCase.id.value,
                    changed_attributes: JSON.stringify({ responsable_id: usuario2.id.value }),
                    new_attributes: JSON.stringify({ responsable_id: usuario2.id.value }),
                    original_attributes: JSON.stringify({ responsable_id: usuario3.id.value }),
                    created_at: new Date(Date.now() - 60 * 1000).toISOString(),
                    created_by: usuario3.id.value,
                },
                {
                    id: crypto.randomUUID(),
                    entity_id: targetCase.id.value,
                    changed_attributes: JSON.stringify({ responsable_id: usuario1.id.value }),
                    new_attributes: JSON.stringify({ responsable_id: usuario1.id.value }),
                    original_attributes: JSON.stringify({ responsable_id: usuario2.id.value }),
                    created_at: new Date().toISOString(),
                    created_by: usuario3.id.value,
                },
            ]);

            const workQueueService = new WorkQueueService(usersRepository);
            const workQueueConfig = {
                assignLastResponsibleIgnoreDefault: true,
            };

            const responsible = await workQueueService.execute(grupoTest, workQueueConfig, targetCase.id.value);

            expect(responsible).toBe(usuario1.id.value);
        });

        it('should return the responsible person with the fewest cases when no history exists', async () => {
            await CasesMother.createCase(caseRepository, {
                responsable_id: usuario2.id.value,
                grupo_id: grupoTest.id.value,
                created_at: new Date().toISOString(),
            });
            await CasesMother.createCase(caseRepository, {
                responsable_id: usuario3.id.value,
                grupo_id: grupoTest.id.value,
                created_at: new Date().toISOString(),
            });

            const targetCase = await CasesMother.createCase(caseRepository, {
                responsable_id: usuario3.id.value,
                grupo_id: grupoTest.id.value,
                created_at: new Date().toISOString(),
            });

            await usersRepository.connection('history_cases').where({ entity_id: targetCase.id.value }).del();

            const workQueueService = new WorkQueueService(usersRepository);
            const responsible = await workQueueService.execute(
                grupoTest,
                { assignLastResponsibleIgnoreDefault: true },
                targetCase.id.value
            );

            expect(responsible).toBe(usuario1.id.value);
        });

        it('should skip DEFAULT_ASSIGNEE in history and prioritize previous non-default responsible', async () => {
            await usersRepository
                .connection('usuarios')
                .where({ id: usuario1.id.value })
                .update({
                    codigos_externos: JSON.stringify(['DEFAULT_ASSIGNEE']),
                });

            const targetCase = await CasesMother.createCase(caseRepository, {
                responsable_id: usuario3.id.value,
                grupo_id: grupoTest.id.value,
                created_at: new Date().toISOString(),
            });

            const caseUserAssigner = new CaseUserAssigner(caseRepository, usersRepository, groupsRepository, usuario3);
            await caseUserAssigner.execute(targetCase.id.value, grupoTest.id.value, usuario2.id.value);
            await caseUserAssigner.execute(targetCase.id.value, grupoTest.id.value, usuario1.id.value);

            const workQueueService = new WorkQueueService(usersRepository);
            const workQueueConfig = {
                assignLastResponsibleIgnoreDefault: true,
            };

            const responsible = await workQueueService.execute(grupoTest, workQueueConfig, targetCase.id.value);

            expect(responsible).toBe(usuario2.id.value);
        });

        it('should fall back to the normal work queue when the last history user is DEFAULT_ASSIGNEE', async () => {
            await usersRepository
                .connection('usuarios')
                .whereIn('id', [usuario1.id.value, usuario2.id.value])
                .update({
                    codigos_externos: JSON.stringify(['DEFAULT_ASSIGNEE']),
                });

            await CasesMother.createCase(caseRepository, {
                responsable_id: usuario2.id.value,
                grupo_id: grupoTest.id.value,
                created_at: new Date().toISOString(),
            });

            const targetCase = await CasesMother.createCase(caseRepository, {
                responsable_id: usuario3.id.value,
                grupo_id: grupoTest.id.value,
                created_at: new Date().toISOString(),
            });

            const caseUserAssigner = new CaseUserAssigner(caseRepository, usersRepository, groupsRepository, usuario3);
            await caseUserAssigner.execute(targetCase.id.value, grupoTest.id.value, usuario2.id.value);
            await caseUserAssigner.execute(targetCase.id.value, grupoTest.id.value, usuario1.id.value);

            const workQueueService = new WorkQueueService(usersRepository);
            const workQueueConfig = {
                assignLastResponsibleIgnoreDefault: true,
            };

            const responsible = await workQueueService.execute(grupoTest, workQueueConfig, targetCase.id.value);

            expect(responsible).toBe(usuario3.id.value);
        });

        it('should only count cases from the specific group when user belongs to multiple groups', async () => {
            const globalConfiguration =
                await GlobalConfigurationsMother.createWorkQueueConfig(globalConfigurationRepository);

            const grupoA = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository, {
                configuration_id: globalConfiguration.id.value,
            });

            const grupoB = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository, {
                configuration_id: globalConfiguration.id.value,
            });

            const usuarioMultigrupo1 = await UsersMother.createUser(usersRepository, {
                rol_id: role.id.value,
            });

            const usuarioMultigrupo2 = await UsersMother.createUser(usersRepository, {
                rol_id: role.id.value,
            });

            await usersRepository
                .connection('usuarios')
                .where({ id: usuarioMultigrupo1.id.value })
                .update({
                    grupo_activo: grupoA.id.value,
                    last_seen_at: new Date(Date.now() - 30000).toISOString(),
                    last_login_at: new Date(Date.now() - 40000).toISOString(),
                });

            await usersRepository
                .connection('usuarios')
                .where({ id: usuarioMultigrupo2.id.value })
                .update({
                    grupo_activo: grupoA.id.value,
                    last_seen_at: new Date(Date.now() - 30000).toISOString(),
                    last_login_at: new Date(Date.now() - 40000).toISOString(),
                });

            await UserGroupRelationshipMother.create(userGroupRelationshipRepository, {
                usuario_id: usuarioMultigrupo1.id.value,
                grupo_id: grupoA.id.value,
            });
            await UserGroupRelationshipMother.create(userGroupRelationshipRepository, {
                usuario_id: usuarioMultigrupo1.id.value,
                grupo_id: grupoB.id.value,
            });
            await UserGroupRelationshipMother.create(userGroupRelationshipRepository, {
                usuario_id: usuarioMultigrupo2.id.value,
                grupo_id: grupoA.id.value,
            });
            await UserGroupRelationshipMother.create(userGroupRelationshipRepository, {
                usuario_id: usuarioMultigrupo2.id.value,
                grupo_id: grupoB.id.value,
            });

            for (let i = 0; i < 3; i++) {
                await CasesMother.createCase(caseRepository, {
                    responsable_id: usuarioMultigrupo1.id.value,
                    grupo_id: grupoA.id.value,
                    created_at: new Date().toISOString(),
                });
            }

            for (let i = 0; i < 3; i++) {
                await CasesMother.createCase(caseRepository, {
                    responsable_id: usuarioMultigrupo2.id.value,
                    grupo_id: grupoB.id.value,
                    created_at: new Date().toISOString(),
                });
            }

            const workQueueService = new WorkQueueService(usersRepository);
            const workQueueConfig = {
                activeUsers_filter_bool: true,
                max_cases_per_user: 3,
                oldestLogin_filter_bool: true,
            };
            const responsible = await workQueueService.execute(grupoA, workQueueConfig);

            expect(responsible).toBe(usuarioMultigrupo2.id.value);
        });

        it('should respect max_cases_per_user limit per group independently', async () => {
            const globalConfiguration =
                await GlobalConfigurationsMother.createWorkQueueConfig(globalConfigurationRepository);

            const grupoA = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository, {
                configuration_id: globalConfiguration.id.value,
            });

            const grupoB = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository, {
                configuration_id: globalConfiguration.id.value,
            });

            const usuarioMultigrupo = await UsersMother.createUser(usersRepository, {
                rol_id: role.id.value,
            });

            await usersRepository
                .connection('usuarios')
                .where({ id: usuarioMultigrupo.id.value })
                .update({
                    grupo_activo: grupoB.id.value,
                    last_seen_at: new Date(Date.now() + 60000).toISOString(),
                    last_login_at: new Date().toISOString(),
                });

            await UserGroupRelationshipMother.create(userGroupRelationshipRepository, {
                usuario_id: usuarioMultigrupo.id.value,
                grupo_id: grupoA.id.value,
            });
            await UserGroupRelationshipMother.create(userGroupRelationshipRepository, {
                usuario_id: usuarioMultigrupo.id.value,
                grupo_id: grupoB.id.value,
            });

            for (let i = 0; i < 3; i++) {
                await CasesMother.createCase(caseRepository, {
                    responsable_id: usuarioMultigrupo.id.value,
                    grupo_id: grupoA.id.value,
                    created_at: new Date().toISOString(),
                });
            }

            for (let i = 0; i < 2; i++) {
                await CasesMother.createCase(caseRepository, {
                    responsable_id: usuarioMultigrupo.id.value,
                    grupo_id: grupoB.id.value,
                    created_at: new Date().toISOString(),
                });
            }

            const workQueueConfig = {
                activeUsers_filter_bool: true,
                max_cases_per_user: 3,
                oldestLogin_filter_bool: true,
            };

            const workQueueServiceA = new WorkQueueService(usersRepository);
            const responsibleA = await workQueueServiceA.execute(grupoA, workQueueConfig);
            expect(responsibleA).toBeNull();

            const workQueueServiceB = new WorkQueueService(usersRepository);
            const responsibleB = await workQueueServiceB.execute(grupoB, workQueueConfig);
            expect(responsibleB).toBe(usuarioMultigrupo.id.value);
        });
    });

    describe('EquivalentAssignmentService', () => {
        it('should return the first user with the "agente" role if no supervisor is required', async () => {
            const agenteUser = await UsersMother.createUser(usersRepository, { rol_id: role.id.value });
            await UserGroupRelationshipMother.create(userGroupRelationshipRepository, {
                usuario_id: agenteUser.id.value,
                grupo_id: grupoTest.id.value,
            });

            const equivalentAssignmentService = new EquivalentAssignmentService(usersRepository);
            const responsible = await equivalentAssignmentService.execute(grupoTest);

            expect(responsible).toBe(agenteUser.id.value);
        });

        it('should return null if no users are found for the group', async () => {
            const newGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

            const equivalentAssignmentService = new EquivalentAssignmentService(usersRepository);
            const responsible = await equivalentAssignmentService.execute(newGroup);

            expect(responsible).toBeNull();
        });

        it('should assign a supervisor if the group allows it', async () => {
            grupoTest.comportamientos = { asignacionSupervisor: true };
            await groupsRepository.update(grupoTest);

            const supervisorRole = await RoleMother.createRole(roleRepository, { descripcion: 'supervisor' });
            const supervisorUser = await UsersMother.createUser(usersRepository, { rol_id: supervisorRole.id.value });
            await UserGroupRelationshipMother.create(userGroupRelationshipRepository, {
                usuario_id: supervisorUser.id.value,
                grupo_id: grupoTest.id.value,
            });

            const equivalentAssignmentService = new EquivalentAssignmentService(usersRepository);
            const responsible = await equivalentAssignmentService.execute(grupoTest);

            expect(responsible).toBe(supervisorUser.id.value);
        });
    });

    describe('AssignationService', () => {
        const assignationService = new AssignationService(
            groupsRepository,
            globalConfigurationRepository,
            usersRepository
        );

        it('should execute WorkQueueService when the assignation type is COLA_DE_TRABAJO', async () => {
            grupoTest.comportamientos = { asignacion: AssignationsEnum.COLA_DE_TRABAJO.value };
            await groupsRepository.update(grupoTest);

            await CasesMother.createCase(caseRepository, {
                responsable_id: usuario1.id.value,
                grupo_id: grupoTest.id.value,
            });
            await CasesMother.createCase(caseRepository, {
                responsable_id: usuario2.id.value,
                grupo_id: grupoTest.id.value,
            });

            const responsible = await assignationService.execute(grupoTest.id.value);

            expect(responsible).toBeDefined();
            expect(responsible).toBe(usuario3.id.value);
        });

        it('should execute EquivalentAssignmentService when the assignation type is ASIGNACION_EQUIVALENTE', async () => {
            const newGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);

            newGroup.comportamientos = { asignacion: AssignationsEnum.ASIGNACION_EQUIVALENTE.value };
            await groupsRepository.update(newGroup);

            const agenteUser = await UsersMother.createUser(usersRepository, { rol_id: role.id.value });

            await UserGroupRelationshipMother.create(userGroupRelationshipRepository, {
                usuario_id: agenteUser.id.value,
                grupo_id: newGroup.id.value,
            });

            await usersRepository.connection('usuarios').where({ id: agenteUser.id.value }).update({
                last_seen_at: new Date().toISOString(),
                grupo_activo: newGroup.id.value,
            });

            const responsible = await assignationService.execute(newGroup.id.value);

            expect(responsible).toBeDefined();
            expect(responsible).toBe(agenteUser.id.value);
        });

        it('should throw when Global Configuration has an unsupported assignation type', async () => {
            const base = GlobalConfigurationsMother.settings;
            const invalidSettings = JSON.parse(JSON.stringify(base));

            if (!invalidSettings.behaviors) invalidSettings.behaviors = {};
            if (!invalidSettings.behaviors.application) invalidSettings.behaviors.application = {};
            if (!invalidSettings.behaviors.application.agente) invalidSettings.behaviors.application.agente = {};
            if (!invalidSettings.behaviors.application.agente.casos)
                invalidSettings.behaviors.application.agente.casos = {};

            invalidSettings.behaviors.application.agente.casos.type_assignment = 'NO_SOPORTED';

            const invalidConfig = await GlobalConfigurationsMother.createConfiguration(globalConfigurationRepository, {
                settings: invalidSettings,
            });

            grupoTest.configuration_id = invalidConfig.id.value;
            await groupsRepository.update(grupoTest);

            await expect(assignationService.execute(grupoTest.id.value)).rejects.toThrow(/Invalid value/);
        });
        it('should use global configuration if no assignation type is defined in the group', async () => {
            const result = await assignationService.execute(grupoTest.id.value);

            expect(result).toBeDefined();
        });

        it('should select the active user with less than three cases assigned when the assignation type is COLA_DE_TRABAJO', async () => {
            const globalConfiguration =
                await GlobalConfigurationsMother.createWorkQueueConfig(globalConfigurationRepository);

            grupoTest.configuration_id = globalConfiguration.id.value;
            await groupsRepository.update(grupoTest);

            usuario2.last_seen_at = new Date().toISOString();
            usuario2.grupo_activo = grupoTest.id.value;
            await usersRepository.update(usuario2);

            for (let cicles = 0; cicles < 4; cicles++) {
                await CasesMother.createCase(caseRepository, {
                    responsable_id: usuario1.id.value,
                    grupo_id: grupoTest.id.value,
                });

                await CasesMother.createCase(caseRepository, {
                    responsable_id: usuario3.id.value,
                    grupo_id: grupoTest.id.value,
                });
            }

            const responsible = await assignationService.execute(grupoTest.id.value);

            expect(responsible).toBeDefined();
            expect(responsible).toBe(usuario2.id.value);
        });

        it('should return null on execute when group is inactive (status = 2)', async () => {
            const inactiveGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
            inactiveGroup.status = StatusEnum.INACTIVE.value;
            await groupsRepository.update(inactiveGroup);

            const service = new AssignationService(groupsRepository, globalConfigurationRepository, usersRepository);
            const result = await service.execute(inactiveGroup.id.value);

            expect(result).toBeNull();
        });

        it('should throw CustomError with CASE_ASSIGNMENT_GROUP_UNAVAILABLE on executeOrFail when group is inactive', async () => {
            const inactiveGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
            inactiveGroup.status = StatusEnum.INACTIVE.value;
            await groupsRepository.update(inactiveGroup);

            const service = new AssignationService(groupsRepository, globalConfigurationRepository, usersRepository);

            await expect(service.executeOrFail(inactiveGroup.id.value)).rejects.toMatchObject({
                statusCode: 422,
                publicErrorCode: CASE_ASSIGNMENT_GROUP_UNAVAILABLE,
            });
        });

        it('should return null on execute when group is soft-deleted', async () => {
            const deletedGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
            deletedGroup.deleted_at = new Date().toISOString();
            deletedGroup.deleted_by = usuario1.id.value;
            await groupsRepository.update(deletedGroup);

            const service = new AssignationService(groupsRepository, globalConfigurationRepository, usersRepository);
            const result = await service.execute(deletedGroup.id.value);

            expect(result).toBeNull();
        });

        it('should throw CustomError with CASE_ASSIGNMENT_GROUP_UNAVAILABLE on executeOrFail when group is soft-deleted', async () => {
            const deletedGroup = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
            deletedGroup.deleted_at = new Date().toISOString();
            deletedGroup.deleted_by = usuario1.id.value;
            await groupsRepository.update(deletedGroup);

            const service = new AssignationService(groupsRepository, globalConfigurationRepository, usersRepository);

            await expect(service.executeOrFail(deletedGroup.id.value)).rejects.toMatchObject({
                statusCode: 422,
                publicErrorCode: CASE_ASSIGNMENT_GROUP_UNAVAILABLE,
            });
        });

        it('should return null on execute when group does not exist', async () => {
            const nonExistentGroupId = '00000000-0000-0000-0000-000000000000';
            const service = new AssignationService(groupsRepository, globalConfigurationRepository, usersRepository);
            const result = await service.execute(nonExistentGroupId);

            expect(result).toBeNull();
        });

        it('should throw CustomError with CASE_ASSIGNMENT_GROUP_UNAVAILABLE on executeOrFail when group does not exist', async () => {
            const nonExistentGroupId = '00000000-0000-0000-0000-000000000000';
            const service = new AssignationService(groupsRepository, globalConfigurationRepository, usersRepository);

            await expect(service.executeOrFail(nonExistentGroupId)).rejects.toMatchObject({
                statusCode: 422,
                publicErrorCode: CASE_ASSIGNMENT_GROUP_UNAVAILABLE,
            });
        });
    });
});
