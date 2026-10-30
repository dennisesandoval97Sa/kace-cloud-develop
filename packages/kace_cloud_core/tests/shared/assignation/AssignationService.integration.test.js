import { WorkQueueService } from '../../../src/shared/index.js';
import { GroupsMother } from '../../grupos/domain/GroupsMother.js';
import { KnexCaseRepository } from '../../../src/cases/index.js';
import { KnexGlobalConfigurationRepository } from '../../../src/global-config/index.js';
import { KnexGroupsRepository } from '../../../src/grupos/index.js';
import { KnexRoleRepository } from '../../../src/role/infrastructure/persistence/KnexRoleRepository.js';
import { KnexShiftManagementRepository } from '../../../src/shift-management/index.js';
import { KnexUserGroupRelationshipRepository } from '../../../src/user-group-relationships/index.js';
import { KnexUsersRepository } from '../../../src/users/index.js';
import CasesMother from '../../cases/domain/CasesMother.js';
import RoleMother from '../../role/domain/RoleMother.js';
import UserGroupRelationshipMother from '../../user-group-relationships/domain/UserGroupRelationshipMother.js';
import UsersMother from '../../users/domain/UsersMother.js';
import { GlobalConfigurationsMother } from '../../global-config/domain/GlobalConfigurationsMother.js';
import { knexConfig } from '../../knexfile.js';

describe('Assignation Tests', () => {
    let trx,
        groupsRepository,
        usersRepository,
        caseRepository,
        roleRepository,
        shiftManagementRepository,
        globalConfigurationRepository,
        userGroupRelationshipRepository;
    let grupoTest, role, usuario1, usuario2, usuario3;

    beforeEach(async () => {
        trx = await knexConfig.transaction();
        const trxProvider = () => trx;
        groupsRepository = new KnexGroupsRepository(trxProvider());
        usersRepository = new KnexUsersRepository(trxProvider());
        caseRepository = new KnexCaseRepository(trxProvider());
        roleRepository = new KnexRoleRepository(trxProvider());
        shiftManagementRepository = new KnexShiftManagementRepository(trxProvider());
        globalConfigurationRepository = new KnexGlobalConfigurationRepository(trxProvider());
        userGroupRelationshipRepository = new KnexUserGroupRelationshipRepository(trxProvider());

        grupoTest = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
        role = await RoleMother.createRole(roleRepository, { descripcion: 'agente' });
        usuario1 = await UsersMother.createUser(usersRepository, { rol_id: role.id.value });
        usuario2 = await UsersMother.createUser(usersRepository, { rol_id: role.id.value });
        usuario3 = await UsersMother.createUser(usersRepository, { rol_id: role.id.value });

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

    afterEach(async () => {
        await trx.rollback();
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
});
