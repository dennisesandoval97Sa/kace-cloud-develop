import { DomainError } from '../../../shared/index.js';

export class TenantDeleter {
  /** @type {DynamoTenantRepository} */
  #repository;

  /**
   * @param {DynamoTenantRepository} repository
   */
  constructor(repository) {
    this.#repository = repository;
  }

  /**
   * Deletes a Tenant object (soft delete).
   *
   * @param {string} id - The unique identifier of the Tenant object to delete.
   * @returns {Promise<void>} A promise that resolves when the Tenant object is deleted.
   */
  async execute(id) {
    const tenant = await this.#repository.find(id);

    if (!tenant) {
      throw new DomainError(`Tenant not found with id: ${id}`, 'id');
    }

    await this.#repository.delete(tenant);

    tenant.flushChanges();
  }
}
