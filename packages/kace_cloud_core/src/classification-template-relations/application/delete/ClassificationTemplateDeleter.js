import { DomainClassificationTemplateFinder } from '../../index';

export class ClassificationTemplateDeleter {
    /** @type {KnexClassificationTemplateRelationsRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainClassificationTemplateFinder} is initialized in the constructor */
    #classificationTemplateFinder;

    /**
     * Creates an instance of the `ClassificationTemplateDeleter` class.
     *
     * @param {KnexClassificationTemplateRelationsRepository} repository - An instance of the repository that manages classification-template records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#classificationTemplateFinder = new DomainClassificationTemplateFinder(repository);
    }

    /**
     * Deletes a classification-template relation object from the repository.
     *
     * @param {string} classificationId - The unique identifier of the classification object to delete.
     * @param {string} templateId - The unique identifier of the template object to delete.
     * @returns {Promise<void>} A promise that resolves when the classification-template relation object is deleted.
     * @throws {Error} Throws an error if the classification-template relation object does not exist.
     */
    async execute(classificationId, templateId) {
        const classificationTemplate = await this.#classificationTemplateFinder.execute(classificationId, templateId);
        if (!classificationTemplate) {
            throw new Error(
                `Relation with classificationId ${classificationId} and templateId ${templateId} does not exist.`
            );
        }

        await this.#repository.delete(classificationTemplate);
    }
}
