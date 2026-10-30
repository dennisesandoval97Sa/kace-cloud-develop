import { AllowedConnection, DomainAllowedConnectionFinder } from '../../index.js';
import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator.js';
import { CustomError } from '../../../shared/errors/CustomError.js';

export class AllowedConnectionCreator {
    /**
     * @type {KnexAllowedConnectionsRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * @type {DomainAllowedConnectionFinder}
     * is initialized in the constructor
     */
    #finder;

    /**
     * @type {UniquenessValidator}
     * is initialized in the constructor
     */
    #uniquenessValidator;

    /**
     * Creates an instance of `AllowedConnectionCreator`.
     *
     * @param {KnexAllowedConnectionsRepository} repository - The repository used to save allowed connections.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainAllowedConnectionFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    /**
     * Executes the process of creating a new allowed connection.
     *
     * This method takes a data transfer object (DTO) containing the necessary properties to create
     * a new `AllowedConnection` object, and then saves it to the repository.
     *
     * @param {Object} dto - The data transfer object containing the properties for the `AllowedConnection` object.
     * @returns {Promise<void>} A promise that resolves when the `AllowedConnection` object is successfully created.
     */
    async execute(dto) {
        const allowedConnection = new AllowedConnection(dto);

        const result = await this.#finder.execute(allowedConnection.id.value);
        if (result) {
            throw new CustomError(`Allowed Connection with id ${allowedConnection.id.value} already exists`, 400);
        }

        await this.#uniquenessValidator.validate('connection', dto.connection);

        await this.#repository.save(allowedConnection);
        await this.#repository.saveHistory(allowedConnection);
    }
}
