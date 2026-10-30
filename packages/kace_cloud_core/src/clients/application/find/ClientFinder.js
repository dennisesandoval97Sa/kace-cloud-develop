import { CustomError } from '../../../shared/index.js';
import { ClientResponse, DomainClientFinder } from '../../index.js';

export class ClientFinder {
    /** @type {DomainClientFinder} is initialized in the constructor */
    #finder;

    constructor(repository) {
        this.#finder = new DomainClientFinder(repository);
    }

    /**
     * Executes the finding of an Client object by its unique identifier.
     *
     * @param {string} id - The unique identifier of the Client object to find.
     * @returns {Promise<ClientResponse>} A promise that resolves to an AnsResponse object containing the found Client data.
     */
    async execute(id) {
        const client = await this.#finder.execute(id);
        if (!client || client.isDeleted()) {
            throw new CustomError('Client not found', 404);
        }
        return new ClientResponse(client);
    }
}
