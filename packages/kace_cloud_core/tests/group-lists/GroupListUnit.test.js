import {
    GroupList,
    GroupListCollectionResponse,
    GroupListResponse,
    ValueObjectGroupLists,
} from '../../src/group-lists';
import { v4 as uuidv4 } from 'uuid';
import GroupListMother from './domain/GroupListMother';

describe('GroupList Entity', () => {
    const dto = GroupListMother.dto();

    it('should create a GroupList with valid data', () => {
        const groupList = GroupList.create(dto);
        expect(groupList.id.value).toBe(dto.id);
        expect(groupList.is_active.value).toBe(dto.is_active);
        expect(groupList.lista_grupos.value).toEqual(dto.lista_grupos);
    });

    it('should update GroupList data', () => {
        const groupList = GroupList.create(dto);
        const newDescripcion = 'Descripción actualizada';
        const newData = {
            descripcion: newDescripcion,
            lista_grupos: [{ id: uuidv4() }, { id: uuidv4() }],
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        groupList.update(newData);

        expect(groupList.descripcion.value).toBe(newDescripcion);
        expect(groupList.lista_grupos.value).toEqual(newData.lista_grupos);
        expect(groupList.changedAttributes).toEqual(newData);
    });

    it('should throw an error with invalid UUID', () => {
        const invalidData = { ...dto, id: 'invalid-uuid' };

        expect(() => GroupList.create(invalidData)).toThrow('Invalid value invalid-uuid for object uuid');
    });

    it('does not update properties when values are the same', () => {
        const groupList = GroupList.create(dto);
        const sameData = { ...dto };

        groupList.update(sameData);

        expect(groupList.changedAttributes).toEqual({});
    });

    it('marks a GroupList instance as deleted', () => {
        const groupList = GroupList.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };
        groupList.delete(deleteDto);

        expect(groupList.deleted_at.value).toBe(deleteDto.deleted_at);
        expect(groupList.deleted_by.value).toBe(deleteDto.deleted_by);
    });

    it('flushes changes in GroupList instance', () => {
        const groupList = GroupList.create(dto);
        const updateDto = {
            descripcion: 'Descripción actualizada',
            lista_grupos: [{ id: uuidv4() }, { id: uuidv4() }],
            is_active: 0,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        groupList.update(updateDto);
        groupList.flushChanges();

        expect(groupList.changedAttributes).toEqual({});
    });
});

describe('ValueObjectGroupList Tests', () => {
    it('should create an instance with a valid value', () => {
        const validValue = [{ id: uuidv4() }, { id: uuidv4() }];
        const valueObject = new ValueObjectGroupLists('groupsList', validValue);
        expect(valueObject).toBeInstanceOf(ValueObjectGroupLists);
    });

    it('should throw an error if the value is null, undefined, or empty', () => {
        const invalidValues = [null, undefined, ''];

        invalidValues.forEach((value) => {
            expect(() => new ValueObjectGroupLists('groupsList', value)).toThrow('The value cannot be null');
        });
    });

    it('should throw an error if any item in the array is missing an id', () => {
        const value = [{ id: uuidv4() }, { notId: 'Not-id' }];
        expect(() => new ValueObjectGroupLists('groupsList', value)).toThrow('Invalid groups list');
    });

    it('should throw an error if the id is invalid', () => {
        const value = [{ id: 'invalid-id' }];
        expect(() => new ValueObjectGroupLists('groupsList', value)).toThrow(
            'Invalid value invalid-id for object uuid'
        );
    });

    it('should not throw an error if all items have valid ids', () => {
        const validValue = [{ id: uuidv4() }, { id: uuidv4() }];
        expect(() => new ValueObjectGroupLists('groupsList', validValue)).not.toThrow();
    });
});

describe('GroupList Responses Tests', () => {
    it('converts GroupList object to JSON representation', () => {
        const groupList = new GroupList(GroupListMother.dto());
        const groupListResponse = new GroupListResponse(groupList);

        const json = groupListResponse.toJson();

        expect(json).toEqual({
            data: {
                id: groupList.id.value,
                descripcion: groupList.descripcion.value,
                lista_grupos: groupList.lista_grupos.value,
                is_active: groupList.is_active.value,
                created_at: groupList.created_at.value,
                updated_at: groupList.updated_at.value,
                created_by: groupList.created_by.value,
                updated_by: groupList.updated_by.value,
            },
        });
    });

    it('converts GroupListCollection to JSON representation', () => {
        const groupListCollection = [new GroupList(GroupListMother.dto()), new GroupList(GroupListMother.dto())];
        const groupListCollectionResponse = new GroupListCollectionResponse(
            groupListCollection,
            groupListCollection.length
        );

        const json = groupListCollectionResponse.toJson();

        expect(json).toEqual({
            data: {
                items: groupListCollection.map((groupList) => new GroupListResponse(groupList).toJson().data),
            },
            metadata: {
                count: groupListCollection.length,
            },
        });
    });
});
