import { UserList, UserListResponse, UserListCollectionResponse, ValueObjectUserLists } from '../../src/user-lists';
import { v4 as uuidv4 } from 'uuid';
import UserListMother from './domain/UserListMother';

describe('UserList Entity', () => {
    const dto = UserListMother.dto();

    it('should create a UserList with valid data', () => {
        const userList = UserList.create(dto);
        expect(userList.id.value).toBe(dto.id);
        expect(userList.is_active.value).toBe(dto.is_active);
        expect(userList.lista_usuarios.value).toEqual(dto.lista_usuarios);
    });

    it('should update UserList data', () => {
        const userList = UserList.create(dto);
        const newDescripcion = 'Descripción actualizada';
        const newData = {
            descripcion: newDescripcion,
            lista_usuarios: [{ id: uuidv4() }, { id: uuidv4() }],
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        userList.update(newData);

        expect(userList.descripcion.value).toBe(newDescripcion);
        expect(userList.lista_usuarios.value).toEqual(newData.lista_usuarios);
        expect(userList.changedAttributes).toEqual({
            descripcion: newData.descripcion,
            lista_usuarios: JSON.stringify(newData.lista_usuarios),
            updated_at: newData.updated_at,
            updated_by: newData.updated_by,
        });
    });

    it('should throw an error with invalid UUID', () => {
        const invalidData = { ...dto, id: 'invalid-uuid' };

        expect(() => UserList.create(invalidData)).toThrow('Invalid value invalid-uuid for object uuid');
    });

    it('does not update properties when values are the same', () => {
        const userList = UserList.create(dto);
        const sameData = { ...dto };

        userList.update(sameData);

        expect(userList.changedAttributes).toEqual({});
    });

    it('marks a UserList instance as deleted', () => {
        const userList = UserList.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };
        userList.delete(deleteDto);

        expect(userList.deleted_at.value).toBe(deleteDto.deleted_at);
        expect(userList.deleted_by.value).toBe(deleteDto.deleted_by);
    });

    it('flushes changes in UserList instance', () => {
        const userList = UserList.create(dto);
        const updateDto = {
            descripcion: 'Descripción actualizada',
            lista_usuarios: [{ id: uuidv4() }, { id: uuidv4() }],
            is_active: 0,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        userList.update(updateDto);
        userList.flushChanges();

        expect(userList.changedAttributes).toEqual({});
    });
});

describe('ValueObjectUserLists Tests', () => {
    it('should create an instance with a valid value', () => {
        const validValue = [{ id: uuidv4() }, { id: uuidv4() }];
        const valueObject = new ValueObjectUserLists('userList', validValue);
        expect(valueObject).toBeInstanceOf(ValueObjectUserLists);
    });

    it('should throw an error if the value is null, undefined, or empty', () => {
        const invalidValues = [null, undefined, ''];

        invalidValues.forEach((value) => {
            expect(() => new ValueObjectUserLists('userList', value)).toThrow('The value cannot be null');
        });
    });

    it('should throw an error if any item in the array is missing an id', () => {
        const value = [{ id: uuidv4() }, { notId: 'Not-id' }];
        expect(() => new ValueObjectUserLists('userList', value)).toThrow('Invalid user list');
    });

    it('should throw an error if the id is invalid', () => {
        const value = [{ id: 'invalid-id' }];
        expect(() => new ValueObjectUserLists('userList', value)).toThrow('Invalid value invalid-id for object uuid');
    });

    it('should not throw an error if all items have valid ids', () => {
        const validValue = [{ id: uuidv4() }, { id: uuidv4() }];
        expect(() => new ValueObjectUserLists('userList', validValue)).not.toThrow();
    });
});

describe('UserList Responses Tests', () => {
    it('converts UserList object to JSON representation', () => {
        const userList = new UserList(UserListMother.dto());
        const userListResponse = new UserListResponse(userList);

        const json = userListResponse.toJson();

        expect(json).toEqual({
            data: {
                id: userList.id.value,
                descripcion: userList.descripcion.value,
                group_id: userList.group_id.value,
                lista_usuarios: userList.lista_usuarios.value,
                is_active: userList.is_active.value,
                created_at: userList.created_at.value,
                updated_at: userList.updated_at.value,
                created_by: userList.created_by.value,
                updated_by: userList.updated_by.value,
            },
        });
    });

    it('converts UserListCollection to JSON representation', () => {
        const userListCollection = [new UserList(UserListMother.dto()), new UserList(UserListMother.dto())];
        const userListCollectionResponse = new UserListCollectionResponse(
            userListCollection,
            userListCollection.length
        );

        const json = userListCollectionResponse.toJson();

        expect(json).toEqual({
            data: {
                items: userListCollection.map((userList) => new UserListResponse(userList).toJson().data),
            },
            metadata: {
                count: userListCollection.length,
            },
        });
    });
});
