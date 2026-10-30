import {
    KnexUserGroupRelationshipRepository,
    UserGroupBatchCreator,
    UserGroupBatchDeleter,
    UserGroupCollectionResponse,
    UserGroupCounter,
    UserGroupCreator,
    UserGroupDeleter,
    UserGroupFinder,
    UserGroupResponse,
    UserGroupSearcher,
} from '../../src/user-group-relationships';
import UserGroupRelationshipMother from './domain/UserGroupRelationshipMother';
import { knexConfig } from '../knexfile.js';
import { v4 as uuidv4 } from 'uuid';
import UsersMother from '../users/domain/UsersMother.js';
import { KnexUsersRepository } from '../../src/users/index.js';
import { KnexGroupsRepository } from '../../src/grupos/index.js';
import { GroupsMother } from '../grupos/domain/GroupsMother.js';
import { KnexShiftManagementRepository } from '../../src/shift-management/index.js';

describe('UserGroup Integration Tests', () => {
    const repository = new KnexUserGroupRelationshipRepository(knexConfig);
    const userRepository = new KnexUsersRepository(knexConfig);
    const groupRepository = new KnexGroupsRepository(knexConfig);
    const shiftManagementRepository = new KnexShiftManagementRepository(knexConfig);
    const idsValidator = {
        validateUserIds: () => true,
        validateGroupIds: () => true,
        validateRelation: () => true,
    };
    const batchCreator = new UserGroupBatchCreator(repository, idsValidator);
    const batchDeleter = new UserGroupBatchDeleter(repository, idsValidator);
    const actorId = uuidv4();

    // La plantilla trae 11 filas sembradas en `rel_usuarios_grupos`, y los
    // tests de conteo hacen select('*') sobre la tabla entera dando por hecho
    // que empieza vacia. Vaciarla aqui y no en un beforeAll: el reset a la
    // plantilla corre antes de cada `it` y las repondria.
    beforeEach(async () => {
        await repository.connection(repository.tableName).delete();
    });

    it('should create a UserGroupRelationship', async () => {
        const dto = UserGroupRelationshipMother.dto();
        // El dto va al caso de uso sin pasar por `create`, que es quien
        // respalda el usuario y el grupo que la factoria inventa.
        await UserGroupRelationshipMother.ensureRelations(repository.connection, dto);
        const userGroupCreator = new UserGroupCreator(repository, idsValidator);

        await userGroupCreator.execute(dto);

        const result = await repository
            .connection(repository.tableName)
            .select('*')
            .where({ usuario_id: dto.usuario_id, grupo_id: dto.grupo_id });

        expect(result.length).toBe(1);
    });

    it('can find an existing UserGroupRelationship', async () => {
        const userGroup = await UserGroupRelationshipMother.create(repository);
        const userGroupFinder = new UserGroupFinder(repository);

        const userGroupResult = await userGroupFinder.execute(userGroup.usuario_id.value, userGroup.grupo_id.value);

        expect(userGroupResult).not.toBeNull();
        expect(userGroupResult).toBeInstanceOf(UserGroupResponse);
    });

    it('can delete an existing UserGroupRelationship', async () => {
        const userGroup = await UserGroupRelationshipMother.create(repository);
        const userGroupDeleter = new UserGroupDeleter(repository);

        await userGroupDeleter.execute(userGroup.usuario_id.value, userGroup.grupo_id.value);

        const result = await repository.find(userGroup.usuario_id, userGroup.grupo_id);
        expect(result).toBeNull();
    });

    it('searches for UserGroupRelationships with given criteria with filter', async () => {
        const fakeGroupId = uuidv4();
        for (let i = 0; i < 10; i++) {
            await UserGroupRelationshipMother.create(repository, { grupo_id: fakeGroupId });
        }
        const dtoCriteria = {
            filter: [
                {
                    field: 'grupo_id',
                    operator: 'eq',
                    value: fakeGroupId,
                    type: 'and',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: null,
        };
        const userGroupSearch = new UserGroupSearcher(repository);

        const userGroupResult = await userGroupSearch.execute(dtoCriteria);
        expect(userGroupResult).toBeInstanceOf(UserGroupCollectionResponse);
    });

    it('searches for UserGroupRelationships with criteria that match no records', async () => {
        const dtoCriteria = {
            filter: [
                {
                    field: 'grupo_id',
                    operator: 'eq',
                    value: '999',
                    type: 'and',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: null,
        };
        const userGroupSearch = new UserGroupSearcher(repository);

        const userGroupResult = await userGroupSearch.execute(dtoCriteria);
        expect(userGroupResult).toBeInstanceOf(UserGroupCollectionResponse);
        expect(userGroupResult.toJson().data.items.length).toBe(0);
    });

    it('should return empty when trying to find a UserGroupRelationship with a non-existent ID', async () => {
        const userGroupFinder = new UserGroupFinder(repository);

        const userGroupResult = await userGroupFinder.execute(uuidv4(), uuidv4());

        expect(userGroupResult).toEqual({});
    });

    it('should throw an error when creating a UserGroupRelationship with invalid data', async () => {
        const invalidDto = UserGroupRelationshipMother.dto();
        delete invalidDto.usuario_id;
        const userGroupCreator = new UserGroupCreator(repository);

        await expect(userGroupCreator.execute(invalidDto)).rejects.toThrow();
    });

    it('should not throw an error when deleting a non-existent UserGroupRelationship', async () => {
        const userGroupDeleter = new UserGroupDeleter(repository);
        const nonExistentId = uuidv4();

        await expect(userGroupDeleter.execute(nonExistentId, nonExistentId)).rejects.toThrow(
            `Relation with userId ${nonExistentId} and groupId ${nonExistentId} does not exist.`
        );
    });

    it('should handle creating multiple UserGroupRelationships with the same ID', async () => {
        const dto = UserGroupRelationshipMother.dto();
        await UserGroupRelationshipMother.ensureRelations(repository.connection, dto);
        const userGroupCreator = new UserGroupCreator(repository, idsValidator);

        await userGroupCreator.execute(dto);

        await expect(userGroupCreator.execute(dto)).rejects.toThrow();
    });

    it('should count UserGroupRelationships correctly', async () => {
        for (let i = 0; i < 10; i++) {
            await UserGroupRelationshipMother.create(repository);
        }
        const counter = new UserGroupCounter(repository);

        const count = await counter.execute({ filters: [], relationship: null });
        expect(Number(count.count)).toBe(10);
    });

    it('should create multiple UserGroupRelationships in a batch successfully', async () => {
        const relationships = [];
        for (let i = 0; i < 5; i++) {
            const dto = UserGroupRelationshipMother.dto();
            await UserGroupRelationshipMother.ensureRelations(repository.connection, dto);
            relationships.push(dto);
        }
        await batchCreator.execute(relationships, actorId);

        const savedRelationships = await repository.connection(repository.tableName).select('*');
        expect(savedRelationships.length).toBe(5);
    });

    it('should rollback the transaction if an error occurs during creation', async () => {
        const relation = await UserGroupRelationshipMother.create(repository);
        const dto = [{ usuario_id: relation.usuario_id.value, grupo_id: relation.grupo_id.value }];
        await expect(batchCreator.execute(dto, actorId)).rejects.toThrow(
            'Batch creation failed, transaction rolled back.'
        );

        const savedRelationships = await repository.connection(repository.tableName).select('*');
        expect(savedRelationships.length).toBe(1);
    });

    it('should handle an empty array of relationships gracefully', async () => {
        await expect(batchCreator.execute([], actorId)).resolves.not.toThrow();

        const savedRelationships = await repository.connection(repository.tableName).select('*');
        expect(savedRelationships.length).toBe(0);
    });

    it('should delete multiple UserGroupRelationships in a batch successfully', async () => {
        const relationships = [];
        for (let i = 0; i < 5; i++) {
            const dto = UserGroupRelationshipMother.dto();
            relationships.push(dto);
            await UserGroupRelationshipMother.create(repository, dto);
        }

        await batchDeleter.execute(relationships, actorId);

        const savedRelationships = await repository.connection(repository.tableName).select('*');
        expect(savedRelationships.length).toBe(0);
    });

    it('should rollback the transaction if an error occurs during deletion', async () => {
        const relationships = [];
        for (let i = 0; i < 3; i++) {
            const dto = UserGroupRelationshipMother.dto();
            await UserGroupRelationshipMother.create(repository, dto);
            relationships.push(dto);
        }

        delete relationships[2].grupo_id;
        await expect(batchDeleter.execute(relationships, actorId)).rejects.toThrow(
            'Batch deletion failed, transaction rolled back.'
        );

        const savedRelationships = await repository.connection(repository.tableName).select('*');
        expect(savedRelationships.length).toBe(3);
    });

    it('should handle an empty array of relationships gracefully', async () => {
        await expect(batchDeleter.execute([], actorId)).resolves.not.toThrow();

        const savedRelationships = await repository.connection(repository.tableName).select('*');
        expect(savedRelationships.length).toBe(0);
    });

    it('should return a collection of records', async () => {
        const user = await UsersMother.createUser(userRepository);
        const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
        const dto = {
            usuario_id: user.id.value,
            grupo_id: group.id.value,
        };
        await UserGroupRelationshipMother.create(repository, dto);

        const userGroupSearch = new UserGroupSearcher(repository);
        const userGroupResult = await userGroupSearch.execute({
            filter: [
                {
                    field: 'rel_usuarios_grupos.usuario_id',
                    operator: 'eq',
                    value: user.id.value,
                    type: 'and',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: null,
        });

        expect(userGroupResult).toBeInstanceOf(UserGroupCollectionResponse);
    });

    it('ignores legacy default soft-delete filter and created-at order for searches', async () => {
        const user = await UsersMother.createUser(userRepository);
        const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
        await UserGroupRelationshipMother.create(repository, {
            usuario_id: user.id.value,
            grupo_id: group.id.value,
        });

        const userGroupSearch = new UserGroupSearcher(repository);
        const userGroupResult = await userGroupSearch.execute({
            filter: [
                {
                    field: 'usuario_id',
                    operator: 'eq',
                    value: user.id.value,
                    type: 'AND',
                },
                {
                    field: 'deleted_at',
                    operator: 'null',
                    value: 'null',
                    type: 'AND',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        });

        expect(userGroupResult.toJson().data.items).toHaveLength(1);
        expect(userGroupResult.toJson().data.items[0].grupo_id).toBe(group.id.value);
    });
});
