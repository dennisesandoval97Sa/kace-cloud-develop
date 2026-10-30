import {
    GroupList,
    GroupListCreator,
    GroupListUpdater,
    GroupListDeleter,
    GroupListFinder,
    GroupListSearcher,
    GroupListResponse,
    GroupListValidator,
    KnexGroupListsRepository,
    GroupListCounter,
} from '../../src/group-lists';
import { KnexGroupsRepository } from '../../src/grupos';
import { knexConfig } from '../knexfile.js';
import { v4 as uuidv4 } from 'uuid';
import { GroupsMother } from '../grupos/domain/GroupsMother.js';
import GroupListMother from './domain/GroupListMother.js';
import { KnexShiftManagementRepository } from '../../src/shift-management/index.js';
import { CustomError } from '../../src/shared/index.js';

describe('GroupList Integration Tests', () => {
    const repository = new KnexGroupListsRepository(knexConfig);
    const groupRepository = new KnexGroupsRepository(repository.connection);
    const groupListValidator = new GroupListValidator(groupRepository);
    const shiftManagementRepository = new KnexShiftManagementRepository(repository.connection);

    it('should create a GroupList', async () => {
        const group1 = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);

        const dto = GroupListMother.dto(group1);

        const groupListCreator = new GroupListCreator(repository, groupListValidator);
        await groupListCreator.execute(dto);

        const result = await repository.connection('lista_grupos').select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('can get an existing group list', async () => {
        const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
        const groupList = await GroupListMother.createGroupList(repository, group);
        const groupListFinder = new GroupListFinder(repository);

        const groupListResult = await groupListFinder.execute(groupList.id.value);

        expect(groupListResult).not.toBeNull();
        expect(groupListResult).toBeInstanceOf(GroupListResponse);
    });

    it('can update an existing group list', async () => {
        const groupList = await GroupListMother.createGroupList(repository);
        const groupListUpdater = new GroupListUpdater(repository);

        const newValues = { descripcion: 'Updated description' };
        await groupListUpdater.execute(groupList.id.value, newValues);

        const result = await repository.find(groupList.id);
        expect(result).toBeInstanceOf(GroupList);
        expect(result.descripcion.value).toBe(newValues.descripcion);
    });

    it('can delete an existing group list', async () => {
        const groupList = await GroupListMother.createGroupList(repository);
        const groupListDeleter = new GroupListDeleter(repository);

        await groupListDeleter.execute(groupList.id.value, {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        });

        const result = await repository.find(groupList.id);
        expect(result).toBeInstanceOf(GroupList);
        expect(result.deleted_at.value).not.toBeNull();
        expect(result.deleted_by.value).not.toBeNull();
    });

    it('searches for GroupList instances with given criteria with filter', async () => {
        for (let i = 0; i < 10; i++) {
            await GroupListMother.createGroupList(repository);
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
        const groupListSearcher = new GroupListSearcher(repository);

        const groupListResult = await groupListSearcher.execute(dtoCriteria);
        expect(groupListResult.toJson().data.items.length).toBeGreaterThan(0);
    });

    it('should return empty when trying to find a group list with a non-existent ID', async () => {
        const groupListFinder = new GroupListFinder(repository);

        await expect(groupListFinder.execute(uuidv4())).rejects.toThrow(CustomError);
    });

    it('should throw an error when creating a GroupList with invalid data', async () => {
        const invalidDto = GroupListMother.dto();
        delete invalidDto.id;
        const groupListCreator = new GroupListCreator(repository);

        await expect(groupListCreator.execute(invalidDto)).rejects.toThrow();
    });

    it('should throw an error when trying to update a non-existent group list', async () => {
        const groupListUpdater = new GroupListUpdater(repository);
        const nonExistentId = uuidv4();
        const newValues = { descripcion: 'updated description' };

        await expect(groupListUpdater.execute(nonExistentId, newValues)).rejects.toThrow();
    });

    it('should throw an error when deleting a non-existent group list', async () => {
        const groupListDeleter = new GroupListDeleter(repository);
        const nonExistentId = uuidv4();

        await expect(
            groupListDeleter.execute(nonExistentId, { deleted_at: new Date().toISOString(), deleted_by: uuidv4() })
        ).rejects.toThrow();
    });

    it('should handle creating multiple group lists with the same ID', async () => {
        const group = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
        const dto = GroupListMother.dto(group);
        const groupListCreator = new GroupListCreator(repository, groupListValidator);

        await groupListCreator.execute(dto);

        await expect(groupListCreator.execute(dto)).rejects.toThrow(Error);
    });

    it('should count groupLists correctly', async () => {
        const { id: groupId } = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
        for (let i = 0; i < 10; i++) {
            await GroupListMother.createGroupList(repository, { id: groupId });
        }
        const counter = new GroupListCounter(repository);

        const count = await counter.execute({ filters: [], relationship: null });
        expect(count).toBe(10);
    });

    it('should throw an error when creating a GroupList with a duplicate descripcion', async () => {
        const group1 = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
        const dto1 = GroupListMother.dto(group1);
        const dto2 = GroupListMother.dto(group1);
        dto2.descripcion = dto1.descripcion;

        const groupListCreator = new GroupListCreator(repository, groupListValidator);

        await groupListCreator.execute(dto1);

        await expect(groupListCreator.execute(dto2)).rejects.toThrow(
            `The following value(s) already exist: descripcion '${dto1.descripcion}'.`
        );
    });

    it('should throw an error when updating a GroupList to have a duplicate descripcion', async () => {
        const group1 = await GroupsMother.createGroup(groupRepository, shiftManagementRepository);
        const groupList1 = await GroupListMother.createGroupList(repository, group1);
        const groupList2 = await GroupListMother.createGroupList(repository, group1);

        const groupListUpdater = new GroupListUpdater(repository);

        await expect(
            groupListUpdater.execute(groupList2.id.value, { descripcion: groupList1.descripcion.value })
        ).rejects.toThrow(`The following value(s) already exist: descripcion '${groupList1.descripcion.value}'.`);
    });
});
