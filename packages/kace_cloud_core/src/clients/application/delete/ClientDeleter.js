import { ValueObjectUuid } from '../../../shared';

export class ClientDeleter {
    /** @type {KnexClientRepository} is initialized in the constructor */
    #repository;

    /**
     * @param {KnexClientRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Deletes a Client object from the repository.
     *
     * @param {string} id - The unique identifier of the Client object to delete.
     * @param {Object} dto - The data transfer object containing the properties for the Client object.
     * @returns {Promise<void>} A promise that resolves when the Client object is deleted.
     */
    async execute(id, dto) {
        // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
        const client = await this.#repository.find(new ValueObjectUuid('id', id)); // TODO: Utilizar DomainService

        const originalValues = client.toJson();
        client.delete(dto);

        await this.#repository.update(client);
        await this.#repository.saveHistory(client, originalValues);

        client.flushChanges();
    }
}
