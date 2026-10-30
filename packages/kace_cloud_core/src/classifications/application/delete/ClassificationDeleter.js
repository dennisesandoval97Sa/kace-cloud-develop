import { DomainClassificationFinder } from '../../index';

export class ClassificationDeleter {
    /** @type {KnexClassificationRepository} is initialized in the constructor*/
    #repository;
    /** @type {DomainClassificationFinder} is initialized in the constructor*/
    #classificationFinder;

    constructor(repository) {
        this.#repository = repository;
        this.#classificationFinder = new DomainClassificationFinder(repository);
    }

    /**
     * Deletes an Classification object from the repository.
     *
     * @param {string} id - The unique identifier of the Classification object to delete.
     * @param {Object} dto - The data transfer object containing the properties for the Classification object.
     * @returns {Promise<void>} A promise that resolves when the Classification object is deleted.
     * @throws {Error} Throws an error if the Classification object does not exist.
     */
    async execute(id, dto) {
        const classification = await this.#classificationFinder.execute(id);

        if (!classification) {
            throw new Error(`Classification with ID ${id} does not exist.`);
        }

        const originalValues = classification.toJson();
        classification.delete(dto);

        const relations = classification.getClassificationRelations();
        await this.#repository.deleteRelations(relations);
        await this.#repository.update(classification);
        await this.#repository.saveHistory(classification, originalValues);

        classification.flushChanges();
    }
}
