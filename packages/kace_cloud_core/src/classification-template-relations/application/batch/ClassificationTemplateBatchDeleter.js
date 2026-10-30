import { CustomError } from '../../../shared/errors/CustomError.js';
import { ClassificationTemplateRelations, DomainClassificationTemplateFinder } from '../../index.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';

export class ClassificationTemplateBatchDeleter {
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
     * Creates an instance of `ClassificationTemplateBatchDeleter`.
     *
     * @param {KnexClassificationTemplateRelationsRepository} repository - The repository used to manage classification-template relationships.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainClassificationTemplateFinder(repository);
    }

    /**
     * Handles batch deletion of Classification-Template relationships.
     *
     * @param {Object[]} classificationTemplateRelationships - List of ClassificationTemplateRelations data to delete.
     *   - `classification_id` (string): The unique identifier of the classification in the relationship.
     *   - `template_id` (string): The unique identifier of the template in the relationship.
     * @returns {Promise<void>}
     */
    async execute(classificationTemplateRelationships) {
        if (!Array.isArray(classificationTemplateRelationships) || classificationTemplateRelationships.length === 0)
            return;

        const transaction = await this.#repository.startTransaction();

        try {
            for (const relationship of classificationTemplateRelationships) {
                const relation = ClassificationTemplateRelations.create(relationship);
                await this.#checkRelationExists(
                    relation.classification_id.value,
                    relation.template_id.value,
                    transaction
                );
                await this.#repository.delete(relation, transaction);
            }
            await transaction.commit();
        } catch (error) {
            const errorMessage = 'Batch deletion failed';
            Helper.logError(`${errorMessage}`, error);
            await transaction.rollback();
            throw new Error(`${errorMessage}`);
        }
    }

    async #checkRelationExists(classificationId, templateId, trx) {
        const result = await this.#finder.execute(classificationId, templateId, trx);
        if (!result) {
            throw new CustomError(
                `Relation with classificationId ${classificationId} and templateId ${templateId} does not exist.`,
                400
            );
        }
    }
}
