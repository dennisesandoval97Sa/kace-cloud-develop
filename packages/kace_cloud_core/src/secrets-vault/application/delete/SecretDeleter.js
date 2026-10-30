import { SecretsFinderDomain } from '../..';
import { CustomError } from '../../../shared/errors/CustomError';

export class SecretDeleter {
    /** @type {KnexSecretsVaultRepository} is initialized in the constructor */
    #repository;
    /** @type {SecretsFinderDomain} is initialized in the constructor */
    #finder;
    /**
     *
     * @param {KnexSecretsVaultRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new SecretsFinderDomain(repository);
    }

    /**
     *
     * @param {string} id identifier of the secret to delete
     * @param {Object} dtoDelete data to delete the secret exm. {deleted_at: new Date(), deleted_by: 1}
     * @returns {Promise<void>}
     */
    async execute(id, dtoDelete) {
        const secret = await this.#finder.execute(id);
        if (secret === null) {
            throw new CustomError(`The secret you are trying delete does not exist`, 404);
        }
        secret.delete(dtoDelete);

        await this.#repository.delete(secret);
        secret.flushChanges();
    }
}
