import { ValueObjectReference } from './ValueObjectReference';

export class SecretsFinderByReferences {
    /** @type {KnexSecretsVaultRepository} */
    #repository;

    /**
     * @param {KnexSecretsVaultRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * @param {string[]|null|undefined} references
     * @returns {Promise<SecretsVault[]>}  only secrets that exist; missing refs are absent
     * @throws {Error} if the repository throws an error
     */
    async execute(references) {
        if (!Array.isArray(references) || references.length === 0) return [];
        const valueObjects = references.map((r) => new ValueObjectReference('Referencia', r));
        return this.#repository.findByReferences(valueObjects);
    }
}
