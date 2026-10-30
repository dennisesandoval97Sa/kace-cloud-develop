import { DomainLiteralFinder } from '../../index.js';
import { CustomError } from '../../../shared/index.js';

export class LiteralDeleter {
    /** @type {KnexLiteralRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainLiteralFinder} is initialized in the constructor */
    #literalFinder;

    /**
     * Creates an instance of `LiteralDeleter`.
     *
     * @param {KnexLiteralRepository} repository - The repository used to access the `Literal` data.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#literalFinder = new DomainLiteralFinder(repository);
    }

    /**
     * Deletes a `Literal` object from the repository.
     *
     * This method first retrieves the `Literal` object from the repository using the provided `id`.
     * If the object is found, it marks the object as deleted by setting relevant properties in the DTO.
     * Finally, it persists the changes to the repository and flushes any pending changes.
     *
     * @param {string} id - The unique identifier of the `Literal` object to delete.
     * @param {Object} dto - The data transfer object containing the properties to update for the `Literal` object before deletion.
     * @param {string} dto.deleted_at - The timestamp when the literal was deleted.
     * @param {string} dto.deleted_by - The identifier of the user who deleted the literal.
     * @returns {Promise<void>} A promise that resolves when the `Literal` object is marked as deleted.
     */
    async execute(id, dto) {
        const literal = await this.#literalFinder.execute(id);

        if (!literal) {
            throw new CustomError(`Literal with ID ${id} does not exist.`, 404);
        }

        const originalValues = literal.toJson();
        literal.delete(dto);

        await this.#repository.update(literal);
        await this.#repository.saveHistory(literal, originalValues);

        literal.flushChanges();
    }
}
