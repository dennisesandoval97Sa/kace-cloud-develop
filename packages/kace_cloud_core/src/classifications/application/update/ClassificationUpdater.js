import { UniquenessValidator } from '../../../shared/index.js';
import { DomainClassificationFinder } from '../../index.js';
import { ValidationFailError } from '../../../shared/errors/ValidationFailError';
import { ClassificationsValidator } from '../../domain/ClassificationsValidator';
import { BuildDescriptionService } from '../../domain/BuildDescriptionService ';

export class ClassificationUpdater {
    /** @type {DomainClassificationFinder} is initialized in the constructor*/
    #classificationFinder;
    /** @type {KnexClassificationRepository} is initialized in the constructor*/
    #repository;
    /** @type {KnexClassificationRepository} is initialized in the constructor*/
    #uniquenessValidator;
    /** @type {ClassificationsValidator} is initialized in the constructor */
    #classificationsValidator;

    constructor(repository) {
        this.#repository = repository;
        this.#classificationFinder = new DomainClassificationFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
        this.#classificationsValidator = new ClassificationsValidator(repository);
    }

    /**
     * Updates an Classification object in the repository.
     *
     * @param {string} id - The unique identifier of the Classification object to update.
     * @param {Object} dto - The data transfer object containing the properties to update in the Classification object.
     * @returns {Promise<void>} A promise that resolves when the Classification object is updated.
     */
    async execute(id, dto) {
        const payload = { ...dto, description: BuildDescriptionService(dto) };

        const classification = await this.#classificationFinder.execute(id);

        if (!classification) {
            throw new Error(`Classification with ID ${id} does not exist.`);
        }

        if (this.#hasLevelFields(payload)) {
            const uniquenessFields = this.#prepareUniquenessFields(payload, classification);
            await this.#uniquenessValidator.validateMultiple(uniquenessFields, id);
        }

        const actualRelations = classification.getClassificationRelations();
        const originalValues = classification.toJson();
        classification.update(payload);

        const classificationsIds = classification.getClassificationsIds();
        const IsValidClassifications = await this.#classificationsValidator.execute(classificationsIds);
        if (!IsValidClassifications)
            throw new ValidationFailError(
                `one of classification | SubClassification does not exist`,
                'classification_id'
            );

        const updateRelations = classification.getClassificationRelations();

        if (actualRelations && actualRelations.length > 0) {
            await this.#repository.deleteRelations(actualRelations);
        }

        if (updateRelations && updateRelations.length > 0) {
            await this.#repository.saveRelations(updateRelations);
        }
        await this.#repository.update(classification);
        await this.#repository.saveHistory(classification, originalValues);

        classification.flushChanges();
    }

    /**
     * Determines if the DTO contains any of the nivelX fields.
     *
     * @param {Object} dto
     * @returns {boolean}
     */
    #hasLevelFields(dto) {
        return Object.keys(dto).some((key) => /^nivel([1-9]|10)$/.test(key));
    }

    #prepareUniquenessFields(dto, classification) {
        const fields = [
            'nivel1',
            'nivel2',
            'nivel3',
            'nivel4',
            'nivel5',
            'nivel6',
            'nivel7',
            'nivel8',
            'nivel9',
            'nivel10',
        ];

        return fields.map((field) => ({
            field,
            value: dto[field] ?? classification[field].value,
        }));
    }
}
