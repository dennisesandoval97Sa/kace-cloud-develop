import { CustomError } from '../../../shared/errors/CustomError.js';
import { DomainOneScriptFinder, OneScriptResponse } from '../../index.js';

export class OneScriptFinder {
    /** @type {DomainOneScriptFinder} is initialized in the constructor */
    #finder;

    /**
     * Creates an instance of the `OneScriptFinder` class.
     *
     * @param {KnexOneScriptRepository} repository - An instance of the repository that manages OneScript records.
     */
    constructor(repository) {
        this.#finder = new DomainOneScriptFinder(repository);
    }

    /**
     * Executes the finding of an OneScript object by its unique identifier.
     *
     * @param {string} id - The unique identifier of the OneScript object to find.
     * @returns {Promise<OneScriptResponse>} A promise that resolves to an OneScriptResponse object containing the found OneScript data.
     */
    async execute(id) {
        const oneScript = await this.#finder.execute(id);

        if (oneScript?.deleted_by.value !== null) {
            throw new CustomError('OneScript not found', 404);
        }
        return new OneScriptResponse(oneScript);
    }
}
