import { BaseService } from './baseService';

export class GroupService extends BaseService {
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
   * Searches for groups in the database.
   * @param {Object} [args={}]
   * @param {string} [storeKey='groups.search_groups_data']
   * @returns {Promise<any>}
   */
  async searchGroups(args = {}, storeKey = null) {
    try {
      let groupsData = storeKey ? this.storeService.get(storeKey) : null;

      if (!groupsData) {
        const response = await this.api.post('/groups/search', args);
        if (response.status === 200 && response.data) {
          if (storeKey) {
            this.storeService.set(storeKey, response.data.data);
          }
          return response.data.data;
        }
      }

      return groupsData;
    } catch (e) {
      throw new Error('No se pudieron obtener los datos de los grupos');
    }
  }

  async searchUserGroups(args = {}, storeKey = null) {
    try {
      let groupsData = storeKey ? this.storeService.get(storeKey) : null;

      if (!groupsData) {
        const response = await this.api.post(
          '/user-group-relationships/search',
          args
        );
        if (response.status === 200 && response.data) {
          if (storeKey) {
            this.storeService.set(storeKey, response.data.data);
          }
          return response.data.data;
        }
      }

      return groupsData;
    } catch (e) {
      throw new Error(
        'No se pudieron obtener los datos de los grupos de usuario'
      );
    }
  }
}
