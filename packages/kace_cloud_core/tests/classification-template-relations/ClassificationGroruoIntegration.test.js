import {
    ClassificationTemplateBatchCreator,
    ClassificationTemplateBatchDeleter,
    ClassificationTemplateCollectionResponse,
    ClassificationTemplateCounter,
    ClassificationTemplateCreator,
    ClassificationTemplateDeleter,
    ClassificationTemplateFinder,
    ClassificationTemplateResponse,
    ClassificationTemplateSearcher,
    KnexClassificationTemplateRelationsRepository,
} from '../../src/classification-template-relations/index.js';
import ClassificationTemplateMother from './domain/ClassificationTemplateMother.js';
import { knexConfig } from '../knexfile.js';
import { v4 as uuidv4 } from 'uuid';
import { CustomError } from '../../src/shared/errors/CustomError.js';

describe('ClassificationTemplate Integration Tests', () => {
    const repository = new KnexClassificationTemplateRelationsRepository(knexConfig);
    const idsValidator = {
        validateTemplateIds: () => true,
        validateClassificationIds: () => true,
    };
    const batchCreator = new ClassificationTemplateBatchCreator(repository, idsValidator);
    const batchDeleter = new ClassificationTemplateBatchDeleter(repository, idsValidator);

    it('should create a ClassificationTemplateRelationship', async () => {
        const dto = ClassificationTemplateMother.dto();
        // El dto va al caso de uso sin pasar por `create`, que es quien
        // respalda la clasificacion y la plantilla.
        await ClassificationTemplateMother.ensureRelations(repository.connection, dto);
        const classificationTemplateCreator = new ClassificationTemplateCreator(repository, idsValidator);

        await classificationTemplateCreator.execute(dto);

        const result = await repository
            .connection(repository.tableName)
            .select('*')
            .where({ template_id: dto.template_id, classification_id: dto.classification_id });

        expect(result.length).toBe(1);
    });

    it('can find an existing ClassificationTemplateRelationship', async () => {
        const classificationTemplate = await ClassificationTemplateMother.create(repository);
        const classificationTemplateFinder = new ClassificationTemplateFinder(repository);

        const classificationTemplateResult = await classificationTemplateFinder.execute(
            classificationTemplate.template_id.value,
            classificationTemplate.classification_id.value
        );

        expect(classificationTemplateResult).not.toBeNull();
        expect(classificationTemplateResult).toBeInstanceOf(ClassificationTemplateResponse);
    });

    it('can delete an existing ClassificationTemplateRelationship', async () => {
        const classificationTemplate = await ClassificationTemplateMother.create(repository);
        const classificationTemplateDeleter = new ClassificationTemplateDeleter(repository);
        await classificationTemplateDeleter.execute(
            classificationTemplate.classification_id.value,
            classificationTemplate.template_id.value
        );

        const result = await repository.find(
            classificationTemplate.template_id,
            classificationTemplate.classification_id
        );
        expect(result).toBeNull();
    });

    it('searches for ClassificationTemplateRelationships with given criteria with filter', async () => {
        const fakeTemplateId = uuidv4();
        for (let i = 0; i < 10; i++) {
            await ClassificationTemplateMother.create(repository, { template_id: fakeTemplateId });
        }
        const dtoCriteria = {
            filter: [
                {
                    field: 'template_id',
                    operator: 'eq',
                    value: fakeTemplateId,
                    type: 'and',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: null,
        };
        const classificationTemplateSearch = new ClassificationTemplateSearcher(repository);

        const classificationTemplateResult = await classificationTemplateSearch.execute(dtoCriteria);
        expect(classificationTemplateResult).toBeInstanceOf(ClassificationTemplateCollectionResponse);
    });

    it('searches for ClassificationTemplateRelationships with criteria that match no records', async () => {
        const dtoCriteria = {
            filter: [
                {
                    field: 'template_id',
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
        const classificationTemplateSearch = new ClassificationTemplateSearcher(repository);

        const classificationTemplateResult = await classificationTemplateSearch.execute(dtoCriteria);
        expect(classificationTemplateResult).toBeInstanceOf(ClassificationTemplateCollectionResponse);
        expect(classificationTemplateResult.toJson().data.items.length).toBe(0);
    });

    it('should return empty when trying to find a ClassificationTemplateRelationship with a non-existent ID', async () => {
        const classificationTemplateFinder = new ClassificationTemplateFinder(repository);

        const classificationTemplateResult = await classificationTemplateFinder.execute(uuidv4(), uuidv4());

        expect(classificationTemplateResult).toEqual({});
    });

    it('should throw an error when creating a ClassificationTemplateRelationship with invalid data', async () => {
        const invalidDto = ClassificationTemplateMother.dto();
        delete invalidDto.template_id;
        const classificationTemplateCreator = new ClassificationTemplateCreator(repository);

        await expect(classificationTemplateCreator.execute(invalidDto)).rejects.toThrow();
    });

    it('should not throw an error when deleting a non-existent ClassificationTemplateRelationship', async () => {
        const classificationTemplateDeleter = new ClassificationTemplateDeleter(repository);
        const nonExistentId = uuidv4();

        await expect(classificationTemplateDeleter.execute(nonExistentId, nonExistentId)).rejects.toThrow(
            `Relation with classificationId ${nonExistentId} and templateId ${nonExistentId} does not exist.`
        );
    });

    it('should count ClassificationTemplateRelationships correctly', async () => {
        for (let i = 0; i < 10; i++) {
            await ClassificationTemplateMother.create(repository);
        }
        const counter = new ClassificationTemplateCounter(repository);

        const count = await counter.execute({ filters: [], relationship: null });
        expect(Number(count.count)).toBe(10);
    });

    it('should create multiple ClassificationTemplateRelationships in a batch successfully', async () => {
        const relationships = [];
        for (let i = 0; i < 5; i++) {
            const dto = ClassificationTemplateMother.dto();
            await ClassificationTemplateMother.ensureRelations(repository.connection, dto);
            relationships.push(dto);
        }
        await batchCreator.execute(relationships);

        const savedRelationships = await repository.connection(repository.tableName).select('*');
        expect(savedRelationships.length).toBe(5);
    });

    it('should rollback the transaction if an error occurs during creation', async () => {
        const relation = await ClassificationTemplateMother.create(repository);
        const templateId = relation.template_id.value;
        const classificationId = relation.classification_id.value;
        const dto = [{ template_id: templateId, classification_id: classificationId }];

        await expect(batchCreator.execute(dto)).rejects.toThrow(new CustomError(`Batch creation failed`));

        const savedRelationships = await repository.connection(repository.tableName).select('*');
        expect(savedRelationships.length).toBe(1);
    });

    it('should handle an empty array of relationships gracefully', async () => {
        await expect(batchCreator.execute([])).resolves.not.toThrow();

        const savedRelationships = await repository.connection(repository.tableName).select('*');
        expect(savedRelationships.length).toBe(0);
    });

    it('should delete multiple ClassificationTemplateRelationships in a batch successfully', async () => {
        const relationships = [];
        for (let i = 0; i < 5; i++) {
            const dto = ClassificationTemplateMother.dto();
            relationships.push(dto);
            await ClassificationTemplateMother.create(repository, dto);
        }

        await batchDeleter.execute(relationships);

        const savedRelationships = await repository.connection(repository.tableName).select('*');
        expect(savedRelationships.length).toBe(0);
    });

    it('should rollback the transaction if an error occurs during deletion', async () => {
        const relationships = [];
        for (let i = 0; i < 3; i++) {
            const dto = ClassificationTemplateMother.dto();
            await ClassificationTemplateMother.create(repository, dto);
            relationships.push(dto);
        }

        delete relationships[2].template_id;
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
