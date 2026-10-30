import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import Tenant from '../../domain/Tenant.js';
import {DomainError, Helper} from '../../../shared/index.js';

export default class DynamoTenantRepository {
  /** @type {string} is initialized in the constructor*/
  #tableName;

  /** @type {string} is initialized in the constructor*/
  #region;

  /** @type {DynamoDBDocumentClient} is initialized in the constructor*/
  #client;
  constructor(tableName = null, clientRegion = null) {
    if (!tableName) {
      tableName = process.env.TARGET_DYNAMODB_TABLE;
    }
    if (!clientRegion) {
      clientRegion = process.env?.TARGET_DYNAMODB_REGION ?? 'us-east-1';
    }

    this.#tableName = tableName;
    this.#region = clientRegion;
    this.#client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: clientRegion }));
  }

  /**
   * Finds a Tenant by subdomain (primary key)
   * @param {string} id - The tenant subdomain
   * @returns {Promise<Tenant|null>} The Tenant instance or null if not found
   */
  async find(id) {
    const command = new GetCommand({
      TableName: this.#tableName,
      Key: {
        id: id,
      },
    });

    try {
      const response = await this.#client.send(command);

      if (!response.Item) {
        return null;
      }

      return new Tenant(response.Item);
    } catch (error) {
      Helper.logError(`Error finding tenant by id: ${error.message}`,error);
      throw new DomainError(`Error finding tenant by id: ${error.message}`);
    }
  }

  /**
   * Saves a Tenant aggregate to DynamoDB
   * @param {Tenant} tenant - The tenant aggregate to persist
   * @returns {Promise<void>}
   */
  async save(tenant) {
    const item = tenant.toJson();

    const command = new PutCommand({
      TableName: this.#tableName,
      Item: item,
    });

    try {
      await this.#client.send(command);
    } catch (error) {
      Helper.logError(`Error saving tenant: ${error.message}`);
      throw new Error(`Error saving tenant: ${error.message}`);
    }
  }

  /**
   * Scans all tenants with pagination support
   * @param {Object} options - Scan options
   * @param {number} options.limit - Max items to return (default: 20)
   * @param {Object} options.lastEvaluatedKey - Key to continue from (for pagination)
   * @returns {Promise<{items: Tenant[], lastEvaluatedKey: Object|null}>}
   */
  async scan(options = {}) {
    const { limit = 20, lastEvaluatedKey = null } = options;

    const params = {
      TableName: this.#tableName,
      Limit: limit,
    };

    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }

    const command = new ScanCommand(params);

    try {
      const response = await this.#client.send(command);

      const items = (response.Items || []).map((item) => new Tenant(item));

      return {
        items,
        lastEvaluatedKey: response.LastEvaluatedKey || null,
      };
    } catch (error) {
      Helper.logError(`Error scanning tenants: ${error.message}`);
      throw new DomainError(`Error scanning tenants: ${error.message}`);
    }
  }

  /**
   * Finds all tenants (iterates through all pages)
   * @returns {Promise<Tenant[]>} Array of all tenant instances
   */
  async findAll() {
    const allTenants = [];
    let lastEvaluatedKey = null;

    try {
      do {
        const result = await this.scan({
          limit: 100, // Usar límite más alto para eficiencia
          lastEvaluatedKey,
        });

        allTenants.push(...result.items);
        lastEvaluatedKey = result.lastEvaluatedKey;
      } while (lastEvaluatedKey);

      Helper.logDebug(`Found ${allTenants.length} tenants in total`);

      return allTenants;
    } catch (error) {
      Helper.logError(`Error finding all tenants: ${error.message}`);
      throw new DomainError(`Error finding all tenants: ${error.message}`);
    }
  }

  /**
   * Deletes a Tenant by subdomain (primary key)
   * @param {Tenant} tenant - The tenant subdomain to delete
   * @returns {Promise<void>}
   * @throws {DomainError} If the tenant does not exist or deletion fails
   */
  async delete(tenant) {
    const command = new DeleteCommand({
      TableName: this.#tableName,
      Key: {
        id: tenant.id.value,
      },
    });

    try {
      await this.#client.send(command);
      Helper.logDebug(`Tenant with id '${tenant.id.value}' deleted successfully`);
    } catch (error) {
      Helper.logError(`Error deleting tenant with id '${tenant.id.value}': ${error.message}`);
      throw new DomainError(`Error deleting tenant: ${error.message}`);
    }
  }
}
