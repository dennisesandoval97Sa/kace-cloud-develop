import { CustomError } from '../../../shared/errors/CustomError.js';
import { CLASSIFICATION_GROUP_RELATION_NOT_FOUND } from '@kace/error-codes';
import { ClassificationGroupRelationship, DomainClassificationGroupFinder } from '../../index.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';

export class ClassificationGroupBatchDeleter {
    /** @type {KnexClassificationGroupRelationshipRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainClassificationGroupFinder} is initialized in the constructor */
    #finder;

    /**
     * Creates an instance of `ClassificationGroupBatchDeleter`.
     *
     * @param {KnexClassificationGroupRelationshipRepository} repository - The repository used to manage classification-group relationships.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainClassificationGroupFinder(repository);
    }

    /**
     * Handles batch deletion of Classification-Group relationships.
     *
     * @param {Object[]} dto - List of ClassificationGroupRelationship data to delete.
     *   - `classification_id` (string): The unique identifier of the classification in the relationship.
     *   - `group_id` (string): The unique identifier of the group in the relationship.
     * @returns {Promise<void>}
     */
    async execute(classificationGroupRelationships) {
        if (!Array.isArray(classificationGroupRelationships) || classificationGroupRelationships.length === 0) return;

        const transaction = await this.#repository.startTransaction();

        try {
            for (const relationship of classificationGroupRelationships) {
                const relation = ClassificationGroupRelationship.create(relationship);
                await this.#checkRelationExists(relation.classification_id.value, relation.group_id.value, transaction);
                await this.#repository.delete(relation, transaction);
            }
            await transaction.commit();
        } catch (error) {
            const errorMessage = 'Batch deletion failed';
            Helper.logError(`${errorMessage}:`, error);
            await transaction.rollback();
            throw new Error(`${errorMessage}`);
        }
    }

    async #checkRelationExists(classificationId, groupId, trx) {
        const result = await this.#finder.execute(classificationId, groupId, trx);
        if (!result) {
            throw new CustomError(
                `Relation with classificationId ${classificationId} and groupId ${groupId} does not exist.`,
                400,
                [],
                CLASSIFICATION_GROUP_RELATION_NOT_FOUND
            );
        }
    }
}
