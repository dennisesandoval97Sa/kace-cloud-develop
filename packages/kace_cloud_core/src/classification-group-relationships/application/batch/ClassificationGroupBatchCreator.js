import { CustomError } from '../../../shared/errors/CustomError.js';
import { ClassificationGroupRelationship, DomainClassificationGroupFinder } from '../../index.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';

export class ClassificationGroupBatchCreator {
    /** @type {KnexClassificationGroupRelationshipRepository} is initialized in the constructor */
    #repository;

    /** @type {DomainClassificationGroupFinder} is initialized in the constructor */
    #finder;

    /** @type {IdsValidator} is initialized in the constructor */
    #idsValidator;

    /**
     * Creates an instance of `ClassificationGroupBatchCreator`.
     *
     * @param {KnexClassificationGroupRelationshipRepository} repository - The repository used to save classification group relationships.
     * @param {IdsValidator} idsValidator - The validator used to validate IDs.
     */
    constructor(repository, idsValidator) {
        this.#repository = repository;
        this.#finder = new DomainClassificationGroupFinder(repository);
        this.#idsValidator = idsValidator;
    }

    /**
     * Handles batch creation of Classification-Group relationships.
     *
     * @param {Object[]} dto - List of classification-group relationship data.
     *   - `classification_id` (string): The unique identifier of the classification in the relationship.
     *   - `group_id` (string): The unique identifier of the group in the relationship.
     * @returns {Promise<void>}
     */
    async execute(dto) {
        if (!Array.isArray(dto) || dto.length === 0) return;

        const classificationIds = dto.map((rel) => rel.classification_id);
        const groupIds = dto.map((rel) => rel.group_id);
        const formIds = dto.map((rel) => rel.form).filter((form) => form);

        await this.#idsValidator.validateClassificationIds(classificationIds);
        await this.#idsValidator.validateGroupIds(groupIds);
        await this.#idsValidator.validateOneScriptIds(formIds);

        const transaction = await this.#repository.startTransaction();

        try {
            for (const relationship of dto) {
                const relation = ClassificationGroupRelationship.create(relationship);
                await this.#checkRelationExists(relation.classification_id.value, relation.group_id.value, transaction);
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

    async #checkRelationExists(classificationId, groupId, trx) {
        const result = await this.#finder.execute(classificationId, groupId, trx);
        if (result) {
            throw new CustomError(
                `Relation with classificationId ${classificationId} and groupId ${groupId} already exists.`,
                400
            );
        }
    }
}
