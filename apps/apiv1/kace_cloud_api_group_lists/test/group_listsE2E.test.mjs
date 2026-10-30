import { KnexGroupListsRepository } from '@kace/core/src/group-lists/index.js';
import { KnexRoleRepository } from '@kace/core/src/role/infrastructure/persistence/KnexRoleRepository.js';
import { KnexShiftManagementRepository } from '@kace/core/src/shift-management/index.js';
import { KnexGroupsRepository } from '@kace/core/src/grupos/index.js';
import { production as knexConfig } from '@kace/database/knexfile';
import GroupListMother from '@kace/core/tests/group-lists/domain/GroupListMother';
import { GroupsMother } from '@kace/core/tests/groups/domain/GroupsMother';
import { TestHelper } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';

describe('GroupListsController test', () => {
    const groupListRepository = new KnexGroupListsRepository(knexConfig);
    const groupRepository = new KnexGroupsRepository(knexConfig);
    const shiftManagementRepository = new KnexShiftManagementRepository(knexConfig);
    const roleRepository = new KnexRoleRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/group-lists`
            : 'http://127.0.0.1:60029';

    afterAll(async () => {
        try {
            groupListRepository.connection.destroy();
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    it('should create a GroupList', async () => {
        const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository, roleRepository);

        const payload = GroupListMother.dto(group);

        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(201);
    });

    it('return statusCode 400 when validation fails to create a GroupList', async () => {
        const payload = {};

        let response;
        try {
            response = await TestHelper.postRequest(baseUrl, payload);
        } catch (error) {
            response = error.response;
        }

        expect(response.status).toBe(400);
    });

    it('should fetch a GroupList', async () => {
        const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository, roleRepository);

        const groupList = await GroupListMother.createGroupList(groupListRepository, group);

        const dataExpected = {
            id: groupList.id.value,
            descripcion: groupList.descripcion.value,
            lista_grupos: groupList.lista_grupos.value,
            is_active: groupList.is_active.value,
            created_at: groupList.created_at.value,
            updated_at: null,
            created_by: groupList.created_by.value,
            updated_by: null,
        };
        const response = await TestHelper.getRequest(`${baseUrl}/${groupList.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toEqual(dataExpected);
    });

    it('should fetch all GroupLists', async () => {
        const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository, roleRepository);

        const groupList1 = await GroupListMother.createGroupList(groupListRepository, group);
        const groupList2 = await GroupListMother.createGroupList(groupListRepository, group);

        const response = await TestHelper.getRequest(baseUrl);

        expect(response.status).toBe(200);
        expect(response.data.data.items[0].data.id).toEqual(groupList2.id.value);
        expect(response.data.data.items[1].data.id).toEqual(groupList1.id.value);
    });

    it('should delete a GroupList', async () => {
        const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository, roleRepository);

        const groupList = await GroupListMother.createGroupList(groupListRepository, group);

        const response = await TestHelper.getRequest(`${baseUrl}/${groupList.id.value}/delete`);

        expect(response.status).toBe(200);
    });

    it('should update a GroupList', async () => {
        const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository, roleRepository);
        const groupList = await GroupListMother.createGroupList(groupListRepository, group);
        const randomNumber = Math.floor(Math.random() * 1000) + 1;
        const payload = {
            descripcion: `updated name nro ${randomNumber}`,
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${groupList.id.value}`, payload);

        expect(response.status).toBe(200);
    });

    it('should return notFound when the resource doesnt exist', async () => {
        let response;
        try {
            response = await TestHelper.getRequest(`${baseUrl}/invalid/resource`);
        } catch (error) {
            response = error.response;
        }

        expect(response.status).toBe(403);
    });
});
