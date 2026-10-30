import { Client, ClientResponse } from '../../index';
import IsUniqueId from '../../domain/IsUniqueId.js';
import IsUniqueIdentification from '../../domain/IsUniqueIdentification.js';

export class ClientCreator {
    /** @type {KnexClientRepository} */
    #repository; // is initialized in the constructor

    /** @type {IsUniqueId} */
    #isUniqueId; //is initialized in the constructor

    /** @type {IsUniqueIdentification} */
    #isUniqueIdentification; // is initialized in the constructor

    /**
     *
     * @param {KnexClientRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#isUniqueId = new IsUniqueId(repository);
        this.#isUniqueIdentification = new IsUniqueIdentification(repository);
    }

    /**
     * Executes the creation of an Client object and saves it to the repository.
     *
     * @param {Object} dto - The data transfer object containing the properties for the Client object.
     * @returns {Promise<void>} A promise that resolves when the Client object is saved.
     */
    async execute(dto) {
        const client = Client.create(dto);

        await this.#isUniqueId.validate(client);
        await this.#isUniqueIdentification.validate(client);

        const newRecord = await this.#repository.save(client);
        await this.#repository.saveHistory(client);

        return new ClientResponse(newRecord);
    }
}
