import { CustomError } from '../../../shared/errors/CustomError';
import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator';
import { WSRestEndpoint } from '../../domain/WSRestEndpoint';
import { WSRestEndpointFinder as DomainWSRestEndpointFinder } from '../../domain/WSRestEndpointFinder';
import { SecretReferenceExtractor } from '../../domain/SecretReferenceExtractor';
import { ValidationFailError } from '../../../shared';

export class WSRestEndpointCreator {
    /** @type {KnexWSRestEndpointRepository} is initialized in the constructor */
    #repository;
    /** @type {KnexSecretsVaultRepository} is initialized in the constructor */
    #secretsRepository;
    /** @type {DomainWSRestEndpointFinder} is initialized in the constructor */
    #endpointFinder;
    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;

    /**
     * Creates an instance of `WSRestEndpointCreator`.
     *
     * @param {KnexWSRestEndpointRepository} repository - The repository used to save WS REST endpoints.
     * @param {KnexSecretsVaultRepository} secretsRepository - The repository used to validate secret references.
     */
    constructor(repository, secretsRepository) {
        this.#repository = repository;
        this.#secretsRepository = secretsRepository;
        this.#endpointFinder = new DomainWSRestEndpointFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    /**
     * Executes the creation of a WSRestEndpoint object and saves it to the repository.
     *
     * @param {Object} dto - The data transfer object containing the properties for the WSRestEndpoint object.
     * @returns {Promise<void>} A promise that resolves when the WSRestEndpoint object is saved.
     */
    async execute(dto) {
        const wsRestEndpoint = WSRestEndpoint.create(dto);

        const result = await this.#endpointFinder.execute(wsRestEndpoint.id.value);
        if (result) {
            throw new CustomError(`WSRestEndpoint with id ${wsRestEndpoint.id.value} already exists`, 400);
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

        await this.#uniquenessValidator.validate('description', dto.description);
        await this.#repository.save(wsRestEndpoint);
        await this.#repository.saveHistory(wsRestEndpoint);
    }
}
