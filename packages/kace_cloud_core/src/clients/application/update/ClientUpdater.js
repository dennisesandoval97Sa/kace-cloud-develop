import { DomainClientFinder } from '../../index';
import IsUniqueIdentification from '../../domain/IsUniqueIdentification.js';
import { ValidationFailError } from '../../../shared/index.js';

export class ClientUpdater {
    /** @type {DomainClientFinder} is initialized in the constructor*/
    #clientFinder;
    /** @type {KnexClientRepository} is initialized in the constructor*/
    #repository;
    /** @type {IsUniqueIdentification} is initialized in the constructor*/
    #isUniqueIdentification;

    /**
     *
     * @param {KnexClientRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#clientFinder = new DomainClientFinder(repository);
        this.#isUniqueIdentification = new IsUniqueIdentification(repository);
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
        await this.#isUniqueIdentification.validate(client, true);

        const originalValues = client.toJson();
        client.update(dto);

        const hasChange =
            Object.keys(client.changedAttributes).filter((key) => {
                return key !== 'updated_at' && key !== 'updated_by';
            }).length > 0;

        if (!hasChange) {
            return;
        }

        await this.#repository.update(client);
        await this.#repository.saveHistory(client, originalValues);

        client.flushChanges();
    }
}
