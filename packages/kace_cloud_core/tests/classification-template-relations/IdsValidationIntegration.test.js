import {
    IdsValidator,
    KnexClassificationTemplateRelationsRepository,
} from '../../src/classification-template-relations';
import { KnexClassificationRepository } from '../../src/classifications';
import { knexConfig } from '../knexfile.js';
import { KnexTemplatesRepository } from '../../src/templates/index.js';
import { v4 as uuidv4 } from 'uuid';
import ClassificationsMother from '../classifications/domain/ClassificationsMother.js';
import TemplatesMother from '../templates/domain/TemplatesMother.js';

describe('IdsValidator Integration Tests', () => {
    const classificationTemplateRepository = new KnexClassificationTemplateRelationsRepository(knexConfig);
    const classificationRepository = new KnexClassificationRepository(knexConfig);
    const templateRepository = new KnexTemplatesRepository(knexConfig);
    const idsValidator = new IdsValidator(classificationRepository, templateRepository);

    it('should validate that all classification IDs exist', async () => {
        const classifications = [];
        for (let i = 0; i < 3; i++) {
            const dto = ClassificationsMother.dto();
            await ClassificationsMother.createClassification(classificationRepository, dto);
            classifications.push(dto);
        }

        const classificationIds = classifications.map((classification) => classification.id);
        await expect(idsValidator.validateClassificationIds(classificationIds)).resolves.not.toThrow();
    });

    it('should throw an error if one or more classification IDs do not exist', async () => {
        const classifications = [];
        for (let i = 0; i < 2; i++) {
            const dto = ClassificationsMother.dto();
            await ClassificationsMother.createClassification(classificationRepository, dto);
            classifications.push(dto);
        }

        const nonExistentClassificationId = uuidv4();
        const classificationIds = classifications.map((classification) => classification.id);
        classificationIds.push(nonExistentClassificationId);

        await expect(idsValidator.validateClassificationIds(classificationIds)).rejects.toThrow(
            'One or more IDs do not exist'
        );
    });

    it('should validate that all template IDs exist', async () => {
        const templateIds = [];
        for (let i = 0; i < 3; i++) {
            const template = await TemplatesMother.createTemplate(templateRepository);
            templateIds.push(template.id.value);
        }
        await expect(idsValidator.validateTemplateIds(templateIds)).resolves.not.toThrow();
    });

    it('should throw an error if one or more template IDs do not exist', async () => {
        const templateIds = [];
        for (let i = 0; i < 2; i++) {
            const template = await TemplatesMother.createTemplate(templateRepository);
            templateIds.push(template.id.value);
        }

        const nonExistentTemplateId = uuidv4();
        templateIds.push(nonExistentTemplateId);

        await expect(idsValidator.validateTemplateIds(templateIds)).rejects.toThrow('One or more IDs do not exist');
    });
});
