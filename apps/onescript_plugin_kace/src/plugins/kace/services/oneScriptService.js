import { BaseService } from './baseService';

export class OneScriptService extends BaseService {
  /**
   * @param {Object} params
   * @param {import('./apiService').ApiService} params.apiService
   * @param {any} params.store
   * @param {import('./classificationsService').ClassificationsService} [params.classificationsService]
   */
  constructor({ apiService, store, classificationsService }) {
    super({ store });
    this.api =
      apiService ?? globalThis?.KACE_ENGINE?.getService('apiService') ?? null;
    this.classificationsService =
      classificationsService ??
      globalThis?.KACE_ENGINE?.getService('classifications') ??
      null;
  }

  /**
   * Orchestrates fetching the schema, group relationships, and form schema.
   * @param {Object} params
   * @param {string|null} params.classificationId
   * @param {boolean} params.isCaseModule
   * @param {string|null} params.oneScriptFormId
   * @param {string|null} params.oneScriptSchemaApi
   * @param {string|null} params.groupId
   * @returns {Promise<{ oneScriptData: any, formSchema: any }>}
   */
  async getSchema({ oneScriptFormId = null, groupId = null }) {
    try {
      const oneScriptData = await this.fetchOneScriptData(oneScriptFormId);

      let formSchema = null;
      if (oneScriptData?.url_api) {
        formSchema = await this.fetchFormSchema(oneScriptData.url_api);
      }

      return { oneScriptData, formSchema };
    } catch (error) {
      throw new Error(`Error al obtener el esquema: ${error.message}`);
    }
  }

  /**
   * Fetch the form schema from an external schema API URL (not our API).
   * @param {string} schemaApiUrl - The full URL to fetch the schema from
   * @returns {Promise<Object|null>} The components schema or null
   */
  async fetchFormSchema(schemaApiUrl) {
    if (!schemaApiUrl) return null;
    try {
      const response = await this.api.get(schemaApiUrl, {
        headers: { 'Content-Type': 'application/json' },
        kace_request: false,
      });
      const data = response?.data ?? null;
      if (!response || (response.status && response.status >= 400)) {
        throw new Error(`HTTP ${response?.status ?? 'error'}`);
      }
      if (data && data.schemaData && data.schemaData.components) {
        return data.schemaData.components;
      }
      return null;
    } catch (error) {
      throw new Error(
        `Error al obtener el esquema del formulario: ${error.message}`
      );
    }
  }

  /**
   * Fetches OneScript metadata/config for a given OneScript form id.
   * @param {string|number|null} oneScriptFormId
   * @returns {Promise<{schema_id: any, url_api: any, name: any} | null>}
   */
  async fetchOneScriptData(oneScriptFormId) {
    if (!oneScriptFormId) return null;
    try {
      if (!this.api || typeof this.api.get !== 'function') {
        return null;
      }

      const response = await this.api.get(`/one_script/${oneScriptFormId}`);
      if (response.status === 200 && response.data) {
        const raw = response.data.data || {};
        const schema_id =
          raw.schema_id ?? raw.schemaId ?? raw.schema?.id ?? null;
        const url_api =
          raw.url_api ?? raw.urlApi ?? raw.schema_url ?? raw.url ?? null;
        const name = raw.name ?? raw.form_name ?? raw.title ?? null;
        return { ...raw, schema_id, url_api, name };
      }
      return null;
    } catch (error) {
      throw new Error(`Error al obtener datos de un script:: ${error.message}`);
    }
  }
}
