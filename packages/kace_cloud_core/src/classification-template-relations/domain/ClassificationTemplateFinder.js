import { ValueObjectUuid } from '../../shared/index.js';

export class ClassificationTemplateFinder {
    /** @type {KnexClassificationTemplateRelationsRepository} is initialized in the constructor */
    #repository;

    /**
     * Creates an instance of the `ClassificationTemplateFinder` class.
     *
     * @param {KnexClassificationTemplateRelationsRepository} repository - An instance of the repository that manages classification-template records.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Finds a classification-template by their IDs.
     *
     * @param {string} classificationId - The UUID of the classification to find.
     * @param {string} templateId - The UUID of the template to find.
     * @param {Transaction} [trx] - Optional transaction object.
     * @return {Promise<ClassificationTemplateRelations | null>} A promise that resolves to the `ClassificationTemplateRelations` instance if found, or `null` if not found.
     */
    async execute(classificationId, templateId, trx) {
        return this.#repository.find(
            new ValueObjectUuid('classificationId', classificationId),
            new ValueObjectUuid('templateId', templateId),
            trx
        );
    }
}
