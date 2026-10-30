import { CustomError } from '../../../shared/index.js';
import { FakeClientFinder as DomainFinder } from '../../domain/FakeClientFinder.js';
import { FakeClientResponse } from '../FakeClientResponse.js';

export class ClientFinder {
    /** @type {DomainFinder} is initialized in the constructor */
    #finder;

    constructor(repository) {
        this.#finder = new DomainFinder(repository);
    }

    /**
     * Executes the finding of an Client object by its unique identifier.
     *
     * @param {string} id - The unique identifier of the Client object to find.
     * @returns {Promise<FakeClientResponse>} A promise that resolves to an AnsResponse object containing the found Client data.
     */
    async execute(id) {
        const client = await this.#finder.execute(id);
        if (!client || client.isDeleted()) {
            throw new CustomError('Client not found', 404);
        }
        return new FakeClientResponse(client);
    }
}
