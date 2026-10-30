import { CustomError } from '../../../shared/errors/CustomError.js';
import { ClassificationTemplateRelations, DomainClassificationTemplateFinder } from '../../index.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';

export class ClassificationTemplateBatchCreator {
    /**
     * @type {KnexClassificationTemplateRelationsRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * @type {DomainClassificationTemplateFinder}
     * is initialized in the constructor
     */
    #finder;

    /**
     * @type {IdsValidator}
     * is initialized in the constructor
     */
    #idsValidator;

    /**
     * Creates an instance of `ClassificationTemplateBatchCreator`.
     *
     * @param {KnexClassificationTemplateRelationsRepository} repository - The repository used to save classification-template relationships.
     * @param {IdsValidator} idsValidator - The validator used to validate IDs.
     */
    constructor(repository, idsValidator) {
        this.#repository = repository;
        this.#finder = new DomainClassificationTemplateFinder(repository);
        this.#idsValidator = idsValidator;
    }

    /**
     * Handles batch creation of Classification-Template relationships.
     *
     * @param {Object[]} dto - List of classification-template relationship data.
     *   - `classification_id` (string): The unique identifier of the classification in the relationship.
     *   - `template_id` (string): The unique identifier of the template in the relationship.
     * @returns {Promise<void>}
     */
    async execute(dto) {
        if (!Array.isArray(dto) || dto.length === 0) return;

        const classificationIds = dto.map((rel) => rel.classification_id);
        const templateIds = dto.map((rel) => rel.template_id);

        await this.#idsValidator.validateClassificationIds(classificationIds);
        await this.#idsValidator.validateTemplateIds(templateIds);
        const transaction = await this.#repository.startTransaction();

        try {
            for (const relationship of dto) {
                const relation = ClassificationTemplateRelations.create(relationship);
                await this.#checkRelationExists(
                    relation.classification_id.value,
                    relation.template_id.value,
                    transaction
                );
                await this.#repository.save(relation, transaction);
            }
            await transaction.commit();
        } catch (error) {
            const errorMessage = 'Batch creation failed';
            Helper.logError(`${errorMessage}:`, error);
            await transaction.rollback();
            throw new Error(`${errorMessage}`);
        }
    }

    async #checkRelationExists(classificationId, templateId, trx) {
        const result = await this.#finder.execute(classificationId, templateId, trx);
        if (result) {
            throw new CustomError(
                `Relation with classificationId ${classificationId} and templateId ${templateId} already exists.`,
                400
            );
        }
    }
}
