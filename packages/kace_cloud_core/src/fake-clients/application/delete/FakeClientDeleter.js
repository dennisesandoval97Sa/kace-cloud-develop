import { ValueObjectUuid } from '../../../shared';

export class FakeClientDeleter {
    /** @type {KnexFakeClientRepository} is initialized in the constructor */
    #repository;

    /**
     * @param {KnexFakeClientRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Deletes a Client object from the repository.
     *
     * @param {string} id - The unique identifier of the Client object to delete.
     * @returns {Promise<void>} A promise that resolves when the Client object is deleted.
     */
    async execute(id) {
        const client = await this.#repository.find(new ValueObjectUuid('id', id));

        await this.#repository.delete(client.id);
    }
}
