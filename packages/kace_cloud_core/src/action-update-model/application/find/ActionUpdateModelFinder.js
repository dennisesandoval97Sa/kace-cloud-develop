import { CustomError } from '../../../shared/index.js';
import { ActionUpdateModelResponse, DomainActionUpdateModelFinder } from '../../index.js';

export class ActionUpdateModelFinder {
    /**
     * @type {DomainActionUpdateModelFinder}
     * is initialized in the constructor
     */
    #finder;

    /**
     * Creates an instance of the `ActionUpdateModelFinder` class.
     *
     * @param {KnexModelUpdateRepository} repository - An instance of the repository that manages ActionUpdateModel records.
     */
    constructor(repository) {
        this.#finder = new DomainActionUpdateModelFinder(repository);
    }

    /**
     * Executes the finding of a ActionUpdateModel object by its unique identifier.
     *
     * @param {string} id - The unique identifier of the ActionUpdateModel object to find.
     * @returns {Promise<ActionUpdateModelResponse>} A promise that resolves to a ActionUpdateModelResponse object containing the found ModelUpdate data.
     */
    async execute(id) {
        const modelUpdate = await this.#finder.execute(id);

        if (!modelUpdate || modelUpdate.isDeleted()) {
            throw new CustomError('Action update model not found', 404);
        }
        return new ActionUpdateModelResponse(modelUpdate);
    }
}
