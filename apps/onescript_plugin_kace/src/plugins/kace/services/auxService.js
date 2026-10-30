import { BaseService } from './baseService';
import SchemaBuilder from '@kace/schemabuilder/src/SchemaBuilder.js';
import {
  DEFAULT_IGNORE_SCHEMA_KEYS,
  STORE_KEY_IGNORE_SCHEMA_KEYS,
} from '#plugins/kace/utils/getIgnoreSchemaKeysFromComponent.js';
import { removeKeysFromSubmissionData } from '#plugins/kace/utils/removeKeysFromSubmissionData.js';

export class AuxService extends BaseService {
  /**
   * @param {Object} params
   * @param {import('./apiService').ApiService} params.apiService
   * @param {any} params.store
   */
  constructor({ apiService, schemaService, store }) {
    super({ store });
    this.api = apiService;
    this.schemaService = schemaService;
  }

  /**
   * Fetch and extract the validation schema, handling nested data_structure logic.
   * @param {Object} params
   * @param {boolean} params.isCaseModule - Whether this is a case module
   * @param {string} params.schemaId - The schema id to fetch
   * @param {Object} params.auxCasesSchema - The aux cases schema object (optional)
   * @param {string} params.keySchema - The key of the schema to fetch (optional)
   * @param {boolean} [params.forceRefresh] - No usar caché al obtener reglas (p. ej. cambio de clasificación)
   * @returns {Promise<Object>} The validation schema object
   */
  async fetchValidationSchema({
    isCaseModule,
    schemaId,
    auxCasesSchema,
    keySchema = null,
    forceRefresh = false,
  }) {
    try {
      if (schemaId) {
        const data_structure = await this.fetchAuxSchema({
          schemaId,
          forceRefresh,
        });
        return { ...data_structure };
      }

      const aux_cases_data_structure = auxCasesSchema?.data_structure ?? {};
      const found = Object.entries(aux_cases_data_structure).find(
        ([key, value]) =>
          keySchema
            ? value?.schema_id === schemaId && key === keySchema
            : value?.schema_id === schemaId
      );
      if (found) {
        const [key, value] = found;
        return { data_structure: { [key]: value } };
      }

      throw new Error(
        'No se encontró la estructura de datos en aux_cases para el esquema proporcionado.'
      );
    } catch (error) {
      throw new Error(
        `Error al obtener el esquema de validación: ${error.message}`
      );
    }
  }

  /**
   * Fetch auxiliary data for a given entity and field, with optional filter.
   * @param {Object} params
   * @param {string} params.entity - The auxiliary entity name
   * @param {string} params.field - The field to fetch
   * @param {Object|null} params.filter - Optional filter object { path, value }
   * @param {boolean} [params.forceRefresh=false] - Omite caché HTTP (p. ej. `refetchOnEveryOpen` en selects auxiliares).
   * @returns {Promise<Array>} Array of data
   */
  async fetchAuxiliaryData({
    entity,
    field,
    filter = null,
    forceRefresh = false,
  }) {
    try {
      if (!entity || !field) {
        throw new Error('La entidad y el campo son obligatorios');
      }

      const refreshConfig = forceRefresh ? { __kaceForceRefresh: true } : {};

      let response;

      if (!filter) {
        response = await this.api.get(
          `/auxiliaries/${entity}/list?field=${field}`,
          refreshConfig
        );
      } else {
        const filterPayload = {
          filter: [
            {
              field: 'data',
              operator: 'jsonContains',
              value: JSON.stringify({ [filter.path]: filter.value }),
              type: 'AND',
            },
          ],
          limit: 0,
          offset: 0,
        };

        response = await this.api.post(
          `/auxiliaries/${entity}/list/search?field=${field}`,
          filterPayload,
          refreshConfig
        );
      }
      if (response.status === 200 && response.data) {
        return response.data.data || [];
      }
      return [];
    } catch (error) {
      throw new Error(
        `Error al obtener los datos auxiliares: ${error.message}`
      );
    }
  }

  /**
   * Fetch motivos (reasons) using fetchAuxiliaryData with fixed entity and field.
   * @param {string} endpoint - Optional endpoint/entity name, defaults to 'motivos_pausa'
   * @returns {Promise<Array>} Array of motivos
   */
  async fetchAuxMotivos({ endpoint = 'motivos_pausa' }) {
    return this.fetchAuxiliaryData({
      entity: endpoint,
      field: 'motivo',
      filter: null,
    });
  }

  /**
   * Fetches a list of literals for a given auxiliary entity.
   * @param {Object} params
   * @param {string} params.entity
   * @param {Array} [params.filter=[]]
   * @returns {Promise<Array>}
   */
  async fetchAuxLiteralList({ entity, filter = [] }) {
    if (!entity) return [];

    try {
      const response = await this.api.post(`/auxiliaries/${entity}/search`, {
        filter,
        limit: 0,
        offset: 0,
      });
      if (response.status === 200 && response.data) {
        return response.data.data.items;
      }
      return [];
    } catch (error) {
      throw new Error(
        `Error al obtener la lista de literales auxiliares: ${error.message}`
      );
    }
  }

  /**
   * Fetches an auxiliary schema rules definition.
   * @param {Object} params
   * @param {string} params.schemaId
   * @param {boolean} [params.forceRefresh] - No usar caché HTTP (p. ej. al cambiar clasificación del subcaso).
   * @returns {Promise<Object>}
   */
  async fetchAuxSchema({ schemaId, forceRefresh = false }) {
    if (!schemaId) throw new Error('schemaId is required');
    const res = await this.api.get(
      `/schemas/${schemaId}/rules`,
      forceRefresh ? { __kaceForceRefresh: true } : {}
    );
    if (res.status === 200 && res.data) {
      return res.data.data;
    }
    throw new Error('No se pudo obtener el esquema auxiliar');
  }

  /**
   * Resolves the "cases" auxiliary schema definition and returns its schema rules.
   * @param {Object} [options]
   * @param {boolean} [options.forceRefresh] - No usar caché en definiciones y reglas de esquema.
   * @returns {Promise<Object>}
   */
  async fetchAuxCasesSchema({ forceRefresh = false } = {}) {
    const response = await this.api.get(
      `/aux-definitions`,
      forceRefresh ? { __kaceForceRefresh: true } : {}
    );
    if (response.status === 200 && response.data) {
      const definitions = response.data.data.items ?? [];
      const casesSchema = definitions.find((item) => item.name === 'cases');
      if (!casesSchema || !casesSchema.schema_id) {
        throw new Error('No se encontró ningún esquema de casos auxiliares');
      }

      return await this.fetchAuxSchema({
        schemaId: casesSchema.schema_id,
        forceRefresh,
      });
    }
    throw new Error('No se pudo obtener el esquema de casos auxiliares');
  }

  /**
   * Fetches the `aux_cases` definition schema and a OneScript form rules schema in a single
   * `POST /schemas/rules/search` request, replacing the legacy chain of
   * `GET /aux-definitions` + 2 × `GET /schemas/:id/rules`.
   *
   * @param {Object} params
   * @param {string} params.schemaId - OneScript form `schema_id`
   * @param {string} [params.name='aux_cases'] - Filter for the definitions schema by name
   * @param {boolean} [params.forceRefresh=false] - Skip HTTP cache (e.g. classification change)
   * @returns {Promise<{ auxCasesSchema: Object|null, validationSchema: Object|null }>}
   */
  async fetchSchemasRulesBundle({
    schemaId,
    name = 'aux_cases',
    forceRefresh = false,
  }) {
    if (!schemaId) throw new Error('schemaId es obligatorio');
    const filter = [
      { field: 'name', operator: 'eq', value: name, type: 'AND' },
      { field: 'id', operator: 'eq', value: schemaId, type: 'OR' },
    ];
    const config = forceRefresh ? { __kaceForceRefresh: true } : {};

    const responseData = await this.schemaService.fetchRulesSearch({
      body: { filter, limit: 0, offset: 0 },
      forceRefresh,
      config,
    });

    if (!responseData) {
      throw new Error('No se pudo obtener los esquemas de reglas');
    }

    const payload = responseData.data ?? {};
    const items = Array.isArray(payload.items)
      ? payload.items
      : Array.isArray(payload)
        ? payload
        : [];

    let auxCasesSchema = null;
    let validationSchema = null;
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      if (
        validationSchema == null &&
        item.id != null &&
        String(item.id) === String(schemaId)
      ) {
        validationSchema = item;
        continue;
      }
      if (auxCasesSchema == null && item.name === name) {
        auxCasesSchema = item;
      }
    }

    return { auxCasesSchema, validationSchema };
  }

  /**
   * Validate a payload against a provided data_structure using SchemaBuilder.
   * Strips configured ignoreSchemaKeys (e.g. kaceSubcases) from payload before validation
   * so component-injected keys do not cause schema validation errors.
   * @param {Object} params
   * @param {Object} params.data_structure - The schema data structure to validate against (required)
   * @param {Object} params.payload - The payload to validate
   * @param {boolean} params.isUpdate - Whether the payload is being updated (true) or created (false)
   * @throws {Error} If data_structure is missing or validation fails
   */
  async validateSchema({ data_structure, payload, isUpdate = false }) {
    if (!data_structure) {
      throw new Error(
        'No se proporcionó ninguna data_structure para la validación del esquema'
      );
    }
    const keysToIgnore =
      (this.storeService &&
        this.storeService.get(STORE_KEY_IGNORE_SCHEMA_KEYS)) ??
      DEFAULT_IGNORE_SCHEMA_KEYS;
    const payloadForValidation =
      keysToIgnore.length > 0
        ? (() => {
            const cloned = JSON.parse(JSON.stringify(payload ?? {}));
            removeKeysFromSubmissionData(cloned, keysToIgnore);
            return cloned;
          })()
        : (payload ?? {});

    const schemaBuilderResult = await SchemaBuilder.build(data_structure);
    const { error } = schemaBuilderResult.validate(payloadForValidation, {
      context: { isUpdate },
    });

    if (error) {
      throw new Error(
        `Algunos campos del formulario auxiliar presentan errores de validación: ${error?.details[0].message}`
      );
    }
  }

  /**
   * Fetches history items for an auxiliary entity (paginated).
   * @param {Object} params
   * @param {string} params.primary_entity - Entity name (aux_ prefix is stripped)
   * @param {string} params.entity_id - Entity id
   * @param {number} [params.limit=20] - Items per page
   * @param {number} [params.offset=0] - Offset for pagination
   * @returns {Promise<Array>} Array of history items
   */
  async fetchAuxHistory({ primary_entity, entity_id, limit = 20, offset = 0 }) {
    if (!primary_entity || !entity_id) {
      throw new Error('Se requieren la entidad principal y el ID de entidad.');
    }
    const primaryEntity = primary_entity.replace(/^aux_/, '');
    const url = `/auxiliaries/${primaryEntity}/${entity_id}/history`;
    const payload = {
      order: {
        field: 'created_at',
        direction: 'DESC',
      },
      limit,
      offset,
    };
    const response = await this.api.post(url, payload);
    if (response.status === 200 && response.data) {
      return response.data.data.items ?? [];
    }
    return [];
  }
}
