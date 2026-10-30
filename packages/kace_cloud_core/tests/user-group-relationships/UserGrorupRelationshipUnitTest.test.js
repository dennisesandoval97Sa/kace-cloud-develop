import {
    UserGroupRelationship,
    UserGroupResponse,
    UserGroupCollectionResponse,
} from '../../src/user-group-relationships';
import { ValueObjectUuid } from '../../src/shared';
import UserGroupRelationshipMother from './domain/UserGroupRelationshipMother';

describe('UserGrorupRelationship Entity', () => {
    const dto = UserGroupRelationshipMother.dto();

    it('should create a userGroup with valid data', () => {
        const userGroup = UserGroupRelationship.create(dto);
        expect(userGroup.usuario_id).toBeInstanceOf(ValueObjectUuid);
        expect(userGroup.grupo_id).toBeInstanceOf(ValueObjectUuid);
    });

    it('should throw an error with invalid UUID', () => {
        const invalidData = { ...dto, usuario_id: 'invalid-uuid' };

        expect(() => UserGroupRelationship.create(invalidData)).toThrow('Invalid value invalid-uuid for object uuid');
    });
});

describe('UserGroup Responses Tests', () => {
    it('converts UserGroup object to JSON representation', () => {
        const userGroup = new UserGroupRelationship(UserGroupRelationshipMother.dto());
        const userGroupResponse = new UserGroupResponse(userGroup);

        const json = userGroupResponse.toJson();

        expect(json).toEqual({
            data: {
                grupo: {},
                usuario: {},
                usuario_id: userGroup.usuario_id.value,
                grupo_id: userGroup.grupo_id.value,
            },
        });
    });

    it('returns an empty object if UserGroup is not provided', () => {
        const userGroupResponse = new UserGroupResponse(null);
        expect(userGroupResponse.toJson()).toEqual({});
    });

    it('converts UserGroupCollection to JSON representation', () => {
        const userGroupCollection = [
            new UserGroupRelationship(UserGroupRelationshipMother.dto()),
            new UserGroupRelationship(UserGroupRelationshipMother.dto()),
        ];
        const userGroupCollectionResponse = new UserGroupCollectionResponse(
            userGroupCollection,
            userGroupCollection.length
        );

        expect(userGroupCollectionResponse.toJson()).toEqual({
            data: {
                items: userGroupCollection.map((userGroup) => new UserGroupResponse(userGroup).toJson().data),
            },
            metadata: {
                count: userGroupCollection.length,
            },
        });
    });
});
