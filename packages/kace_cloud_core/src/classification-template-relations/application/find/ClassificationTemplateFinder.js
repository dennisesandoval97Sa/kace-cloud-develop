import { ClassificationTemplateResponse, DomainClassificationTemplateFinder } from '../../index.js';

export class ClassificationTemplateFinder {
    /** @type {DomainClassificationTemplateFinder} is initialized in the constructor */
    #finder;

    /**
     * Creates an instance of the `ClassificationTemplateFinder` class.
     *
     * @param {KnexClassificationTemplateRelationsRepository} repository - An instance of the repository that manages classification-template relation records.
     */
    constructor(repository) {
        this.#finder = new DomainClassificationTemplateFinder(repository);
    }

    /**
     * Executes the finding of a `ClassificationTemplateRelations` object by its unique identifiers.
     *
     * @param {string} classificationId - The unique identifier of the `Classification` object to find.
     * @param {string} templateId - The unique identifier of the `Template` object to find.
     * @returns {Promise<ClassificationTemplateResponse>} A promise that resolves to a `ClassificationTemplateResponse` object containing the found classification-template relation data.
     */
    async execute(classificationId, templateId) {
        const classificationTemplate = await this.#finder.execute(classificationId, templateId);
        return new ClassificationTemplateResponse(classificationTemplate);
    }
}
