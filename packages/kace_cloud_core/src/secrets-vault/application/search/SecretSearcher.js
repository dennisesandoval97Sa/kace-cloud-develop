import { Criteria } from '../../../shared/criteria/Criteria';
import { SecretsCounter } from '../../domain/SecretsCounter';
import { SecretsCollectionResponse } from '../SecretsCollectionResponse';

export class SecretSearcher {
    /**@type {KnexSecretsVaultRepository} is initialized in the constructor */ #repository;
    /**@type {SecretsCounter} is initialized in the constructor */ #counter;

    /**
     *
     * @param {KnexSecretsVaultRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#counter = new SecretsCounter(this.#repository);
    }

    /**
     *
     * @param {object} dtoCriteria data criteria to search
     * @returns {Promise<SecretsCollectionResponse>}
     */
    async execute(dtoCriteria) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(
            dtoCriteria.filter,
            dtoCriteria.relationship,
            dtoCriteria.limit,
            dtoCriteria.offset,
            dtoCriteria.order,
            tablename
        );
        const secrets = await this.#repository.search(criteria);
        const counter = await this.#counter.execute({
            filter: dtoCriteria.filter,
            relationship: dtoCriteria.relationship,
        });

        return new SecretsCollectionResponse(secrets, counter);
    }
}
