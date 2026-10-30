import {
    ClassificationGroupBatchCreator,
    ClassificationGroupBatchDeleter,
    ClassificationGroupCollectionResponse,
    ClassificationGroupCounter,
    ClassificationGroupCreator,
    ClassificationGroupDeleter,
    ClassificationGroupFinder,
    ClassificationGroupResponse,
    ClassificationGroupSearcher,
    KnexClassificationGroupRelationshipRepository,
} from '../../src/classification-group-relationships/index.js';
import { KnexGroupsRepository } from '../../src/grupos/infrastructure/persistence/KnexGroupsRepository.js';
import { KnexShiftManagementRepository } from '../../src/shift-management/infrastructure/KnexShiftManagementRepository.js';
import { KnexOneScriptRepository } from '../../src/one-script/infrastructure/persistence/KnexOneScriptRepository.js';
import ClassificationGroupMother from './domain/ClassificationGroupMother.js';
import OneScriptMother from '../one-script/domain/OneScriptMother.js';
import { GroupsMother } from '../grupos/domain/GroupsMother.js';
import { CLASSIFICATION_GROUP_RELATION_NOT_FOUND } from '@kace/error-codes';
import { knexConfig } from '../knexfile.js';
import { v4 as uuidv4 } from 'uuid';
import { CustomError } from '../../src/shared/errors/CustomError.js';

describe('ClassificationGroup Integration Tests', () => {
    const repository = new KnexClassificationGroupRelationshipRepository(knexConfig);
    const groupsRepository = new KnexGroupsRepository(repository.connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(repository.connection);
    const oneScriptRepository = new KnexOneScriptRepository(repository.connection);

    const idsValidator = {
        validateGroupIds: () => true,
        validateClassificationIds: () => true,
        validateOneScriptIds: () => true,
        validateRelation: () => true,
    };
    const batchCreator = new ClassificationGroupBatchCreator(repository, idsValidator);
    const batchDeleter = new ClassificationGroupBatchDeleter(repository, idsValidator);

    it('should create a ClassificationGroupRelationship', async () => {
        const dto = ClassificationGroupMother.dto();
        await ClassificationGroupMother.ensureRelations(repository.connection, dto);
        const classificationGroupCreator = new ClassificationGroupCreator(repository, idsValidator);

        await classificationGroupCreator.execute(dto);

        const result = await repository
            .connection(repository.tableName)
            .select('*')
            .where({ group_id: dto.group_id, classification_id: dto.classification_id });

        expect(result.length).toBe(1);
    });

    it('can find an existing ClassificationGroupRelationship', async () => {
        const classificationGroup = await ClassificationGroupMother.create(repository);
        const classificationGroupFinder = new ClassificationGroupFinder(repository);

        const classificationGroupResult = await classificationGroupFinder.execute(
            classificationGroup.group_id.value,
            classificationGroup.classification_id.value
        );

        expect(classificationGroupResult).not.toBeNull();
        expect(classificationGroupResult).toBeInstanceOf(ClassificationGroupResponse);
    });

    it('can delete an existing ClassificationGroupRelationship', async () => {
        const classificationGroup = await ClassificationGroupMother.create(repository);
        const classificationGroupDeleter = new ClassificationGroupDeleter(repository);
        await classificationGroupDeleter.execute(
            classificationGroup.classification_id.value,
            classificationGroup.group_id.value
        );

        const result = await repository.find(classificationGroup.group_id, classificationGroup.classification_id);
        expect(result).toBeNull();
    });

    it('searches for ClassificationGroupRelationships with given criteria with filter', async () => {
        const fakeGroupId = uuidv4();
        for (let i = 0; i < 10; i++) {
            await ClassificationGroupMother.create(repository, { group_id: fakeGroupId });
        }
        const dtoCriteria = {
            filter: [
                {
                    field: 'group_id',
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
        const classificationGroupSearch = new ClassificationGroupSearcher(repository);

        const classificationGroupResult = await classificationGroupSearch.execute(dtoCriteria);
        expect(classificationGroupResult).toBeInstanceOf(ClassificationGroupCollectionResponse);
    });

    it('searches for ClassificationGroupRelationships with given criteria with no filter', async () => {
        const group = await GroupsMother.createGroup(groupsRepository, shiftManagementRepository);
        const oneScript = await OneScriptMother.createOneScript(oneScriptRepository);

        for (let i = 0; i < 10; i++) {
            await ClassificationGroupMother.create(repository, { group_id: group.id.value, form: oneScript.id.value });
        }
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: null,
        };
        const classificationGroupSearch = new ClassificationGroupSearcher(repository);

        const classificationGroupResult = await classificationGroupSearch.execute(dtoCriteria);
        expect(classificationGroupResult).toBeInstanceOf(ClassificationGroupCollectionResponse);
        expect(classificationGroupResult.toJson().data.items[0]['group']['nombre']).toEqual(group.nombre.value);
        expect(classificationGroupResult.toJson().data.items[0]['one_script']['nombre']).toEqual(oneScript.name.value);
    });

    it('searches for ClassificationGroupRelationships with criteria that match no records', async () => {
        const dtoCriteria = {
            filter: [
                {
                    field: 'group_id',
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
        const classificationGroupSearch = new ClassificationGroupSearcher(repository);

        const classificationGroupResult = await classificationGroupSearch.execute(dtoCriteria);
        expect(classificationGroupResult).toBeInstanceOf(ClassificationGroupCollectionResponse);
        expect(classificationGroupResult.toJson().data.items.length).toBe(0);
    });

    it('should return empty when trying to find a ClassificationGroupRelationship with a non-existent ID', async () => {
        const classificationGroupFinder = new ClassificationGroupFinder(repository);

        const classificationGroupResult = await classificationGroupFinder.execute(uuidv4(), uuidv4());

        expect(classificationGroupResult).toEqual({});
    });

    it('should throw an error when creating a ClassificationGroupRelationship with invalid data', async () => {
        const invalidDto = ClassificationGroupMother.dto();
        delete invalidDto.group_id;
        const classificationGroupCreator = new ClassificationGroupCreator(repository);

        await expect(classificationGroupCreator.execute(invalidDto)).rejects.toThrow();
    });

    it('should not throw an error when deleting a non-existent ClassificationGroupRelationship', async () => {
        const classificationGroupDeleter = new ClassificationGroupDeleter(repository);
        const nonExistentId = uuidv4();

        await expect(classificationGroupDeleter.execute(nonExistentId, nonExistentId)).rejects.toThrow(
            `Relation with classificationId ${nonExistentId} and groupId ${nonExistentId} does not exist.`
        );

        try {
            await classificationGroupDeleter.execute(nonExistentId, nonExistentId);
        } catch (error) {
            expect(error.publicErrorCode).toBe(CLASSIFICATION_GROUP_RELATION_NOT_FOUND);
        }
    });

    it('should count ClassificationGroupRelationships correctly', async () => {
        for (let i = 0; i < 10; i++) {
            await ClassificationGroupMother.create(repository);
        }
        const counter = new ClassificationGroupCounter(repository);

        const count = await counter.execute({ filters: [], relationship: null });
        expect(Number(count.count)).toBe(10);
    });

    it('should create multiple ClassificationGroupRelationships in a batch successfully', async () => {
        const relationships = [];
        for (let i = 0; i < 5; i++) {
            const dto = ClassificationGroupMother.dto();
            await ClassificationGroupMother.ensureRelations(repository.connection, dto);
            relationships.push(dto);
        }
        await batchCreator.execute(relationships);

        const savedRelationships = await repository.connection(repository.tableName).select('*');
        expect(savedRelationships.length).toBe(5);
    });

    it('should rollback the transaction if an error occurs during creation', async () => {
        const relation = await ClassificationGroupMother.create(repository);
        const groupId = relation.group_id.value;
        const classificationId = relation.classification_id.value;
        const dto = [{ group_id: groupId, classification_id: classificationId }];

        await expect(batchCreator.execute(dto)).rejects.toThrow(new CustomError(`Batch creation failed`));

        const savedRelationships = await repository.connection(repository.tableName).select('*');
        expect(savedRelationships.length).toBe(1);
    });

    it('should handle an empty array of relationships gracefully', async () => {
        await expect(batchCreator.execute([])).resolves.not.toThrow();

        const savedRelationships = await repository.connection(repository.tableName).select('*');
        expect(savedRelationships.length).toBe(0);
    });

    it('should delete multiple ClassificationGroupRelationships in a batch successfully', async () => {
        const relationships = [];
        for (let i = 0; i < 5; i++) {
            const dto = ClassificationGroupMother.dto();
            relationships.push(dto);
            await ClassificationGroupMother.create(repository, dto);
        }

        await batchDeleter.execute(relationships);

        const savedRelationships = await repository.connection(repository.tableName).select('*');
        expect(savedRelationships.length).toBe(0);
    });

    it('should rollback the transaction if an error occurs during deletion', async () => {
        const relationships = [];
        for (let i = 0; i < 3; i++) {
            const dto = ClassificationGroupMother.dto();
            await ClassificationGroupMother.create(repository, dto);
            relationships.push(dto);
        }

        delete relationships[2].group_id;
        await expect(batchDeleter.execute(relationships)).rejects.toThrow('Batch deletion failed');

        const savedRelationships = await repository.connection(repository.tableName).select('*');
        expect(savedRelationships.length).toBe(3);
    });

    it('should handle an empty array of relationships gracefully', async () => {
        await expect(batchDeleter.execute([])).resolves.not.toThrow();

        const savedRelationships = await repository.connection(repository.tableName).select('*');
        expect(savedRelationships.length).toBe(0);
    });
});
