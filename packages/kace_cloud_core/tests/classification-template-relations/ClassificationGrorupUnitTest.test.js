import {
    ClassificationTemplateCollectionResponse,
    ClassificationTemplateRelations,
    ClassificationTemplateResponse,
} from '../../src/classification-template-relations';
import { ValueObjectUuid } from '../../src/shared';
import ClassificationTemplateMother from './domain/ClassificationTemplateMother';

describe('ClassificationTemplateRelations Entity', () => {
    const dto = ClassificationTemplateMother.dto();

    it('should create a classificationTemplate with valid data', () => {
        const classificationTemplate = ClassificationTemplateRelations.create(dto);
        expect(classificationTemplate.template_id).toBeInstanceOf(ValueObjectUuid);
        expect(classificationTemplate.classification_id).toBeInstanceOf(ValueObjectUuid);
    });

    it('should throw an error with invalid UUID', () => {
        const invalidData = { ...dto, template_id: 'invalid-uuid' };

        expect(() => ClassificationTemplateRelations.create(invalidData)).toThrow(
            'Invalid value invalid-uuid for object uuid'
        );
    });
});

describe('ClassificationTemplate Responses Tests', () => {
    it('converts ClassificationTemplate object to JSON representation', () => {
        const classificationTemplate = new ClassificationTemplateRelations(ClassificationTemplateMother.dto());
        const classificationTemplateResponse = new ClassificationTemplateResponse(classificationTemplate);

        const json = classificationTemplateResponse.toJson();

        expect(json).toEqual({
            data: {
                template_id: classificationTemplate.template_id.value,
                classification_id: classificationTemplate.classification_id.value,
            },
        });
    });

    it('returns an empty object if ClassificationTemplate is not provided', () => {
        const classificationTemplateResponse = new ClassificationTemplateResponse(null);
        expect(classificationTemplateResponse.toJson()).toEqual({});
    });

    it('converts ClassificationTemplateCollection to JSON representation', () => {
        const classificationTemplateCollection = [
            new ClassificationTemplateRelations(ClassificationTemplateMother.dto()),
            new ClassificationTemplateRelations(ClassificationTemplateMother.dto()),
        ];
        const classificationTemplateCollectionResponse = new ClassificationTemplateCollectionResponse(
            classificationTemplateCollection,
            classificationTemplateCollection.length
        );

        expect(classificationTemplateCollectionResponse.toJson()).toEqual({
            data: {
                items: classificationTemplateCollection.map(
                    (classificationTemplate) => new ClassificationTemplateResponse(classificationTemplate).toJson().data
                ),
            },
            metadata: {
                count: classificationTemplateCollection.length,
            },
        });
    });
});
