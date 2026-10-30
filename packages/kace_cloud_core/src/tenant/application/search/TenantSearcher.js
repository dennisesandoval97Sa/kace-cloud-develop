export class TenantSearcher {
  /** @type {DynamoTenantRepository} */
  #repository;

  /**
   * @param {DynamoTenantRepository} repository
   */
  constructor(repository) {
    this.#repository = repository;
  }

  /**
   * Searches/lists tenants with pagination.
   *
   * @param {Object} options - Search options
   * @param {number} options.limit - Max items to return
   * @param {Object} options.lastEvaluatedKey - Key to continue from
   * @returns {Promise<{items: Tenant[], lastEvaluatedKey: Object|null}>}
   */
  async execute(options = {}) {
    const result = await this.#repository.scan(options);

    return {
      items: result.items.map((tenant) => tenant.toJson()),
      lastEvaluatedKey: result.lastEvaluatedKey,
    };
  }
}
