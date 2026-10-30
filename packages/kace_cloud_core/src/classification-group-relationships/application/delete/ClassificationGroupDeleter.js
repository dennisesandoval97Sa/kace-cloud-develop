import { DomainClassificationGroupFinder } from '../../index';
import { CustomError } from '../../../shared/errors/CustomError.js';
import { CLASSIFICATION_GROUP_RELATION_NOT_FOUND } from '@kace/error-codes';

export class ClassificationGroupDeleter {
    /** @type {KnexClassificationGroupRelationshipRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainClassificationGroupFinder} is initialized in the constructor */
    #classificationGroupFinder;

    /**
     * Creates an instance of the `ClassificationGroupDeleter` class.
     *
     * @param {KnexClassificationGroupRelationshipRepository} repository - An instance of the repository that manages classification group records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#classificationGroupFinder = new DomainClassificationGroupFinder(repository);
    }

    /**
     * Deletes a classification group relation object from the repository.
     *
     * @param {string} classificationId - The unique identifier of the classification object to delete.
     * @param {string} groupId - The unique identifier of the group object to delete.
     * @returns {Promise<void>} A promise that resolves when the classification group relation object is deleted.
     * @throws {Error} Throws an error if the classification group relation object does not exist.
     */
    async execute(classificationId, groupId) {
        const classificationGroup = await this.#classificationGroupFinder.execute(classificationId, groupId);

        if (!classificationGroup) {
            throw new CustomError(
                `Relation with classificationId ${classificationId} and groupId ${groupId} does not exist.`,
                400,
                [],
                CLASSIFICATION_GROUP_RELATION_NOT_FOUND
            );
        }

        await this.#repository.delete(classificationGroup);
    }
}
