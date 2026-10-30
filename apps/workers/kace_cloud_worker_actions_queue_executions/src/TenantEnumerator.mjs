import DynamoTenantRepository from '@kace/core/src/tenant/infrastructure/aws/DynamoTenantRepository.js';

export class TenantEnumerator {
    #repository;

    constructor(repository = new DynamoTenantRepository()) {
        this.#repository = repository;
    }

    /**
     * Returns all tenants from the multi-tenancy table.
     * @returns {Promise<Tenant[]>}
     */
    async list() {
        return this.#repository.findAll();
    }
}
