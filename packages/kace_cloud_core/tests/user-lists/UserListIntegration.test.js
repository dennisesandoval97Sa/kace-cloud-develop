import {
    UserList,
    UserListCreator,
    UserListUpdater,
    UserListDeleter,
    UserListFinder,
    UserListSearcher,
    UserListResponse,
    UserListValidator,
    KnexUserListsRepository,
    UserListCounter,
} from '../../src/user-lists';
import { KnexUsersRepository } from '../../src/users';
import { KnexCaseRepository } from '../../src/cases/index.js';
import { KnexGroupsRepository } from '../../src/grupos/index.js';
import UserListMother from './domain/UserListMother';
import UsersMother from '../users/domain/UsersMother';
import CasesMother from '../cases/domain/CasesMother.js';
import { GroupsMother } from '../grupos/domain/GroupsMother.js';
import { GlobalConfigurationsMother } from '../global-config/domain/GlobalConfigurationsMother.js';
import { SETTINGS_WITH_WORK_QUEUE_PARAMS } from '../global-config/domain/SettingsMother.js';
import { KnexGlobalConfigurationRepository } from '../../src/global-config/index.js';
import { knexConfig } from '../knexfile.js';
import { v4 as uuidv4 } from 'uuid';
import { CustomError } from '../../src/shared/index.js';

describe('UserList Integration Tests', () => {
    const userRepository = new KnexUsersRepository(knexConfig);
    const repository = new KnexUserListsRepository(knexConfig);
    const groupsRepository = new KnexGroupsRepository(repository.connection);
    const userListValidator = new UserListValidator(userRepository);

    it('should create a UserList', async () => {
        const { id: userId } = await UsersMother.createUser(userRepository);
        const group = await GroupsMother.createGroupWithRelations(groupsRepository);
        const lista_usuarios = [{ id: userId.value }];
        const dto = UserListMother.dto({ lista_usuarios, group_id: group.id.value });
        const userListCreator = new UserListCreator(repository, userListValidator);

        await userListCreator.execute(dto);

        const result = await repository.connection('lista_usuarios').select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    describe('findSelectedAdvisor', () => {
        const caseRepository = new KnexCaseRepository(repository.connection);
        const loginAt = (minutesAgo) => new Date(Date.now() - minutesAgo * 60000).toISOString();

        const createUserList = async (users) => {
            const lista_usuarios = users.map((user) => ({ id: user.id.value }));
            return UserListMother.createUserList(repository, { lista_usuarios });
        };

        it('selects the user who connected first when open cases are tied', async () => {
            const newestUser = await UsersMother.createUser(userRepository, { last_login_at: loginAt(10) });
            const firstUser = await UsersMother.createUser(userRepository, { last_login_at: loginAt(120) });
            const middleUser = await UsersMother.createUser(userRepository, { last_login_at: loginAt(60) });

            const userList = await createUserList([newestUser, firstUser, middleUser]);

            const selected = await repository.findSelectedAdvisor(userList.id);

            expect(selected.id).toBe(firstUser.id.value);
        });

        it('keeps the first connected user selected when a new user connects with the same case load', async () => {
            const firstUser = await UsersMother.createUser(userRepository, { last_login_at: loginAt(120) });
            const middleUser = await UsersMother.createUser(userRepository, { last_login_at: loginAt(60) });
            const newestUser = await UsersMother.createUser(userRepository, { last_login_at: loginAt(1) });

            const userList = await createUserList([firstUser, middleUser, newestUser]);

            const selected = await repository.findSelectedAdvisor(userList.id);

            expect(selected.id).toBe(firstUser.id.value);
        });

        it('prioritizes the user with fewest open cases over connection order', async () => {
            const loadedFirstUser = await UsersMother.createUser(userRepository, { last_login_at: loginAt(120) });
            const freeNewUser = await UsersMother.createUser(userRepository, { last_login_at: loginAt(10) });

            const userList = await createUserList([loadedFirstUser, freeNewUser]);

            await CasesMother.createCase(caseRepository, {
                grupo_id: userList.group_id.value,
                responsable_id: loadedFirstUser.id.value,
            });

            const selected = await repository.findSelectedAdvisor(userList.id);

            expect(selected.id).toBe(freeNewUser.id.value);
        });

        it('places users without last_login_at at the end of the queue', async () => {
            const neverLoggedUser = await UsersMother.createUser(userRepository, { last_login_at: null });
            const connectedUser = await UsersMother.createUser(userRepository, { last_login_at: loginAt(5) });

            const userList = await createUserList([neverLoggedUser, connectedUser]);

            const selected = await repository.findSelectedAdvisor(userList.id);

            expect(selected.id).toBe(connectedUser.id.value);
        });

        it('usa assignment_active_session_limit de agente/casos para filtrar activos', async () => {
            const globalConfigRepository = new KnexGlobalConfigurationRepository(repository.connection);

            const settings = structuredClone(SETTINGS_WITH_WORK_QUEUE_PARAMS);
            settings.behaviors.application.agente.casos.type_assignment = 'cola_de_trabajo';
            settings.behaviors.application.agente.casos.activeUsers_filter_bool = true;
            settings.behaviors.application.agente.casos.assignment_active_session_limit = 60;
            settings.behaviors.application.admin.users.active_session_limit = 1;

            const configuration = await GlobalConfigurationsMother.createConfiguration(globalConfigRepository, {
                settings,
            });
            const group = await GroupsMother.createGroupWithRelations(groupsRepository, {
                configuration_id: configuration.id.value,
            });

            const activeUser = await UsersMother.createUser(userRepository, {
                last_seen_at: loginAt(30),
                last_login_at: loginAt(30),
                grupo_activo: group.id.value,
            });

            const lista_usuarios = [{ id: activeUser.id.value }];
            const userList = await UserListMother.createUserList(repository, {
                lista_usuarios,
                group_id: group.id.value,
            });

            const selected = await repository.findSelectedAdvisor(userList.id);

            expect(selected).not.toBeNull();
            expect(selected.id).toBe(activeUser.id.value);
        });
    });

    it('can get an existing user list', async () => {
        const userList = await UserListMother.createUserList(repository);
        const userListFinder = new UserListFinder(repository);

        const userListResult = await userListFinder.execute(userList.id.value);

        expect(userListResult).not.toBeNull();
        expect(userListResult).toBeInstanceOf(UserListResponse);
    });

    it('can update an existing user list', async () => {
        const { id: userId } = await UsersMother.createUser(userRepository);
        const userList = await UserListMother.createUserList(repository);
        const userListUpdater = new UserListUpdater(repository, userListValidator);

        const payload = {
            descripcion: 'Updated description',
            lista_usuarios: [{ id: userId.value }],
            is_active: true,
        };
        await userListUpdater.execute(userList.id.value, payload);

        const result = await repository.find(userList.id);
        expect(result).toBeInstanceOf(UserList);
        expect(result.descripcion.value).toBe(payload.descripcion);
    });

    it('can delete an existing user list', async () => {
        const userList = await UserListMother.createUserList(repository);
        const userListDeleter = new UserListDeleter(repository);

        await userListDeleter.execute(userList.id.value, {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        });

        const result = await repository.find(userList.id);
        expect(result).toBeInstanceOf(UserList);
        expect(result.deleted_at.value).not.toBeNull();
        expect(result.deleted_by.value).not.toBeNull();
    });

    it('searches for UserList instances with given criteria with filter', async () => {
        for (let i = 0; i < 10; i++) {
            await UserListMother.createUserList(repository);
        }
        const dtoCriteria = {
            filter: [
                {
                    field: 'is_active',
                    operator: 'eq',
                    value: '1',
                    type: 'and',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const userListSearcher = new UserListSearcher(repository);

        const userListResult = await userListSearcher.execute(dtoCriteria);
        expect(userListResult.toJson().data.items.length).toBeGreaterThan(0);
    });

    it('should return empty when trying to find a user list with a non-existent ID', async () => {
        const userListFinder = new UserListFinder(repository);

        await expect(userListFinder.execute(uuidv4())).rejects.toThrow(CustomError);
    });

    it('should throw an error when creating a UserList with invalid data', async () => {
        const invalidDto = UserListMother.dto();
        delete invalidDto.id;
        const userListCreator = new UserListCreator(repository);

        await expect(userListCreator.execute(invalidDto)).rejects.toThrow();
    });

    it('should throw an error when trying to update a non-existent user list', async () => {
        const userListUpdater = new UserListUpdater(repository, userListValidator);
        const nonExistentId = uuidv4();
        const newValues = { descripcion: 'Updated description' };

        await expect(userListUpdater.execute(nonExistentId, newValues)).rejects.toThrow();
    });

    it('should not throw an error when deleting a non-existent user list', async () => {
        const userListDeleter = new UserListDeleter(repository);
        const nonExistentId = uuidv4();

        await expect(
            userListDeleter.execute(nonExistentId, { deleted_at: new Date().toISOString(), deleted_by: uuidv4() })
        ).resolves.not.toThrow();
    });

    it('should handle creating multiple user lists with the same ID', async () => {
        const { id: userId } = await UsersMother.createUser(userRepository);
        const group = await GroupsMother.createGroupWithRelations(groupsRepository);
        const lista_usuarios = [{ id: userId.value }];
        const dto = UserListMother.dto({ lista_usuarios, group_id: group.id.value });
        const userListCreator = new UserListCreator(repository, userListValidator);

        await userListCreator.execute(dto);

        await expect(userListCreator.execute(dto)).rejects.toThrow();
    });

    it('should count user Lists correctly', async () => {
        const { id: userId } = await UsersMother.createUser(userRepository);
        for (let i = 0; i < 10; i++) {
            await UserListMother.createUserList(repository, { id: userId.value });
        }
        const counter = new UserListCounter(repository);

        // El repositorio devuelve la fila entera del count. En postgres la
        // columna se llama `count` -no `count(*)`, que es el alias de mysql- y
        // llega como cadena porque `count()` es `bigint`.
        const { count } = await counter.execute({ filters: [], relationship: null });
        expect(Number(count)).toBe(10);
    });

    it('should throw an error when creating a UserList with a duplicate description', async () => {
        const user1 = await UsersMother.createUser(userRepository);
        const group = await GroupsMother.createGroupWithRelations(groupsRepository);
        const lista_usuarios = [{ id: user1.id.value }];
        const dto1 = UserListMother.dto({ lista_usuarios, group_id: group.id.value });
        const dto2 = UserListMother.dto({ lista_usuarios });
        dto2.descripcion = dto1.descripcion;

        const userListCreator = new UserListCreator(repository, userListValidator);

        await userListCreator.execute(dto1);

        await expect(userListCreator.execute(dto2)).rejects.toThrow(
            `The following value(s) already exist: descripcion '${dto1.descripcion}'.`
        );
    });

    it('should throw an error when updating a UserList to have a duplicate description', async () => {
        const userList1 = await UserListMother.createUserList(repository);
        const userList2 = await UserListMother.createUserList(repository);

        const userListUpdater = new UserListUpdater(repository, userListValidator);

        await expect(
            userListUpdater.execute(userList2.id.value, { descripcion: userList1.descripcion.value })
        ).rejects.toThrow(`The following value(s) already exist: descripcion '${userList1.descripcion.value}'.`);
    });
});
