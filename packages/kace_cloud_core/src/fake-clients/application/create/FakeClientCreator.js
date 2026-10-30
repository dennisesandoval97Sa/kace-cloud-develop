import IsUniqueId from '../../../clients/domain/IsUniqueId.js';
import { FakeClient } from '../../domain/FakeClient.js';

export class FakeClientCreator {
    /** @type {KnexFakeClientRepository} */
    #repository; // is initialized in the constructor

    /** @type {IsUniqueId} */
    #isUniqueId; //is initialized in the constructor

    /**
     *
     * @param {KnexFakeClientRepository} repository
     * @param {KnexClientRepository} clienteRepository
     */

    constructor(repository) {
        this.#repository = repository;
        this.#isUniqueId = new IsUniqueId(repository);
    }

    /**
     * Executes the creation of an Client object and saves it to the repository.
     *
     * @param {Object} dto - The data transfer object containing the properties for the Client object.
     * @returns {Promise<void>} A promise that resolves when the Client object is saved.
     */
    async execute(dto) {
        const client = FakeClient.create(dto);

        await this.#isUniqueId.validate(client);

        await this.#repository.save(client);
    }
}
