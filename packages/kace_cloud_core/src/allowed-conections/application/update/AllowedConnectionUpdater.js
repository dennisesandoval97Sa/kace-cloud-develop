import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator.js';
import { DomainAllowedConnectionFinder } from '../../index.js';

export class AllowedConnectionUpdater {
    /**
     * @type {DomainAllowedConnectionFinder}
     * is initialized in the constructor
     */
    #connectionFinder;

    /**
     * @type {KnexAllowedConnectionRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * @type {UniquenessValidator}
     * is initialized in the constructor
     */
    #uniquenessValidator;

    /**
     * Creates an instance of `AllowedConnectionUpdater`.
     *
     * @param {KnexAllowedConnectionRepository} repository - The repository used to access the `AllowedConnection` data.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#connectionFinder = new DomainAllowedConnectionFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    /**
     * Executes the update operation for an `AllowedConnection` object in the repository.
     *
     * @param {string} id - The unique identifier of the `AllowedConnection` object to update.
     * @param {Object} dto - The data transfer object containing the properties to update in the `AllowedConnection` object.
     * @returns {Promise<void>} A promise that resolves when the `AllowedConnection` object is successfully updated.
     */
    async execute(id, dto) {
        const allowedConnection = await this.#connectionFinder.execute(id);
        if (!allowedConnection) {
            throw new Error(`AllowedConnection with ID ${id} does not exist.`);
        }

        if (dto.connection) {
            await this.#uniquenessValidator.validate('connection', dto.connection, id);
        }

        const originalValues = allowedConnection.toJson();
        allowedConnection.update(dto);

        await this.#repository.update(allowedConnection);
        await this.#repository.saveHistory(allowedConnection, originalValues);

        allowedConnection.flushChanges();
    }
}
