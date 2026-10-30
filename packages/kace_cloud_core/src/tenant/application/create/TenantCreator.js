import Tenant from '../../domain/Tenant.js';

export class TenantCreator {
  /** @type {DynamoTenantRepository} */
  #repository;

  /**
   * @param {DynamoTenantRepository} repository
   */
  constructor(repository) {
    this.#repository = repository;
  }

  /**
   * Executes the creation of a Tenant object and saves it to DynamoDB.
   *
   * @param {Object} dto - The data transfer object containing the properties for the Tenant object.
   * @returns {Promise<Tenant>} A promise that resolves with the created Tenant.
   */
  async execute(dto) {
    const tenant = new Tenant(dto);

    await this.#repository.save(tenant);

    return tenant;
  }
}
