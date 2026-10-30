import { CustomError } from '../../../shared/errors/CustomError.js';
import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator.js';
import { WSRestEndpointFinder as DomainWSRestEndpointFinder } from '../../domain/WSRestEndpointFinder';
import { SecretReferenceExtractor } from '../../domain/SecretReferenceExtractor';
import { ValidationFailError } from '../../../shared';

export class WSRestEndpointUpdater {
    /** @type {KnexWSRestEndpointRepository} is initialized in the constructor */
    #repository;
    /** @type {KnexSecretsVaultRepository} is initialized in the constructor */
    #secretsRepository;
    /** @type {DomainWSRestEndpointFinder} is initialized in the constructor */
    #endpointFinder;
    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;

    /**
     * Creates an instance of the `WSRestEndpointUpdater` class.
     *
     * @param {KnexS3FileRepository} repository - An instance of the repository that manages WS REST endpoints.
     * @param {KnexSecretsVaultRepository} secretsRepository - The repository used to validate secret references.
     *
     */
    constructor(repository, secretsRepository) {
        this.#repository = repository;
        this.#secretsRepository = secretsRepository;
        this.#endpointFinder = new DomainWSRestEndpointFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    /**
     * Updates a WSRestEndpoint object in the repository.
     *
     * @param {string} id - The unique identifier of the WSRestEndpoint object to update.
     * @param {Object} dto - The data transfer object containing the properties to update in the WSRestEndpoint object.
     * @returns {Promise<void>} A promise that resolves when the WSRestEndpoint object is updated.
     */
    async execute(id, dto) {
        const wsRestEndpoint = await this.#endpointFinder.execute(id);

        if (!wsRestEndpoint) {
            throw new CustomError(`WSRestEndpoint with id ${id} does not exist.`, 404);
        }

        if (dto.description) {
            await this.#uniquenessValidator.validate('description', dto.description, id);
        }

        const references = SecretReferenceExtractor.extract(dto);

        if (references.length) {
            const missing = await this.#secretsRepository.findMissingReferences(references);

            if (missing.length) {
                throw new ValidationFailError(
                    `Secret references not found: ${missing.join(', ')}`,
                    'rest_endpoinst_references'
                );
            }
        }

        const originalValues = wsRestEndpoint.toJson();
        wsRestEndpoint.update(dto);

        await this.#repository.update(wsRestEndpoint);
        await this.#repository.saveHistory(wsRestEndpoint, originalValues);

        wsRestEndpoint.flushChanges();
    }
}
