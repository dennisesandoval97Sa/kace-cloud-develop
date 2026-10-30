import { CustomError } from '../../../shared';
import { DomainLiteralFinder, LiteralResponse } from '../../index.js';

export class LiteralFinder {
    /** @type {DomainLiteralFinder} is initialized in the constructor */
    #finder;

    /**
     * Creates an instance of `LiteralFinder`.
     *
     * @param {KnexLiteralRepository} repository - The repository used to access the `Literal` data.
     */
    constructor(repository) {
        this.#finder = new DomainLiteralFinder(repository);
    }

    /**
     * Executes the finding of a `Literal` object by its unique identifier.
     *
     * @param {string} id - The unique identifier of the `Literal` object to find.
     * @returns {Promise<LiteralResponse>} A promise that resolves to a `LiteralResponse` object containing the found `Literal` data.
     */
    async execute(id) {
        const literal = await this.#finder.execute(id);
        if (!literal || literal.isDeleted()) {
            throw new CustomError('Literal not found', 404);
        }
        return new LiteralResponse(literal);
    }
}
