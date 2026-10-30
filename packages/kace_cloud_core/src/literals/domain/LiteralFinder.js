import { ValueObjectUuid } from '../../shared/index.js';

export class LiteralFinder {
    /** @type {KnexLiteralRepository} is initialized in the constructor */
    #repository;

    /**
     * Constructs a new instance of LiteralFinder.
     * @param {KnexLiteralRepository} repository - The repository used to find literals.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Executes the operation to find a literal by its ID.
     * @param {string} id - The unique identifier of the literal.
     * @returns {Promise<Literal | null>} A promise that resolves to the found literal, or null if not found.
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
