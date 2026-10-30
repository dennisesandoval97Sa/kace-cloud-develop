import {
    ClassificationGroupCollectionResponse,
    ClassificationGroupRelationship,
    ClassificationGroupResponse,
} from '../../src/classification-group-relationships';
import { ValueObjectUuid } from '../../src/shared';
import ClassificationGroupRelationshipMother from './domain/ClassificationGroupMother';

describe('ClassificationGroupRelationship Entity', () => {
    const dto = ClassificationGroupRelationshipMother.dto();

    it('should create a classificationGroup with valid data', () => {
        const classificationGroup = ClassificationGroupRelationship.create(dto);
        expect(classificationGroup.group_id).toBeInstanceOf(ValueObjectUuid);
        expect(classificationGroup.classification_id).toBeInstanceOf(ValueObjectUuid);
        expect(classificationGroup.form.value).toBe(dto.form);
    });

    it('should throw an error with invalid UUID', () => {
        const invalidData = { ...dto, group_id: 'invalid-uuid' };

        expect(() => ClassificationGroupRelationship.create(invalidData)).toThrow(
            'Invalid value invalid-uuid for object uuid'
        );
    });
});

describe('ClassificationGroup Responses Tests', () => {
    it('converts ClassificationGroup object to JSON representation', () => {
        const classificationGroup = new ClassificationGroupRelationship(ClassificationGroupRelationshipMother.dto());
        const classificationGroupResponse = new ClassificationGroupResponse(classificationGroup);

        const json = classificationGroupResponse.toJson();

        expect(json.data).toHaveProperty('classification_id', classificationGroup.classification_id.value);
        expect(json.data).toHaveProperty('group_id', classificationGroup.group_id.value);
        expect(json.data).toHaveProperty('form', classificationGroup.form.value);
        expect(json.data).toHaveProperty('group', {});
        expect(json.data).toHaveProperty('one_script', {});
    });

    it('returns an empty object if ClassificationGroup is not provided', () => {
        const classificationGroupResponse = new ClassificationGroupResponse(null);
        expect(classificationGroupResponse.toJson()).toEqual({});
    });

    it('converts ClassificationGroupCollection to JSON representation', () => {
        const classificationGroupCollection = [
            new ClassificationGroupRelationship(ClassificationGroupRelationshipMother.dto()),
            new ClassificationGroupRelationship(ClassificationGroupRelationshipMother.dto()),
        ];
        const classificationGroupCollectionResponse = new ClassificationGroupCollectionResponse(
            classificationGroupCollection,
            classificationGroupCollection.length
        );

        expect(classificationGroupCollectionResponse.toJson()).toEqual({
            data: {
                items: classificationGroupCollection.map(
                    (classificationGroup) => new ClassificationGroupResponse(classificationGroup).toJson().data
                ),
            },
            metadata: {
                count: classificationGroupCollection.length,
            },
        });
    });
});
