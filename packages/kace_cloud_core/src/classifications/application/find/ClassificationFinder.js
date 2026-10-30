import { CustomError } from '../../../shared/index.js';
import { ClassificationResponse, DomainClassificationFinder } from '../../index.js';

export class ClassificationFinder {
    /** @type {DomainClassificationFinder} is initialized in the constructor */
    #finder;

    constructor(repository) {
        this.#finder = new DomainClassificationFinder(repository);
    }

    /**
     * Executes the finding of an Classification object by its unique identifier.
     *
     * @param {string} id - The unique identifier of the Classification object to find.
     * @returns {Promise<ClassificationResponse>} A promise that resolves to an ClassificationResponse object containing the found Classification data.
     */
    async execute(id) {
        const classification = await this.#finder.execute(id);
        if (!classification || classification.isDeleted()) {
            throw new CustomError('Classification not found', 404);
        }

        return new ClassificationResponse(classification);
    }
}
