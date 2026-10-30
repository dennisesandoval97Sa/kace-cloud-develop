import { ValueObjectUuid } from '../../shared/index.js';

export class ClassificationGroupFinder {
    /** @type {KnexClassificationGroupRelationshipRepository} is initialized in the constructor */
    #repository;

    /**
     * Creates an instance of the `ClassificationGroupFinder` class.
     *
     * @param {KnexClassificationGroupRelationshipRepository} repository - An instance of the repository that manages classification-group records.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Finds a classification-group relationship by their IDs.
     *
     * @param {string} classificationId - The UUID of the classification to find.
     * @param {string} groupId - The UUID of the group to find.
     * @param {Transaction} [trx] - Optional transaction object.
     * @return {Promise<ClassificationGroupRelationship | null>} A promise that resolves to the `ClassificationGroupRelationship` instance if found, or `null` if not found.
     */
    async execute(classificationId, groupId, trx) {
        return this.#repository.find(
            new ValueObjectUuid('classificationId', classificationId),
            new ValueObjectUuid('groupId', groupId),
            trx
        );
    }
}
