import { ValueObjectUuid } from '../../shared';

export class SecretsFinder {
    /** @type {KnexSecretsVaultRepository} is initialized in the constructor */
    #repository;

    /**
     *
     * @param {KnexSecretsVaultRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {string} id identifier of the secret to search
     * @returns {Promise<SecretsVault|null>} the secret found or null if not found
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
