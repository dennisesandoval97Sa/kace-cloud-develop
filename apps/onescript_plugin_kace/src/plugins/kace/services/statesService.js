import { BaseService } from './baseService';
import { buildEmbeddedTransitionsListFromCase } from '#plugins/kace/utils/hydrateEditCaseToStore.js';

export class StatesService extends BaseService {
  /**
   * @param {Object} params
   * @param {import('./apiService').ApiService} params.apiService
   * @param {any} params.store
   * @param {(eventName: string, payload: any) => void} [params.emitEvent]
   */
  constructor({ apiService, store, emitEvent }) {
    super({ store });
    this.api = apiService;
    this.emitEvent = emitEvent;
  }

  /**
   * Fetches current transition details by transition id.
   * @param {Object} params
   * @param {string|number|null} [params.transition_id=null]
   * @returns {Promise<any>}
   */
  async fetchCurrentTransition({ transition_id = null }) {
    try {
      if (!transition_id) throw new Error('transition_id is required');

      const response = await this.api.get(`/transitions/${transition_id}`);
      if (response.status === 200 && response.data) {
        return response.data.data;
      }
    } catch (error) {
      throw new Error(
        `Error al obtener datos de transiciones:: ${error.message}`
      );
    }
  }

  /**
   * Fetches available transitions for a given flow.
   * @param {Object} params
   * @param {string|number|null} [params.flowId=null]
   * @returns {Promise<any[]>}
   */
  async fetchTransitionsData({ flowId = null }) {
    try {
      if (!flowId) throw new Error('flow id is required');

      const caseRow = this.storeService?.get?.('cases.case_data');
      const embedded = buildEmbeddedTransitionsListFromCase(caseRow);
      if (
        embedded &&
        Array.isArray(embedded.transitionsData) &&
        embedded.transitionsData.length > 0 &&
        String(embedded.flowId) === String(flowId)
      ) {
        return embedded.transitionsData;
      }

      const response = await this.api.post(`/transitions/search`, {
        filter: [
          {
            field: 'transiciones.flujo_id',
            operator: 'eq',
            value: flowId,
            type: 'AND',
          },
          {
            field: 'transiciones.is_visible',
            operator: 'eq',
            value: 'true',
            type: 'AND',
          },
        ],
        limit: 0,
        offset: 0,
        order: {
          direction: 'desc',
          field: 'transiciones.created_at',
        },
        relationship: null,
      });

      if (response.status === 200 && response.data) {
        return response.data.data.items;
      }
    } catch (error) {
      throw new Error(
        `Error al obtener datos de transiciones: ${error.message}`
      );
    }
  }

  /**
   * Fetches state name by state id.
   * @param {Object} params
   * @param {string|number} params.state_id
   * @returns {Promise<string|null>}
   */
  async fetchStateName({ state_id }) {
    try {
      if (!state_id) return null;

      const cache = this.storeService?.get?.('states.names_cache');
      if (cache && typeof cache === 'object' && !Array.isArray(cache)) {
        const hit = cache[String(state_id)];
        if (hit != null && String(hit).trim() !== '') {
          return String(hit);
        }
      }

      const response = await this.api.get(`/states/${state_id}`);
      if (response.status === 200 && response.data) {
        return response.data.data.nombre ?? 'Unknown State';
      }
      return 'Unknown State';
    } catch (error) {
      return 'Unknown State';
    }
  }

  /**
   * Convenience method to fetch current transition + transitions list and toggle loading events.
   * @param {Object} params
   * @param {string|number|null} [params.transition_id=null]
   * @param {string|number|null} [params.flow_id=null]
   * @returns {Promise<{currentTransition: any, transitionsData: any}>}
   */
  async getStatesData({ transition_id = null, flow_id = null }) {
    if (this.emitEvent) {
      this.emitEvent('kaceStatesLoading', true);
      this.emitEvent('kaceAttachmentsLoading', true);
      this.emitEvent('kaceDescriptionLoading', true);
    }
    try {
      const currentTransition = await this.get('states.current_transition', {
        transition_id,
      });
      const transitionsData = await this.get('states.transitions_data', {
        flow_id,
      });

      return { currentTransition, transitionsData };
    } catch (error) {
      throw new Error(`Error al obtener datos de estados: ${error.message}`);
    } finally {
      if (this.emitEvent) {
        this.emitEvent('kaceStatesLoading', false);
        this.emitEvent('kaceAttachmentsLoading', false);
        this.emitEvent('kaceDescriptionLoading', false);
      }
    }
  }
}
