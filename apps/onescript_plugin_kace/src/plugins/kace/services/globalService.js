import { BaseService } from './baseService';

export class GlobalService extends BaseService {
  /**
   * @param {Object} params
   * @param {import('./apiService').ApiService} params.apiService
   * @param {any} params.store
   */
  constructor({ apiService, store }) {
    super({ store });
    this.api = apiService;
  }

  /**
   * Fetch data from an endpoint, normalizing the path and handling errors.
   * @param {string} endpoint
   * @param {string} url_api
   * @returns {Promise<Object|null>}
   */
  async fetchEndpointData(endpoint, url_api) {
    try {
      if (!endpoint) {
        throw new Error('El endpoint es requerido');
      }

      const normalizedEndpoint = endpoint.startsWith('/')
        ? endpoint
        : `/${endpoint}`;

      const response = await this.api.get(`${url_api}${normalizedEndpoint}`, {
        filter: [],
        limit: 0,
        offset: 0,
      });
      if (response.status === 200 && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      throw new Error(
        `Error al obtener datos de ${endpoint}: ${error.message}`
      );
    }
  }
}
