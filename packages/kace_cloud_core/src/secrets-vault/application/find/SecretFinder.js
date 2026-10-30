import { SecretsFinderDomain } from '../..';
import { CustomError } from '../../../shared';
import { SecretsResponse } from '../SecretsResponse';

export class SecretFinder {
    /**@type {SecretsFinderDomain} is initialized in the constructor */
    #finder;

    /**
     *
     * @param {KnexSecretsVaultRepository} repository
     */
    constructor(repository) {
        this.#finder = new SecretsFinderDomain(repository);
    }

    /**
     *
     * @param {string} id identificator for searcher secret
     * @returns {Promise<SecretsResponse>}
     */
    async execute(id) {
        const secret = await this.#finder.execute(id);
        if (!secret || secret.isDeleted()) {
            throw new CustomError('Secret vault not found', 404);
        }

        return new SecretsResponse(secret);
    }
}
