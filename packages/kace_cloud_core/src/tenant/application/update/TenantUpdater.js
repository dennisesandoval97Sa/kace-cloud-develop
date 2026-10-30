import { DomainError } from '../../../shared/index.js';

export class TenantUpdater {
  /** @type {DynamoTenantRepository} */
  #repository;

  /**
   * @param {DynamoTenantRepository} repository
   */
  constructor(repository) {
    this.#repository = repository;
  }

  /**
   * Updates a Tenant object in DynamoDB.
   *
   * @param {string} id - The unique identifier of the Tenant object to update.
   * @param {Object} dto - The data transfer object containing the properties to update in the Tenant object.
   * @returns {Promise<Tenant>} A promise that resolves with the updated Tenant.
   */
  async execute(id, dto) {
    const tenant = await this.#repository.find(id);

    if (!tenant) {
      throw new DomainError(`Tenant not found with id: ${id}`, 'id');
    }

    tenant.update(dto);

    const hasChange =
      Object.keys(tenant.changedAttributes).filter((key) => {
        return key !== 'updated_at' && key !== 'updated_by';
      }).length > 0;

    if (!hasChange) {
      return tenant;
    }

    await this.#repository.save(tenant);

    tenant.flushChanges();

    return tenant;
  }
}
