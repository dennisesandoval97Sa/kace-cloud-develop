import { ClassificationTemplateRelations, DomainClassificationTemplateFinder } from '../../index';

export class ClassificationTemplateCreator {
    /** @type {KnexClassificationTemplateRelationsRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainClassificationTemplateFinder} is initialized in the constructor */
    #finder;
    /** @type {Object} is initialized in the constructor */
    #idsValidator;

    /**
     * Creates an instance of `ClassificationTemplateCreator`.
     *
     * @param {KnexClassificationTemplateRelationsRepository} repository - The repository used to save classification-template relations.
     * @param {Object} idsValidator - The validator used to validate classification and template IDs.
     */
    constructor(repository, idsValidator) {
        this.#repository = repository;
        this.#finder = new DomainClassificationTemplateFinder(repository);
        this.#idsValidator = idsValidator;
    }

    /**
     * Executes the process of creating a new classification-template relation.
     * @param {Object} dto - The data transfer object containing the properties for the Classification Template Relation object.
     *   - `classification_id` (string): The unique identifier of the classification in the relationship.
     *   - `template_id` (string): The unique identifier of the template in the relationship.
     *   - `form` (string, optional): Additional form data for the relationship.
     * @returns {Promise<void>}
     */
    async execute(dto) {
        await this.#idsValidator.validateClassificationIds([dto.classification_id]);
        await this.#idsValidator.validateTemplateIds([dto.template_id]);

        const relation = new ClassificationTemplateRelations(dto);

        const result = await this.#finder.execute(relation.classification_id.value, relation.template_id.value);
        if (result) {
            throw new Error(
                `Relation with classificationId ${dto.classification_id} and templateId ${dto.template_id} already exists.`
            );
        }

        await this.#repository.save(relation);
    }
}
