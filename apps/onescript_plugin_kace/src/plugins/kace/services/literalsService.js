import { BaseService } from './baseService';

export class LiteralsService extends BaseService {
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
   * Fetches literals by entity/type reference.
   * @param {Object} params
   * @param {string|number|null} params.entityId
   * @param {boolean} [params.forceRefresh=false] - Omite caché HTTP (p. ej. `refetchOnEveryOpen` en literales).
   * @returns {Promise<Array>} Array of literal items
   */
  async fetchAuxReference({ entityId, forceRefresh = false }) {
    try {
      const refreshConfig = forceRefresh ? { __kaceForceRefresh: true } : {};
      const response = await this.api.post(
        '/literals/search',
        {
          filter: [
            {
              field: 'tipo_literal',
              operator: entityId ? 'eq' : 'null',
              type: 'AND',
              value: entityId || 'null',
            },
            {
              field: 'is_active',
              operator: 'eq',
              type: 'AND',
              value: '1',
            },
            {
              field: 'deleted_at',
              operator: 'null',
              type: 'AND',
              value: 'null',
            },
          ],
          limit: 0,
          offset: 0,
          order: {
            direction: 'desc',
            field: 'created_at',
          },
          relationship: null,
        },
        refreshConfig
      );

      if (response.status === 200 && response.data) {
        return response?.data?.data?.items || [];
      }

      return [];
    } catch (error) {
      throw new Error(`Error al obtener datos: ${error.message}`);
    }
  }
}
