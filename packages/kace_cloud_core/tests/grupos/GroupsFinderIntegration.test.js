import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { GroupFinderDomain as GroupsFinder, KnexGroupsRepository } from '../../src/grupos/index.js';
import { KnexShiftManagementRepository } from '../../src/shift-management/index.js';
import { KnexGlobalConfigurationRepository } from '../../src/global-config/index.js';
import { GlobalConfigurationsMother } from '../global-config/domain/GlobalConfigurationsMother.js';
import { StatusEnum } from '../../src/shared/domain/enum/StatusEnum.js';

const activeSessionDate = () => new Date(Date.now() + 60000).toISOString();
import { GroupsMother } from './domain/GroupsMother.js';
import { KnexCaseRepository } from '../../src/cases/index.js';
import CasesMother from '../cases/domain/CasesMother.js';
import ShiftManagementMother from '../shift-management/domain/ShiftManagementMother.js';
import { KnexUsersRepository } from '../../src/users/infrastructure/KnexUsersRepository.js';
import { KnexUserGroupRelationshipRepository } from '../../src/user-group-relationships/infrastructure/persistence/KnexUserGroupRelationshipRepository.js';
import UsersMother from '../users/domain/UsersMother.js';
import UserGroupRelationshipMother from '../user-group-relationships/domain/UserGroupRelationshipMother.js';
import { ensureParentRow } from '../support/ensureParentRow.js';

describe('GroupsFinder Integration Tests', () => {
    let repository;
    let finder;
    let repositoryShiftManagement;
    let globalConfigRepository;
    let caseRepository;
    let userRepository;
    let relUserRepository;
    let ownGroupIds;

    beforeEach(async () => {
        repository = new KnexGroupsRepository(knexConfig);
        finder = new GroupsFinder(repository);
        repositoryShiftManagement = new KnexShiftManagementRepository(repository.connection);
        globalConfigRepository = new KnexGlobalConfigurationRepository(repository.connection);
        caseRepository = new KnexCaseRepository(repository.connection);
        userRepository = new KnexUsersRepository(repository.connection);
        relUserRepository = new KnexUserGroupRelationshipRepository(repository.connection);
        ownGroupIds = [];
    });

    /**
     * Registra el grupo sembrado para que `findWorkQueueGroupsWithCapacity` de mas abajo pueda
     * descartar los que no son de este `it`.
     */
    const createGroup = async (shiftManagement, config) => {
        const group = await GroupsMother.createWithCustomShiftManagementAndConfig(repository, shiftManagement, config);

        ownGroupIds.push(group.id.value);

        return group;
    };

    /**
     * `GroupFinderDomain.findWorkQueueGroupsWithCapacity` devuelve TODOS los grupos de cola de
     * trabajo que haya en la base, y cada `it` de este archivo daba por hecho que ahi solo
     * estaban los suyos. No siempre es cierto: el reset de `perFileDatabase` se salta el
     * TRUNCATE cuando postgres aun no ha publicado las estadisticas de escritura del `it`
     * anterior -las vuelca como muy pronto un segundo despues de la escritura-, asi que tras un
     * `it` rapido los grupos del anterior siguen en pie y las aserciones de longitud cuentan de
     * mas. Se filtra por los grupos que sembro el propio `it`, que es de lo unico que hablan sus
     * aserciones.
     */
    const findWorkQueueGroupsWithCapacity = async () => {
        const groups = await finder.findWorkQueueGroupsWithCapacity();

        return groups.filter((group) => ownGroupIds.includes(group.grupo_id));
    };

    it('should return exact capacity when active users and open cases are present', async () => {
        const config = await GlobalConfigurationsMother.createWorkQueueConfig(globalConfigRepository);

        const shiftManagement = await ShiftManagementMother.createShiftManagement(repositoryShiftManagement);
        const group = await createGroup(shiftManagement, config);
        const groupId = group.id.value;

        const user1 = await UsersMother.createUserWithRole(userRepository, {
            is_active: StatusEnum.ACTIVE.value,
            grupo_activo: groupId,
            last_seen_at: activeSessionDate(),
        });
        const user2 = await UsersMother.createUserWithRole(userRepository, {
            is_active: StatusEnum.ACTIVE.value,
            grupo_activo: groupId,
            last_seen_at: activeSessionDate(),
        });
        await UserGroupRelationshipMother.create(relUserRepository, { usuario_id: user1.id.value, grupo_id: groupId });
        await UserGroupRelationshipMother.create(relUserRepository, { usuario_id: user2.id.value, grupo_id: groupId });

        await CasesMother.createCase(caseRepository, { grupo_id: groupId, responsable_id: user1.id.value });

        const groupsWithCapacity = await findWorkQueueGroupsWithCapacity();

        expect(groupsWithCapacity).toHaveLength(1);
        const groupCapacity = groupsWithCapacity[0];

        expect(groupCapacity.grupo_id).toBe(groupId);
        expect(groupCapacity.type_assignment).toBe('cola_de_trabajo');

        expect(groupCapacity.capacidad).toBe(5);
        expect(groupCapacity.max_cases_per_user).toBeDefined();
        expect(groupCapacity.activeUsers_filter_bool).toBe(true);
    });

    it('should assign full per-user capacity when active users have no open assigned cases', async () => {
        const config = await GlobalConfigurationsMother.createWorkQueueConfig(globalConfigRepository);

        const shiftManagement = await ShiftManagementMother.createShiftManagement(repositoryShiftManagement);
        const group = await createGroup(shiftManagement, config);
        const groupId = group.id.value;

        const user1 = await UsersMother.createUserWithRole(userRepository, {
            is_active: StatusEnum.ACTIVE.value,
            grupo_activo: groupId,
            last_seen_at: activeSessionDate(),
        });
        const user2 = await UsersMother.createUserWithRole(userRepository, {
            is_active: StatusEnum.ACTIVE.value,
            grupo_activo: groupId,
            last_seen_at: activeSessionDate(),
        });
        await UserGroupRelationshipMother.create(relUserRepository, { usuario_id: user1.id.value, grupo_id: groupId });
        await UserGroupRelationshipMother.create(relUserRepository, { usuario_id: user2.id.value, grupo_id: groupId });

        const groupsWithCapacity = await findWorkQueueGroupsWithCapacity();

        expect(groupsWithCapacity).toHaveLength(1);
        // Default work queue test config uses max_cases_per_user = 3
        expect(groupsWithCapacity[0].capacidad).toBe(6);
    });

    it('should order users by connection order (oldest last_login_at first) when open cases are tied', async () => {
        const config = await GlobalConfigurationsMother.createWorkQueueConfig(globalConfigRepository);

        const shiftManagement = await ShiftManagementMother.createShiftManagement(repositoryShiftManagement);
        const group = await createGroup(shiftManagement, config);
        const groupId = group.id.value;

        const loginAt = (minutesAgo) => new Date(Date.now() - minutesAgo * 60000).toISOString();
        const createConnectedUser = (last_login_at) =>
            UsersMother.createUserWithRole(userRepository, {
                is_active: StatusEnum.ACTIVE.value,
                grupo_activo: groupId,
                last_seen_at: activeSessionDate(),
                last_login_at,
            });

        // Inserted in reverse connection order so row order cannot mask the sort.
        const newestUser = await createConnectedUser(loginAt(10));
        const middleUser = await createConnectedUser(loginAt(60));
        const firstUser = await createConnectedUser(loginAt(120));

        for (const user of [newestUser, middleUser, firstUser]) {
            await UserGroupRelationshipMother.create(relUserRepository, {
                usuario_id: user.id.value,
                grupo_id: groupId,
            });
        }

        const groupsWithCapacity = await findWorkQueueGroupsWithCapacity();

        expect(groupsWithCapacity).toHaveLength(1);
        expect(groupsWithCapacity[0].users.map((u) => u.id)).toEqual([
            firstUser.id.value,
            middleUser.id.value,
            newestUser.id.value,
        ]);
    });

    it('should order users by fewest open cases first and break ties by connection order', async () => {
        const config = await GlobalConfigurationsMother.createWorkQueueConfig(globalConfigRepository);

        const shiftManagement = await ShiftManagementMother.createShiftManagement(repositoryShiftManagement);
        const group = await createGroup(shiftManagement, config);
        const groupId = group.id.value;

        const loginAt = (minutesAgo) => new Date(Date.now() - minutesAgo * 60000).toISOString();
        const createConnectedUser = (last_login_at) =>
            UsersMother.createUserWithRole(userRepository, {
                is_active: StatusEnum.ACTIVE.value,
                grupo_activo: groupId,
                last_seen_at: activeSessionDate(),
                last_login_at,
            });

        const loadedFirstUser = await createConnectedUser(loginAt(120));
        const tiedOldUser = await createConnectedUser(loginAt(90));
        const tiedNewUser = await createConnectedUser(loginAt(10));

        for (const user of [loadedFirstUser, tiedOldUser, tiedNewUser]) {
            await UserGroupRelationshipMother.create(relUserRepository, {
                usuario_id: user.id.value,
                grupo_id: groupId,
            });
        }

        await CasesMother.createCase(caseRepository, { grupo_id: groupId, responsable_id: loadedFirstUser.id.value });
        await CasesMother.createCase(caseRepository, { grupo_id: groupId, responsable_id: loadedFirstUser.id.value });
        await CasesMother.createCase(caseRepository, { grupo_id: groupId, responsable_id: tiedOldUser.id.value });
        await CasesMother.createCase(caseRepository, { grupo_id: groupId, responsable_id: tiedNewUser.id.value });

        const groupsWithCapacity = await findWorkQueueGroupsWithCapacity();

        expect(groupsWithCapacity).toHaveLength(1);
        expect(groupsWithCapacity[0].users.map((u) => u.id)).toEqual([
            tiedOldUser.id.value,
            tiedNewUser.id.value,
            loadedFirstUser.id.value,
        ]);
    });

    it('should place users without last_login_at at the end of the queue', async () => {
        const config = await GlobalConfigurationsMother.createWorkQueueConfig(globalConfigRepository);

        const shiftManagement = await ShiftManagementMother.createShiftManagement(repositoryShiftManagement);
        const group = await createGroup(shiftManagement, config);
        const groupId = group.id.value;

        const neverLoggedUser = await UsersMother.createUserWithRole(userRepository, {
            is_active: StatusEnum.ACTIVE.value,
            grupo_activo: groupId,
            last_seen_at: activeSessionDate(),
            last_login_at: null,
        });
        const connectedUser = await UsersMother.createUserWithRole(userRepository, {
            is_active: StatusEnum.ACTIVE.value,
            grupo_activo: groupId,
            last_seen_at: activeSessionDate(),
            last_login_at: new Date(Date.now() - 60000).toISOString(),
        });

        for (const user of [neverLoggedUser, connectedUser]) {
            await UserGroupRelationshipMother.create(relUserRepository, {
                usuario_id: user.id.value,
                grupo_id: groupId,
            });
        }

        const groupsWithCapacity = await findWorkQueueGroupsWithCapacity();

        expect(groupsWithCapacity).toHaveLength(1);
        expect(groupsWithCapacity[0].users.map((u) => u.id)).toEqual([
            connectedUser.id.value,
            neverLoggedUser.id.value,
        ]);
    });

    it('returns empty array if no groups use cola_de_trabajo configuration', async () => {
        const baseSettings = GlobalConfigurationsMother.settings;
        const fallbackSettings = JSON.parse(JSON.stringify(baseSettings));
        fallbackSettings.behaviors.application.agente.casos.type_assignment = 'asignacion_equivalente';

        const config = await GlobalConfigurationsMother.createConfiguration(globalConfigRepository, {
            settings: fallbackSettings,
        });

        const shiftManagement = await ShiftManagementMother.createShiftManagement(repositoryShiftManagement);
        await createGroup(shiftManagement, config);

        const groupsWithCapacity = await findWorkQueueGroupsWithCapacity();
        expect(groupsWithCapacity).toHaveLength(0);
    });

    it('should return zero when open cases exceed available capacity', async () => {
        const config = await GlobalConfigurationsMother.createWorkQueueConfig(globalConfigRepository);
        const shiftManagement = await ShiftManagementMother.createShiftManagement(repositoryShiftManagement);
        const group = await createGroup(shiftManagement, config);
        const groupId = group.id.value;

        const user1 = await UsersMother.createUserWithRole(userRepository, {
            is_active: StatusEnum.ACTIVE.value,
            grupo_activo: groupId,
            last_seen_at: activeSessionDate(),
        });
        await UserGroupRelationshipMother.create(relUserRepository, { usuario_id: user1.id.value, grupo_id: groupId });

        for (let i = 0; i < 6; i++) {
            await CasesMother.createCase(caseRepository, { grupo_id: groupId, responsable_id: user1.id.value });
        }

        const groupsWithCapacity = await findWorkQueueGroupsWithCapacity();
        expect(groupsWithCapacity).toHaveLength(1);
        expect(groupsWithCapacity[0].capacidad).toBe(0);
        // El usuario sigue disponible (sesión activa) aunque saturado: sin cupo restante.
        expect(groupsWithCapacity[0].users_available).toBe(1);
        expect(groupsWithCapacity[0].users).toHaveLength(0);
    });

    it('should ignore inactive users when calculating capacity', async () => {
        const config = await GlobalConfigurationsMother.createWorkQueueConfig(globalConfigRepository);
        const shiftManagement = await ShiftManagementMother.createShiftManagement(repositoryShiftManagement);
        const group = await createGroup(shiftManagement, config);
        const groupId = group.id.value;

        const user1 = await UsersMother.createUserWithRole(userRepository, {
            is_active: StatusEnum.ACTIVE.value,
            grupo_activo: groupId,
            last_seen_at: activeSessionDate(),
        });
        const user2 = await UsersMother.createUserWithRole(userRepository, {
            is_active: StatusEnum.INACTIVE.value,
            grupo_activo: groupId,
            last_seen_at: activeSessionDate(),
        });

        await UserGroupRelationshipMother.create(relUserRepository, { usuario_id: user1.id.value, grupo_id: groupId });
        await UserGroupRelationshipMother.create(relUserRepository, { usuario_id: user2.id.value, grupo_id: groupId });

        const groupsWithCapacity = await findWorkQueueGroupsWithCapacity();
        expect(groupsWithCapacity).toHaveLength(1);
        expect(groupsWithCapacity[0].capacidad).toBe(3);
    });

    it('reports users_total with every active member even when they have no capacity', async () => {
        const config = await GlobalConfigurationsMother.createWorkQueueConfig(globalConfigRepository);
        const shiftManagement = await ShiftManagementMother.createShiftManagement(repositoryShiftManagement);
        const group = await createGroup(shiftManagement, config);
        const groupId = group.id.value;

        const oldDate = new Date(Date.now() - 1000 * 60 * 10).toISOString();

        const activeUser = await UsersMother.createUserWithRole(userRepository, {
            is_active: StatusEnum.ACTIVE.value,
            grupo_activo: groupId,
            last_seen_at: activeSessionDate(),
        });
        const expiredUser = await UsersMother.createUserWithRole(userRepository, {
            is_active: StatusEnum.ACTIVE.value,
            grupo_activo: groupId,
            last_seen_at: oldDate,
        });
        const inactiveUser = await UsersMother.createUserWithRole(userRepository, {
            is_active: StatusEnum.INACTIVE.value,
            grupo_activo: groupId,
            last_seen_at: activeSessionDate(),
        });
        for (const user of [activeUser, expiredUser, inactiveUser]) {
            await UserGroupRelationshipMother.create(relUserRepository, {
                usuario_id: user.id.value,
                grupo_id: groupId,
            });
        }

        const groupsWithCapacity = await findWorkQueueGroupsWithCapacity();

        expect(groupsWithCapacity).toHaveLength(1);
        // users_total = miembros activos del sistema (incluye al de sesión expirada, excluye al inactivo)
        expect(groupsWithCapacity[0].users_total).toBe(2);
        // users_available = pasan el filtro de sesión (solo el de sesión vigente)
        expect(groupsWithCapacity[0].users_available).toBe(1);
        expect(groupsWithCapacity[0].users).toHaveLength(1);
        expect(groupsWithCapacity[0].users[0].id).toBe(activeUser.id.value);
    });

    it('should ignore users with expired session when activeUsers_filter_bool is true', async () => {
        const config = await GlobalConfigurationsMother.createWorkQueueConfig(globalConfigRepository);
        const shiftManagement = await ShiftManagementMother.createShiftManagement(repositoryShiftManagement);
        const group = await createGroup(shiftManagement, config);
        const groupId = group.id.value;

        const oldDate = new Date(Date.now() - 1000 * 60 * 10).toISOString();

        const user1 = await UsersMother.createUserWithRole(userRepository, {
            is_active: StatusEnum.ACTIVE.value,
            grupo_activo: groupId,
            last_seen_at: oldDate,
        });
        await UserGroupRelationshipMother.create(relUserRepository, { usuario_id: user1.id.value, grupo_id: groupId });

        const groupsWithCapacity = await findWorkQueueGroupsWithCapacity();
        expect(groupsWithCapacity).toHaveLength(1);
        expect(groupsWithCapacity[0].capacidad).toBe(0);
    });

    it('should ignore users with stale integration activity when activeUsers_filter_integration_bool is true', async () => {
        const baseSettings = GlobalConfigurationsMother.settings;
        const testSettings = JSON.parse(JSON.stringify(baseSettings));
        testSettings.behaviors.application.agente.casos.type_assignment = 'cola_de_trabajo';
        testSettings.behaviors.application.agente.casos.activeUsers_filter_bool = false;
        testSettings.behaviors.application.agente.casos.activeUsers_filter_integration_bool = true;
        testSettings.behaviors.application.agente.casos.max_cases_per_user = '3';

        const config = await GlobalConfigurationsMother.createConfiguration(globalConfigRepository, {
            settings: testSettings,
        });
        const shiftManagement = await ShiftManagementMother.createShiftManagement(repositoryShiftManagement);
        const group = await createGroup(shiftManagement, config);
        const groupId = group.id.value;

        const staleIntegrationDate = new Date(Date.now() - 1000 * 60 * 10).toISOString();

        const user1 = await UsersMother.createUserWithRole(userRepository, {
            is_active: StatusEnum.ACTIVE.value,
            grupo_activo: groupId,
            last_seen_at: activeSessionDate(),
            last_integration_active_at: staleIntegrationDate,
        });

        await UserGroupRelationshipMother.create(relUserRepository, {
            usuario_id: user1.id.value,
            grupo_id: groupId,
        });

        const groupsWithCapacity = await findWorkQueueGroupsWithCapacity();
        expect(groupsWithCapacity).toHaveLength(1);
        expect(groupsWithCapacity[0].activeUsers_filter_integration_bool).toBe(true);
        expect(groupsWithCapacity[0].capacidad).toBe(0);
        expect(groupsWithCapacity[0].users).toHaveLength(0);
    });

    it('should require both session and integration activity when both filters are enabled', async () => {
        const baseSettings = GlobalConfigurationsMother.settings;
        const testSettings = JSON.parse(JSON.stringify(baseSettings));
        testSettings.behaviors.application.agente.casos.type_assignment = 'cola_de_trabajo';
        testSettings.behaviors.application.agente.casos.activeUsers_filter_bool = true;
        testSettings.behaviors.application.agente.casos.activeUsers_filter_integration_bool = true;
        testSettings.behaviors.application.agente.casos.max_cases_per_user = '3';

        const config = await GlobalConfigurationsMother.createConfiguration(globalConfigRepository, {
            settings: testSettings,
        });
        const shiftManagement = await ShiftManagementMother.createShiftManagement(repositoryShiftManagement);
        const group = await createGroup(shiftManagement, config);
        const groupId = group.id.value;

        const staleIntegrationDate = new Date(Date.now() - 1000 * 60 * 10).toISOString();
        const oldSessionDate = new Date(Date.now() - 1000 * 60 * 10).toISOString();

        const fullyEligibleUser = await UsersMother.createUserWithRole(userRepository, {
            is_active: StatusEnum.ACTIVE.value,
            grupo_activo: groupId,
            last_seen_at: activeSessionDate(),
            last_integration_active_at: activeSessionDate(),
        });

        const staleIntegrationUser = await UsersMother.createUserWithRole(userRepository, {
            is_active: StatusEnum.ACTIVE.value,
            grupo_activo: groupId,
            last_seen_at: activeSessionDate(),
            last_integration_active_at: staleIntegrationDate,
        });

        const staleSessionUser = await UsersMother.createUserWithRole(userRepository, {
            is_active: StatusEnum.ACTIVE.value,
            grupo_activo: groupId,
            last_seen_at: oldSessionDate,
            last_integration_active_at: activeSessionDate(),
        });

        await UserGroupRelationshipMother.create(relUserRepository, {
            usuario_id: fullyEligibleUser.id.value,
            grupo_id: groupId,
        });
        await UserGroupRelationshipMother.create(relUserRepository, {
            usuario_id: staleIntegrationUser.id.value,
            grupo_id: groupId,
        });
        await UserGroupRelationshipMother.create(relUserRepository, {
            usuario_id: staleSessionUser.id.value,
            grupo_id: groupId,
        });

        const groupsWithCapacity = await findWorkQueueGroupsWithCapacity();
        expect(groupsWithCapacity).toHaveLength(1);
        expect(groupsWithCapacity[0].capacidad).toBe(3);
        expect(groupsWithCapacity[0].users).toHaveLength(1);
        expect(groupsWithCapacity[0].users[0].id).toBe(fullyEligibleUser.id.value);
    });

    it('should return zero when max_cases_per_user is defined but there are no active users', async () => {
        const baseSettings = GlobalConfigurationsMother.settings;
        const testSettings = JSON.parse(JSON.stringify(baseSettings));
        testSettings.behaviors.application.agente.casos.type_assignment = 'cola_de_trabajo';
        testSettings.behaviors.application.agente.casos.activeUsers_filter_bool = false;
        testSettings.behaviors.application.agente.casos.max_cases_per_user = '5';

        const config = await GlobalConfigurationsMother.createConfiguration(globalConfigRepository, {
            settings: testSettings,
        });
        const shiftManagement = await ShiftManagementMother.createShiftManagement(repositoryShiftManagement);
        const group = await createGroup(shiftManagement, config);
        const groupId = group.id.value;

        const oldDate = new Date(Date.now() - 1000 * 60 * 10).toISOString();
        const user1 = await UsersMother.createUserWithRole(userRepository, {
            is_active: StatusEnum.INACTIVE.value,
            grupo_activo: groupId,
            last_seen_at: oldDate,
        });
        const user2 = await UsersMother.createUserWithRole(userRepository, {
            is_active: StatusEnum.INACTIVE.value,
            grupo_activo: groupId,
            last_seen_at: oldDate,
        });
        const user3 = await UsersMother.createUserWithRole(userRepository, {
            is_active: StatusEnum.INACTIVE.value,
            grupo_activo: groupId,
            last_seen_at: activeSessionDate(),
        });

        await UserGroupRelationshipMother.create(relUserRepository, { usuario_id: user1.id.value, grupo_id: groupId });
        await UserGroupRelationshipMother.create(relUserRepository, { usuario_id: user2.id.value, grupo_id: groupId });
        await UserGroupRelationshipMother.create(relUserRepository, { usuario_id: user3.id.value, grupo_id: groupId });

        for (let i = 0; i < 4; i++) {
            await CasesMother.createCase(caseRepository, {
                grupo_id: groupId,
                responsable_id: user1.id.value,
            });
        }

        const groupsWithCapacity = await findWorkQueueGroupsWithCapacity();
        expect(groupsWithCapacity).toHaveLength(1);
        expect(groupsWithCapacity[0].capacidad).toBe(0);
    });

    it('should return zero capacity when max_cases_per_user is 0', async () => {
        const baseSettings = GlobalConfigurationsMother.settings;
        const testSettings = JSON.parse(JSON.stringify(baseSettings));
        testSettings.behaviors.application.agente.casos.type_assignment = 'cola_de_trabajo';
        testSettings.behaviors.application.agente.casos.activeUsers_filter_bool = true;
        testSettings.behaviors.application.agente.casos.max_cases_per_user = '0';

        const config = await GlobalConfigurationsMother.createConfiguration(globalConfigRepository, {
            settings: testSettings,
        });
        const shiftManagement = await ShiftManagementMother.createShiftManagement(repositoryShiftManagement);
        const group = await createGroup(shiftManagement, config);
        const groupId = group.id.value;

        const user1 = await UsersMother.createUserWithRole(userRepository, {
            is_active: StatusEnum.ACTIVE.value,
            grupo_activo: groupId,
            last_seen_at: activeSessionDate(),
        });
        await UserGroupRelationshipMother.create(relUserRepository, { usuario_id: user1.id.value, grupo_id: groupId });

        const groupsWithCapacity = await findWorkQueueGroupsWithCapacity();
        expect(groupsWithCapacity).toHaveLength(1);
        expect(groupsWithCapacity[0].capacidad).toBe(0);
    });

    it('should ignore users whose grupo_activo does not match when activeUsers_filter_bool is true', async () => {
        const config = await GlobalConfigurationsMother.createWorkQueueConfig(globalConfigRepository);
        const shiftManagement = await ShiftManagementMother.createShiftManagement(repositoryShiftManagement);
        const group = await createGroup(shiftManagement, config);
        const groupId = group.id.value;
        const otherGroupId = uuidv4();
        await ensureParentRow(repository.connection, 'grupos', otherGroupId);

        const user1 = await UsersMother.createUserWithRole(userRepository, {
            is_active: StatusEnum.ACTIVE.value,
            grupo_activo: otherGroupId,
            last_seen_at: activeSessionDate(),
        });
        await UserGroupRelationshipMother.create(relUserRepository, { usuario_id: user1.id.value, grupo_id: groupId });

        const groupsWithCapacity = await findWorkQueueGroupsWithCapacity();
        expect(groupsWithCapacity).toHaveLength(1);
        expect(groupsWithCapacity[0].capacidad).toBe(0);
    });

    it('should return Infinity when hasActiveUsersFilter is true and hasMaxCases is false and there are active users', async () => {
        const baseSettings = GlobalConfigurationsMother.settings;
        const testSettings = JSON.parse(JSON.stringify(baseSettings));
        testSettings.behaviors.application.agente.casos.type_assignment = 'cola_de_trabajo';
        testSettings.behaviors.application.agente.casos.activeUsers_filter_bool = true;
        testSettings.behaviors.application.agente.casos.max_cases_per_user = null;

        const config = await GlobalConfigurationsMother.createConfiguration(globalConfigRepository, {
            settings: testSettings,
        });
        const shiftManagement = await ShiftManagementMother.createShiftManagement(repositoryShiftManagement);
        const group = await createGroup(shiftManagement, config);
        const groupId = group.id.value;

        const user1 = await UsersMother.createUserWithRole(userRepository, {
            is_active: StatusEnum.ACTIVE.value,
            grupo_activo: groupId,
            last_seen_at: activeSessionDate(),
        });
        const user2 = await UsersMother.createUserWithRole(userRepository, {
            is_active: StatusEnum.ACTIVE.value,
            grupo_activo: groupId,
            last_seen_at: activeSessionDate(),
        });
        await UserGroupRelationshipMother.create(relUserRepository, { usuario_id: user1.id.value, grupo_id: groupId });
        await UserGroupRelationshipMother.create(relUserRepository, { usuario_id: user2.id.value, grupo_id: groupId });

        const groupsWithCapacity = await findWorkQueueGroupsWithCapacity();
        expect(groupsWithCapacity).toHaveLength(1);
        expect(groupsWithCapacity[0].capacidad).toBe(Infinity);

        expect(groupsWithCapacity[0].users).toBeDefined();
        expect(groupsWithCapacity[0].users).toHaveLength(2);

        const u1 = groupsWithCapacity[0].users.find((u) => u.id === user1.id.value);
        expect(u1).toBeDefined();
        expect(u1.remaining).toBe(Infinity);

        const u2 = groupsWithCapacity[0].users.find((u) => u.id === user2.id.value);
        expect(u2).toBeDefined();
        expect(u2.remaining).toBe(Infinity);
    });

    it('should not return groups without capacity rules (no max_cases, no activeUsersFilter)', async () => {
        const baseSettings = GlobalConfigurationsMother.settings;
        const testSettings = JSON.parse(JSON.stringify(baseSettings));
        testSettings.behaviors.application.agente.casos.type_assignment = 'cola_de_trabajo';
        testSettings.behaviors.application.agente.casos.activeUsers_filter_bool = false;
        testSettings.behaviors.application.agente.casos.max_cases_per_user = null;

        const config = await GlobalConfigurationsMother.createConfiguration(globalConfigRepository, {
            settings: testSettings,
        });
        const shiftManagement = await ShiftManagementMother.createShiftManagement(repositoryShiftManagement);
        await createGroup(shiftManagement, config);

        const groupsWithCapacity = await findWorkQueueGroupsWithCapacity();
        expect(groupsWithCapacity).toHaveLength(0);
    });

    it('should return zero capacity for a work queue group without users', async () => {
        const config = await GlobalConfigurationsMother.createWorkQueueConfig(globalConfigRepository);
        const shiftManagement = await ShiftManagementMother.createShiftManagement(repositoryShiftManagement);
        const group = await createGroup(shiftManagement, config);

        const groupsWithCapacity = await findWorkQueueGroupsWithCapacity();
        expect(groupsWithCapacity).toHaveLength(1);

        const capacity = groupsWithCapacity.find((g) => g.grupo_id === group.id.value)?.capacidad;
        expect(capacity).toBe(0);
    });

    it('should only deduct open cases from the correct group', async () => {
        const config = await GlobalConfigurationsMother.createWorkQueueConfig(globalConfigRepository);
        const shiftManagement = await ShiftManagementMother.createShiftManagement(repositoryShiftManagement);
        const groupA = await createGroup(shiftManagement, config);
        const groupB = await createGroup(shiftManagement, config);

        const userA = await UsersMother.createUserWithRole(userRepository, {
            is_active: StatusEnum.ACTIVE.value,
            grupo_activo: groupA.id.value,
            last_seen_at: activeSessionDate(),
        });
        await UserGroupRelationshipMother.create(relUserRepository, {
            usuario_id: userA.id.value,
            grupo_id: groupA.id.value,
        });

        const userB = await UsersMother.createUserWithRole(userRepository, {
            is_active: StatusEnum.ACTIVE.value,
            grupo_activo: groupB.id.value,
            last_seen_at: activeSessionDate(),
        });
        await UserGroupRelationshipMother.create(relUserRepository, {
            usuario_id: userB.id.value,
            grupo_id: groupB.id.value,
        });

        await CasesMother.createCase(caseRepository, {
            grupo_id: groupA.id.value,
            responsable_id: userA.id.value,
        });
        await CasesMother.createCase(caseRepository, {
            grupo_id: groupB.id.value,
            responsable_id: userB.id.value,
        });
        await CasesMother.createCase(caseRepository, {
            grupo_id: groupB.id.value,
            responsable_id: userB.id.value,
        });

        const groupsWithCapacity = await findWorkQueueGroupsWithCapacity();
        expect(groupsWithCapacity).toHaveLength(2);

        const capacityA = groupsWithCapacity.find((g) => g.grupo_id === groupA.id.value).capacidad;
        const capacityB = groupsWithCapacity.find((g) => g.grupo_id === groupB.id.value).capacidad;

        expect(capacityA).toBe(2);
        expect(capacityB).toBe(1);
    });

    it('should evaluate capacity per group using grupo_activo to determine active users', async () => {
        const config = await GlobalConfigurationsMother.createWorkQueueConfig(globalConfigRepository);
        const shiftManagement = await ShiftManagementMother.createShiftManagement(repositoryShiftManagement);
        const groupA = await createGroup(shiftManagement, config);
        const groupB = await createGroup(shiftManagement, config);

        const sharedUser = await UsersMother.createUserWithRole(userRepository, {
            is_active: StatusEnum.ACTIVE.value,
            grupo_activo: groupA.id.value,
            last_seen_at: activeSessionDate(),
        });

        await UserGroupRelationshipMother.create(relUserRepository, {
            usuario_id: sharedUser.id.value,
            grupo_id: groupA.id.value,
        });
        await UserGroupRelationshipMother.create(relUserRepository, {
            usuario_id: sharedUser.id.value,
            grupo_id: groupB.id.value,
        });

        await CasesMother.createCase(caseRepository, {
            grupo_id: groupA.id.value,
            responsable_id: sharedUser.id.value,
        });

        const groupsWithCapacity = await findWorkQueueGroupsWithCapacity();
        expect(groupsWithCapacity).toHaveLength(2);

        const capacityA = groupsWithCapacity.find((g) => g.grupo_id === groupA.id.value)?.capacidad;
        const capacityB = groupsWithCapacity.find((g) => g.grupo_id === groupB.id.value)?.capacidad;

        expect(capacityA).toBe(2);
        expect(capacityB).toBe(0);
    });

    it('should ignore closed or deleted cases when calculating open cases', async () => {
        const config = await GlobalConfigurationsMother.createWorkQueueConfig(globalConfigRepository);
        const shiftManagement = await ShiftManagementMother.createShiftManagement(repositoryShiftManagement);
        const group = await createGroup(shiftManagement, config);
        const groupId = group.id.value;

        const user1 = await UsersMother.createUserWithRole(userRepository, {
            is_active: StatusEnum.ACTIVE.value,
            grupo_activo: groupId,
            last_seen_at: activeSessionDate(),
        });
        await UserGroupRelationshipMother.create(relUserRepository, { usuario_id: user1.id.value, grupo_id: groupId });

        await CasesMother.createCase(caseRepository, { grupo_id: groupId, responsable_id: user1.id.value });

        const closedCase = await CasesMother.createCase(caseRepository, {
            grupo_id: groupId,
            responsable_id: user1.id.value,
        });
        await caseRepository
            .connection('cases')
            .where('id', closedCase.id.value)
            .update({ fecha_resolucion: new Date().toISOString() });

        const deletedCase = await CasesMother.createCase(caseRepository, {
            grupo_id: groupId,
            responsable_id: user1.id.value,
        });
        await caseRepository
            .connection('cases')
            .where('id', deletedCase.id.value)
            .update({ deleted_at: new Date().toISOString() });

        const groupsWithCapacity = await findWorkQueueGroupsWithCapacity();
        expect(groupsWithCapacity).toHaveLength(1);
        expect(groupsWithCapacity[0].capacidad).toBe(2);
    });

    it('should ignore deleted users', async () => {
        const config = await GlobalConfigurationsMother.createWorkQueueConfig(globalConfigRepository);
        const shiftManagement = await ShiftManagementMother.createShiftManagement(repositoryShiftManagement);
        const group = await createGroup(shiftManagement, config);
        const groupId = group.id.value;

        const user1 = await UsersMother.createUserWithRole(userRepository, {
            is_active: StatusEnum.ACTIVE.value,
            grupo_activo: groupId,
            last_seen_at: activeSessionDate(),
        });
        await userRepository
            .connection('usuarios')
            .where('id', user1.id.value)
            .update({ deleted_at: new Date().toISOString() });
        await UserGroupRelationshipMother.create(relUserRepository, { usuario_id: user1.id.value, grupo_id: groupId });

        const groupsWithCapacity = await findWorkQueueGroupsWithCapacity();
        expect(groupsWithCapacity).toHaveLength(1);
        expect(groupsWithCapacity[0].capacidad).toBe(0);
    });

    it('should include the list of eligible users and their individual remaining capacity in the result', async () => {
        const baseSettings = GlobalConfigurationsMother.settings;
        const testSettings = JSON.parse(JSON.stringify(baseSettings));
        testSettings.behaviors.application.agente.casos.type_assignment = 'cola_de_trabajo';
        testSettings.behaviors.application.agente.casos.activeUsers_filter_bool = true;
        testSettings.behaviors.application.agente.casos.max_cases_per_user = '3';
        testSettings.behaviors.application.agente.casos.assignLastResponsibleIgnoreDefault = true;

        const config = await GlobalConfigurationsMother.createConfiguration(globalConfigRepository, {
            settings: testSettings,
        });
        const shiftManagement = await ShiftManagementMother.createShiftManagement(repositoryShiftManagement);
        const group = await createGroup(shiftManagement, config);
        const groupId = group.id.value;

        const user1 = await UsersMother.createUserWithRole(userRepository, {
            is_active: StatusEnum.ACTIVE.value,
            grupo_activo: groupId,
            last_seen_at: activeSessionDate(),
        });
        const user2 = await UsersMother.createUserWithRole(userRepository, {
            is_active: StatusEnum.ACTIVE.value,
            grupo_activo: groupId,
            last_seen_at: activeSessionDate(),
        });

        await UserGroupRelationshipMother.create(relUserRepository, { usuario_id: user1.id.value, grupo_id: groupId });
        await UserGroupRelationshipMother.create(relUserRepository, { usuario_id: user2.id.value, grupo_id: groupId });

        await CasesMother.createCase(caseRepository, { grupo_id: groupId, responsable_id: user1.id.value });
        await CasesMother.createCase(caseRepository, { grupo_id: groupId, responsable_id: user2.id.value });
        await CasesMother.createCase(caseRepository, { grupo_id: groupId, responsable_id: user2.id.value });

        const groupsWithCapacity = await findWorkQueueGroupsWithCapacity();
        expect(groupsWithCapacity).toHaveLength(1);
        const groupCapacity = groupsWithCapacity[0];
        expect(groupCapacity.capacidad).toBe(3);
        expect(groupCapacity.assignLastResponsibleIgnoreDefault).toBe(true);
        expect(groupCapacity.users).toBeDefined();
        expect(groupCapacity.users).toHaveLength(2);

        const u1Result = groupCapacity.users.find((u) => u.id === user1.id.value);
        const u2Result = groupCapacity.users.find((u) => u.id === user2.id.value);

        expect(u1Result).toBeDefined();
        expect(u1Result.remaining).toBe(2);

        expect(u2Result).toBeDefined();
        expect(u2Result.remaining).toBe(1);
    });
});
