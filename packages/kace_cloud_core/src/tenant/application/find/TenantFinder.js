import { DomainError } from '../../../shared/index.js';

export class TenantFinder {
  /** @type {DynamoTenantRepository} */
  #repository;

  /**
   * @param {DynamoTenantRepository} repository
   */
  constructor(repository) {
    this.#repository = repository;
  }

  /**
   * Finds a Tenant by ID.
   *
   * @param {string} id - The unique identifier of the Tenant object.
   * @returns {Promise<Tenant>} A promise that resolves with the Tenant.
   */
  async execute(id) {
    const tenant = await this.#repository.find(id);

    if (!tenant) {
      throw new DomainError(`Tenant not found with id: ${id}`, 'id');
    }

    return tenant;
  }

  /**
   * Finds a Tenant by subdomain.
   *
   * @param {string} subdomain - The subdomain to search for.
   * @returns {Promise<Tenant>} A promise that resolves with the Tenant.
   */
  async executeByDNS(subdomain) {
    const tenant = await this.#repository.findByDNS(subdomain);

    if (!tenant) {
      throw new DomainError(`Tenant not found with subdomain: ${subdomain}`, 'subdomain');
    }

    return tenant;
  }
}
