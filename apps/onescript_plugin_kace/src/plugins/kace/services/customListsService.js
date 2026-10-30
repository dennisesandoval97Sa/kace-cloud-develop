import { BaseService } from './baseService';

export class CustomListsService extends BaseService {
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
   * Fetch a custom list by its ID.
   * @param {string|number} id - The custom list ID
   * @param {string} url_api - The base API URL
   * @returns {Promise<Object|null>} The custom list data or null
   */
  async fetchCustomListsById(id, url_api) {
    try {
      const response = await this.api.get(`${url_api}/customlists/${id}`);
      if (response.status === 200 && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      throw new Error(`Error al obtener datos: ${error.message}`);
    }
  }
}
