import { production as knexConfig } from '@kace/database/knexfile';
import { KnexGroupsRepository } from '@kace/core/src/grupos/index.js';
import { KnexUsersRepository } from '@kace/core/src/users';
import { GroupsMother } from '@kace/core/tests/groups/domain/GroupsMother.js';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';
import { KnexShiftManagementRepository } from '@kace/core/src/shift-management/index.js';
import { KnexRoleRepository } from '@kace/core/src/role/infrastructure/persistence/KnexRoleRepository.js';
import RoleMother from '@kace/core/tests/roles/domain/RoleMother.js';
import UsersMother from '@kace/core/tests/users/domain/UsersMother.js';
import { CaseFactory } from '@kace/core/src/factories/CaseFactory.js';
import UserGroupRelationshipMother from '@kace/core/tests/user-group-relationships/domain/UserGroupRelationshipMother.js';
import { KnexUserGroupRelationshipRepository } from '@kace/core/src/user-group-relationships';
import { TestHelper } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';

describe('GroupsE2E test', () => {
    const repository = new KnexGroupsRepository(knexConfig);
    const userRepository = new KnexUsersRepository(knexConfig);
    const repositoryShiftManagement = new KnexShiftManagementRepository(knexConfig);
    const roleRpository = new KnexRoleRepository(knexConfig);
    const userGroupRepository = new KnexUserGroupRelationshipRepository(knexConfig);
    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/groups`
            : 'http://localhost:60055';

    afterAll(async () => {
        try {
            repository.connection.destroy();
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    it('should Assign cases a Group', async () => {
        const { id: rol_id } = await RoleMother.createRole(roleRpository);

        const group = await GroupsMother.createGroup(repository, repositoryShiftManagement, rol_id.value);
        const userId = uuidv4();

        await UsersMother.createUser(userRepository, {
            id: userId,
            rol_id: rol_id.value,
        });
        await UserGroupRelationshipMother.create(userGroupRepository, {
            usuario_id: userId,
            grupo_id: group.id.value,
        });

        const kase = await CaseFactory.create();
        const payload = {
            cases: [kase.id.value],
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${group.id.value}`, payload);

        expect(response.status).toBe(200);
    });
});
