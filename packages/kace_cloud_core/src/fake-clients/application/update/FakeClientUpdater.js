import { ValidationFailError } from '../../../shared/index.js';
import { FakeClientFinder as DomainFinder } from '../../domain/FakeClientFinder.js';

export class FakeClientUpdater {
    /** @type {DomainFinder} is initialized in the constructor*/
    #clientFinder;
    /** @type {KnexFakeClientRepository} is initialized in the constructor*/
    #repository;

    /**
     *
     * @param {KnexFakeClientRepository} repository
     * @param {KnexClientRepository} clientRepository
     */
    constructor(repository, clientRepository) {
        this.#repository = repository;
        this.#clientFinder = new DomainFinder(repository);
    }

    /**
     * Updates an Client object in the repository.
     *
     * @param {string} id - The unique identifier of the Client object to update.
     * @param {Object} dto - The data transfer object containing the properties to update in the Client object.
     * @returns {Promise<void>} A promise that resolves when the Client object is updated.
     */
    async execute(id, dto) {
        const client = await this.#clientFinder.execute(id);

        if (!client) {
            throw new ValidationFailError(`Client not found with id:${client.id.value}`, 'id');
        }

        client.update(dto);

        const hasChange =
            Object.keys(client.changedAttributes).filter((key) => {
                return key !== 'updated_at' && key !== 'updated_by';
            }).length > 0;

        if (!hasChange) {
            return;
        }

        await this.#repository.update(client);

        client.flushChanges();
    }
}
