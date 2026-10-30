import { ValidationFailError, ValueObjectUuid } from '../../../shared/index.js';

export class AnsDeleter {
    /** @type {KnexRepository} is initialized in the constructor */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Deletes an Ans object from the repository.
     *
     * @param {string} id - The unique identifier of the Ans object to delete.
     * @param {Object} dto - The data transfer object containing the properties for the Ans object.
     * @returns {Promise<void>} A promise that resolves when the Ans object is deleted.
     */
    async execute(id, dto) {
        const ans = await this.#repository.find(new ValueObjectUuid('id', id));

        if (!ans) {
            throw new ValidationFailError(`ANS with id ${id} does not exist.`, 404);
        }

        ans.delete(dto);

        await this.#repository.delete(ans);

        ans.flushChanges();
    }
}
