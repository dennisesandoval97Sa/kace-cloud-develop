import { ClassificationGroupResponse, DomainClassificationGroupFinder } from '../../index.js';

export class ClassificationGroupFinder {
    /** @type {DomainClassificationGroupFinder} is initialized in the constructor */
    #finder;

    /**
     * Creates an instance of the `ClassificationGroupFinder` class.
     *
     * @param {KnexClassificationGroupRelationshipRepository} repository - An instance of the repository that manages classification group relation records.
     */
    constructor(repository) {
        this.#finder = new DomainClassificationGroupFinder(repository);
    }

    /**
     * Executes the finding of a `ClassificationGroupRelationship` object by its unique identifier.
     *
     * @param {string} classificationId - The unique identifier of the `Classification` object to find.
     * @param {string} groupId - The unique identifier of the `Group` object to find.
     * @returns {Promise<ClassificationGroupResponse>} A promise that resolves to a `ClassificationGroupResponse` object containing the found classification group relation data.
     */
    async execute(classificationId, groupId) {
        const classificationGroup = await this.#finder.execute(classificationId, groupId);
        return new ClassificationGroupResponse(classificationGroup);
    }
}
