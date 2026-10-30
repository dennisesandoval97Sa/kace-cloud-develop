import { KnexRoleRepository } from '@kace/core/src/role/infrastructure/persistence/KnexRoleRepository.js';
import { knexConfig } from '@kace/database';
import { KnexUserListsRepository } from '@kace/core/src/user-lists/index.js';
import { KnexUsersRepository } from '@kace/core/src/users/index.js';
import RoleMother from '@kace/core/tests/roles/domain/RoleMother';
import UsersMother from '@kace/core/tests/users/domain/UsersMother';
import UserListMother from '@kace/core/tests/user-lists/domain/UserListMother';
import { TestHelper } from '@kace/api-common';

describe('UserListsController test', () => {
    const roleRepository = new KnexRoleRepository(knexConfig);
    const userListRepository = new KnexUserListsRepository(knexConfig);
    const userRepository = new KnexUsersRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/assignment-users-list`
            : 'http://127.0.0.1:60049';

    beforeEach(async () => {
        await TestHelper.resetSchemaAndMigrate();
    });

    afterAll(async () => {
        try {
            userListRepository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    it('should create a UserList', async () => {
        const role = await RoleMother.createRole(roleRepository);
        const { id: userId } = await UsersMother.createUser(userRepository, {
            rol_id: role.id.value,
        });
        const lista_usuarios = [{ id: userId.value }];
        const payload = UserListMother.dto({ lista_usuarios });

        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(201);
    });

    it('return statusCode 400 when validation fails to create a UserList', async () => {
        const payload = {};

        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(400);
    });

    it('should fetch a UserList', async () => {
        const role = await RoleMother.createRole(roleRepository);
        const { id: userId } = await UsersMother.createUser(userRepository, {
            rol_id: role.id.value,
        });
        const lista_usuarios = [{ id: userId.value }];
        const userList = await UserListMother.createUserList(userListRepository, {
            lista_usuarios,
        });
        const dataExpected = {
            id: userList.id.value,
            lista_usuarios: userList.lista_usuarios.value,
            descripcion: userList.descripcion.value,
            is_active: userList.is_active.value,
            created_at: userList.created_at.value,
            updated_at: null,
            created_by: userList.created_by.value,
            updated_by: null,
        };

        const response = await TestHelper.getRequest(`${baseUrl}/${userList.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toEqual(dataExpected);
    });

    it('should fetch all UserLists', async () => {
        const role = await RoleMother.createRole(roleRepository);
        const { id: userId } = await UsersMother.createUser(userRepository, {
            rol_id: role.id.value,
        });
        const lista_usuarios = [{ id: userId.value }];
        const userList1 = await UserListMother.createUserList(userListRepository, {
            lista_usuarios,
        });
        const userList2 = await UserListMother.createUserList(userListRepository, {
            lista_usuarios,
        });

        const response = await TestHelper.getRequest(baseUrl);

        expect(response.status).toBe(200);
        expect(response.data.data.items[0].id).toEqual(userList2.id.value);
        expect(response.data.data.items[1].id).toEqual(userList1.id.value);
    });

    it('should delete a UserList', async () => {
        const role = await RoleMother.createRole(roleRepository);
        const { id: userId } = await UsersMother.createUser(userRepository, {
            rol_id: role.id.value,
        });
        const lista_usuarios = [{ id: userId.value }];
        const userList = await UserListMother.createUserList(userListRepository, {
            lista_usuarios,
        });

        const response = await TestHelper.getRequest(`${baseUrl}/${userList.id.value}/delete`);

        expect(response.status).toBe(200);
    });

    it('should update a UserList', async () => {
        const role = await RoleMother.createRole(roleRepository);
        const user1 = await UsersMother.createUser(userRepository, {
            rol_id: role.id.value,
        });
        const user2 = await UsersMother.createUser(userRepository, {
            rol_id: role.id.value,
        });
        const listaUsuarios = [{ id: user1.id.value }];
        const userList = await UserListMother.createUserList(userListRepository, {
            lista_usuarios: listaUsuarios,
        });

        const payload = {
            descripcion: 'updated name',
            lista_usuarios: [{ id: user1.id.value }, { id: user2.id.value }],
            is_active: true,
        };
        const response = await TestHelper.postRequest(`${baseUrl}/${userList.id.value}`, payload);
        const responseGet = await TestHelper.getRequest(`${baseUrl}/${userList.id.value}`);

        expect(response.status).toBe(200);
        expect(responseGet.data.data.lista_usuarios).toEqual(payload.lista_usuarios);
    });
});
