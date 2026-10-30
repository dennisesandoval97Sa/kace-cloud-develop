import { ClassificationGroupRelationship, DomainClassificationGroupFinder } from '../../index';

export class ClassificationGroupCreator {
    /** @type {KnexClassificationGroupRelationshipRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainClassificationGroupFinder} is initialized in the constructor */
    #finder;
    /** @type {IdsValidator} is initialized in the constructor */
    #idsValidator;

    /**
     * Creates an instance of `ClassificationGroupCreator`.
     *
     * @param {KnexClassificationGroupRelationshipRepository} repository - The repository used to save classification-group relation.
     * @param {IdsValidator} idsValidator - The validator used to validate classification and group IDs.
     */
    constructor(repository, idsValidator) {
        this.#repository = repository;
        this.#finder = new DomainClassificationGroupFinder(repository);
        this.#idsValidator = idsValidator;
    }

    /**
     * Executes the process of creating a new classification-group relation.
     * @param {Object} dto - The data transfer object containing the properties for the Classification Group Relation object.
     *   - `classification_id` (string): The unique identifier of the classification in the relationship.
     *   - `group_id` (string): The unique identifier of the group in the relationship.
     *   - `form` (string, optional): Additional form data for the relationship.
     * @returns {Promise<void>}
     */
    async execute(dto) {
        await this.#idsValidator.validateClassificationIds([dto.classification_id]);
        await this.#idsValidator.validateGroupIds([dto.group_id]);
        if (dto.form) {
            await this.#idsValidator.validateOneScriptIds([dto.form]);
        }

        const relation = new ClassificationGroupRelationship(dto);

        const result = await this.#finder.execute(relation.classification_id.value, relation.group_id.value);
        if (result) {
            throw new Error(
                `Relation with classificationId ${dto.classification_id} and groupId ${dto.group_id} already exists.`
            );
        }

        await this.#repository.save(relation);
    }
}
