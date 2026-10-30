import { KnexUserGroupRelationshipRepository } from '@kace/core/src/user-group-relationships';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';

import { KnexUsersRepository } from '@kace/core/src/users';
import { KnexGroupsRepository } from '@kace/core/src/grupos';
import { KnexShiftManagementRepository } from '@kace/core/src/shift-management';
import { KnexRoleRepository } from '@kace/core/src/role/infrastructure/persistence/KnexRoleRepository';

import UserGroupRelationshipMother from '@kace/core/tests/user-group-relationships/domain/UserGroupRelationshipMother';
import RoleMother from '@kace/core/tests/roles/domain/RoleMother';
import { GroupsMother } from '@kace/core/tests/groups/domain/GroupsMother';
import UsersMother from '@kace/core/tests/users/domain/UsersMother';

describe('ClassificationTemplateRelationsController test', () => {
    const repository = new KnexUserGroupRelationshipRepository(knexConfig);

    const roleRepository = new KnexRoleRepository(knexConfig);
    const userRepository = new KnexUsersRepository(knexConfig);
    const groupRepository = new KnexGroupsRepository(knexConfig);
    const shiftManagementRepository = new KnexShiftManagementRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/classification-template-relationships`
            : 'http://127.0.0.1:60048';

    afterAll(async () => {
        try {
            repository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    it('should fetch a classification template relationship', async () => {
        const response = await TestHelper.getRequest(baseUrl);
        expect(response.status).toBe(200);
        expect(response.data.data.items).toBeDefined();
    });

    it('return statusCode 400 when validation fails to create a Template', async () => {
        const payload = {};

        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response).toHaveProperty('status', 400);
    });

    it('should batch add users to a group', async () => {
        const userIds = [uuidv4(), uuidv4()];
        const { id: rol_id } = await RoleMother.createRole(roleRepository);

        const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
        for (const userId of userIds) {
            await UsersMother.createUser(userRepository, {
                id: userId,
                rol_id: rol_id.value,
            });
        }

        const payload = userIds.map((userId) => ({
            usuario_id: userId,
            grupo_id: group.id.value,
        }));

        const response = await TestHelper.postRequest(`${baseUrl}`, payload);

        expect(response.status).toBe(201);
    });

    it('should batch remove users from a group', async () => {
        const userIds = [uuidv4(), uuidv4()];
        const { id: rol_id } = await RoleMother.createRole(roleRepository);

        const { id: groupId } = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
        for (const userId of userIds) {
            await UsersMother.createUser(userRepository, {
                id: userId,
                rol_id: rol_id.value,
            });
            await UserGroupRelationshipMother.create(repository, {
                usuario_id: userId,
                grupo_id: groupId.value,
            });
        }

        const payload = userIds.map((userId) => ({
            usuario_id: userId,
            grupo_id: groupId.value,
        }));
        const response = await TestHelper.postRequest(`${baseUrl}/delete`, payload);

        expect(response.status).toBe(200);
    });

    it('should return 400 if any usuario_id in batch add is invalid', async () => {
        const grupoId = uuidv4();
        const payload = [
            { usuario_id: uuidv4(), grupo_id: grupoId },
            { usuario_id: 'invalid-uuid', grupo_id: grupoId },
        ];

        const response = await TestHelper.postRequest(`${baseUrl}`, payload);
        expect(response).toHaveProperty('status', 400);
    });

    it('should return 400 if any usuario_id in batch remove is invalid', async () => {
        const grupoId = uuidv4();
        const payload = [
            { usuario_id: uuidv4(), grupo_id: grupoId },
            { usuario_id: 'invalid-uuid', grupo_id: grupoId },
        ];

        const response = await TestHelper.postRequest(`${baseUrl}/delete`, payload);
        expect(response).toHaveProperty('status', 400);
    });

    it('should return notFound when the resource does not exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}/invalid`);
        expect(response).toHaveProperty('status', 403);
    });
});
