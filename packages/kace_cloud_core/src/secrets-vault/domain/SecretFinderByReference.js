import { ValueObjectReference } from './ValueObjectReference';

export class SecretFinderByReference {
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
     * @param {string} reference reference for secret to search
     * @returns {Promise<SecretsVault|null>} the secret instance or nulll if not found
     * @throws {Error} if the repository throws an error
     */
    async execute(reference) {
        return this.#repository.findByReference(new ValueObjectReference('Referencia', reference));
    }
}
