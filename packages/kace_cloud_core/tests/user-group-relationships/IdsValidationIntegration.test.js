import { GroupsMother } from '../grupos/domain/GroupsMother.js';
import { IdsValidator } from '../../src/user-group-relationships/index.js';
import { knexConfig } from '../knexfile.js';
import { KnexGroupsRepository } from '../../src/grupos/index.js';
import { KnexUserGroupRelationshipRepository } from '../../src/user-group-relationships';
import { KnexUsersRepository } from '../../src/users/index.js';
import { v4 as uuidv4 } from 'uuid';
import UserGroupRelationshipMother from './domain/UserGroupRelationshipMother.js';
import UsersMother from '../users/domain/UsersMother';
import { KnexShiftManagementRepository } from '../../src/shift-management/index.js';

describe('idsValidator Integration Tests', () => {
    const userGroupRepository = new KnexUserGroupRelationshipRepository(knexConfig);
    const userRepository = new KnexUsersRepository(knexConfig);
    const groupRepository = new KnexGroupsRepository(knexConfig);
    const idsValidator = new IdsValidator(userRepository, groupRepository);
    const shiftManagementRepository = new KnexShiftManagementRepository(knexConfig);

    it('should validate that all user IDs exist', async () => {
        const users = [];
        for (let i = 0; i < 3; i++) {
            const dto = UsersMother.dto();
            await UsersMother.createUser(userRepository, dto);
            users.push(dto);
        }

        const userIds = users.map((user) => user.id);
        await expect(idsValidator.validateUserIds(userIds)).resolves.not.toThrow();
    });

    it('should throw an error if one or more user IDs do not exist', async () => {
        const users = [];
        for (let i = 0; i < 2; i++) {
            const dto = UsersMother.dto();
            await UsersMother.createUser(userRepository, dto);
            users.push(dto);
        }

        const nonExistentUserId = uuidv4();
        const userIds = users.map((user) => user.id);
        userIds.push(nonExistentUserId);

        await expect(idsValidator.validateUserIds(userIds)).rejects.toThrow('One or more IDs do not exist');
    });

    it('should validate that all group IDs exist', async () => {
        const groupIds = [];
        for (let i = 0; i < 3; i++) {
            const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
            groupIds.push(group.id.value);
        }
        await expect(idsValidator.validateGroupIds(groupIds)).resolves.not.toThrow();
    });

    it('should throw an error if one or more group IDs do not exist', async () => {
        const groupIds = [];
        for (let i = 0; i < 2; i++) {
            const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
            groupIds.push(group.id.value);
        }

        const nonExistentGroupId = uuidv4();
        groupIds.push(nonExistentGroupId);

        await expect(idsValidator.validateGroupIds(groupIds)).rejects.toThrow('One or more IDs do not exist');
    });

    it('should validate that all user-group relationships exist', async () => {
        const relationships = [];
        for (let i = 0; i < 2; i++) {
            const user = await UsersMother.createUser(userRepository);
            const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);

            const relationship = UserGroupRelationshipMother.dto(user.id.value, group.id.value);
            await UserGroupRelationshipMother.create(userGroupRepository, relationship);
            relationships.push(relationship);
        }

        await expect(idsValidator.validateRelation(userGroupRepository, relationships)).resolves.not.toThrow();
    });

    it('should throw an error if one or more user-group relationships do not exist', async () => {
        const relationships = [];
        for (let i = 0; i < 1; i++) {
            const user = await UsersMother.createUser(userRepository);
            const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);

            const relationship = UserGroupRelationshipMother.dto(user.id.value, group.id.value);
            await UserGroupRelationshipMother.create(userGroupRepository, relationship);
            relationships.push(relationship);
        }

        const nonExistentRelationship = {
            usuario_id: uuidv4(),
            grupo_id: uuidv4(),
        };
        relationships.push(nonExistentRelationship);

        await expect(idsValidator.validateRelation(userGroupRepository, relationships)).rejects.toThrow(
            'One or more relations do not exist'
        );
    });
});
