import { UniquenessValidator } from '../../../shared';
import { CustomError } from '../../../shared/errors/CustomError';
import { Classification, DomainClassificationFinder } from '../../index';
import { ValidationFailError } from '../../../shared/errors/ValidationFailError';
import { ClassificationsValidator } from '../../domain/ClassificationsValidator';
import { BuildDescriptionService } from '../../domain/BuildDescriptionService ';
import { InvalidArgumentError } from '../../../shared/errors/InvalidArgumentError.js';
import { ClassificationTemplateRelations } from '../../../classification-template-relations/domain/ClassificationTemplateRelations.js';
import { CLASSIFICATION_CREATE_TEMPLATES_NOT_FOUND } from '@kace/error-codes';

export class ClassificationCreator {
    /** @type {KnexClassificationRepository} is initialized in the constructor*/
    #repository;
    /** @type {DomainClassificationFinder} is initialized in the constructor*/
    #finder;
    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;
    /** @type {ClassificationsValidator} is initialized in the constructor */
    #classificationsValidator;
    /** @type {KnexClassificationTemplateRelationsRepository | null} */
    #classificationTemplateRepository;
    /** @type {IdsValidator | null} */
    #templateIdsValidator;

    constructor(repository, classificationTemplateRepository = null, templateIdsValidator = null) {
        this.#repository = repository;
        this.#finder = new DomainClassificationFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
        this.#classificationsValidator = new ClassificationsValidator(repository);
        this.#classificationTemplateRepository = classificationTemplateRepository;
        this.#templateIdsValidator = templateIdsValidator;
    }

    /**
     * Executes the process of creating a new classification.
     * @param {Object} dto - The data transfer object containing the properties for the Classification object.
     * @param {string} dto.id - The ID of the classification.
     * @param {string} dto.nivel1 - The level 1 of the classification.
     * @param {string} dto.nivel2 - The level 2 of the classification.
     * @param {string} dto.nivel3 - Level 3 of the classification.
     * @param {string} dto.nivel4 - Level 4 of the classification.
     * @param {string} dto.nivel5 - Level 5 of the classification.
     * @param {string} dto.nivel6 - Level 6 of the classification.
     * @param {string} dto.nivel7 - Level 7 of the classification.
     * @param {string} dto.nivel8 - Level 8 of the classification.
     * @param {string} dto.nivel9 - Level 9 of the classification.
     * @param {string} dto.nivel10 - Level 10 of the classification.
     * @param {string} dto.flujo_id - The ID of the associated flow.
     * @param {string} dto.ans_id - The ID of the associated ans.
     * @param {number} dto.status - The status of the classification.
     * @param {string} dto.created_by - The ID of the creator.
     * @returns {Promise<void>}
     */
    async execute(dto) {
        const templateIds = this.#normalizeTemplateIds(dto.template_ids);
        const isProductCreate = Boolean(this.#classificationTemplateRepository);
        if (isProductCreate) {
            if (!this.#templateIdsValidator) {
                throw new Error('templateIdsValidator is required when creating classifications with templates');
            }
            try {
                await this.#templateIdsValidator.validateTemplateIds(templateIds);
            } catch (error) {
                if (error instanceof InvalidArgumentError) {
                    throw new ValidationFailError(
                        'One or more template_ids do not exist',
                        'template_ids',
                        [],
                        CLASSIFICATION_CREATE_TEMPLATES_NOT_FOUND
                    );
                }
                throw error;
            }
        }

        const { template_ids: _templateIds, ...classificationDto } = dto;
        const payload = { ...classificationDto, description: BuildDescriptionService(classificationDto) };

        const classification = new Classification(payload);

        const result = await this.#finder.execute(classification.id.value);
        if (result) {
            throw new CustomError(`Classification with id ${classification.id.value} already exists`, 400);
        }

        const uniquenessFields = this.#prepareUniquenessFields(classificationDto);
        await this.#uniquenessValidator.validateMultiple(uniquenessFields);

        const classificationsIds = classification.getClassificationsIds();
        const IsValidClassifications = await this.#classificationsValidator.execute(classificationsIds);

        if (!IsValidClassifications)
            throw new ValidationFailError(
                `one of classification | SubClassification does not exist`,
                'classification_id'
            );
        const relations = classification.getClassificationRelations();

        if (isProductCreate) {
            await this.#repository.withTransaction(async (trx) => {
                await this.#repository.save(classification, trx);
                await this.#repository.saveHistory(classification, null, trx);
                if (relations?.length) {
                    await this.#repository.saveRelations(relations, trx);
                }
                for (const templateId of templateIds) {
                    const relationship = ClassificationTemplateRelations.create({
                        classification_id: classification.id.value,
                        template_id: templateId,
                    });
                    await this.#classificationTemplateRepository.save(relationship, trx);
                }
            });
            return;
        }

        if (relations && relations.length > 0) {
            await this.#repository.saveRelations(relations);
        }
        await this.#repository.save(classification);
        await this.#repository.saveHistory(classification);
    }

    #normalizeTemplateIds(templateIds) {
        if (!Array.isArray(templateIds)) {
            return [];
        }
        return [...new Set(templateIds.filter(Boolean))];
    }

    #prepareUniquenessFields(dto) {
        const fields = [
            'nivel1',
            'nivel2',
            'nivel3',
            'nivel4',
            'nivel5',
            'nivel6',
            'nivel7',
            'nivel8',
            'nivel9',
            'nivel10',
        ];

        return fields.map((field) => ({
            field,
            value: dto[field] ?? null,
        }));
    }
}
