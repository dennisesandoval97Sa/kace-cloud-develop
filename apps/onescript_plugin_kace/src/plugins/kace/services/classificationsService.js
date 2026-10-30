import { BaseService } from './baseService';
import { storeService } from '#plugins/kace/services/storeService.js';

/**
 * @param {unknown} os
 * @returns {string | null}
 */
function oneScriptFormIdFromCasePayload(os) {
  if (!os || typeof os !== 'object') {
    return null;
  }
  const o = /** @type {Record<string, unknown>} */ (os);
  const raw =
    o.one_script_id ?? o.one_script_form_id ?? o.form_id ?? o.form ?? null;
  if (raw == null) {
    return null;
  }
  const s = String(raw).trim();
  return s !== '' ? s : null;
}

/**
 * Resuelve el id de formulario OneScript para el caso en edición: objeto `one_script`,
 * campos planos del caso o `oneScript.one_script_form_id` en store.
 *
 * @param {Record<string, unknown> | null | undefined} caseRow
 * @param {{ get?: (path: string) => unknown }} storeService
 * @returns {string | null}
 */
function resolveOneScriptFormIdFromCaseOrStore(caseRow, storeService) {
  let formId = oneScriptFormIdFromCasePayload(caseRow?.one_script);
  if (formId) {
    return formId;
  }
  if (caseRow && typeof caseRow === 'object') {
    const top =
      caseRow.one_script_form_id ??
      caseRow.one_script_id ??
      caseRow.form_id ??
      null;
    if (top != null) {
      const s = String(top).trim();
      if (s !== '') {
        formId = s;
      }
    }
  }
  if (!formId && storeService?.get) {
    const fromStore = storeService.get('oneScript.one_script_form_id');
    if (fromStore != null && String(fromStore).trim() !== '') {
      formId = String(fromStore).trim();
    }
  }
  return formId ?? null;
}

export class ClassificationsService extends BaseService {
  /**
   * @param {Object} params
   * @param {import('./apiService').ApiService} params.apiService
   * @param {any} params.store
   * @param {import('./userService').UserService} params.userService
   * @param {(eventName: string, payload: any) => void} [params.emitEvent]
   */
  constructor({ apiService, store, userService, emitEvent }) {
    super({ store });

    this.api = apiService;
    this.userService = userService;
    this.emitEvent = emitEvent;
  }

  /**
   * Fetches the case classification items for a given case.
   * @param {Object} params
   * @param {string|number} params.caseId
   * @returns {Promise<any[]>}
   */
  async fetchCaseClassification({ caseId }) {
    if (!caseId) throw new Error('caseId is required');

    const caseRow = this.storeService.get('cases.case_data');
    if (
      caseRow &&
      typeof caseRow === 'object' &&
      caseRow.clasificacion &&
      typeof caseRow.clasificacion === 'object' &&
      caseRow.clasificacion_id != null &&
      String(caseRow.clasificacion_id) === String(caseId)
    ) {
      return [caseRow.clasificacion];
    }

    if (
      !this.api &&
      typeof globalThis !== 'undefined' &&
      globalThis.KACE_ENGINE
    ) {
      const fallback = globalThis.KACE_ENGINE.getService('apiService');
      if (fallback) {
        this.api = fallback;
      }
    }

    const response = await this.api.post('/classifications/search', {
      filter: [
        {
          field: 'clasificaciones.id',
          operator: 'eq',
          value: caseId,
          type: 'AND',
        },
        {
          field: 'clasificaciones.deleted_by',
          value: 'null',
          type: 'AND',
          operator: 'null',
        },
      ],
      limit: 1,
      offset: 0,
    });

    if (response.status === 200 && response.data) {
      return response.data.data.items;
    }

    throw new Error('No se pudo obtener la clasificación del caso');
  }

  /**
   * Fetches a single classification by ID using GET.
   * @param {Object} params
   * @param {string|number} params.id
   * @returns {Promise<any>}
   */
  async fetchClassification({ id }) {
    if (!id) throw new Error('ID es requerido');

    if (
      !this.api &&
      typeof globalThis !== 'undefined' &&
      globalThis.KACE_ENGINE
    ) {
      const fallback = globalThis.KACE_ENGINE.getService('apiService');
      if (fallback) {
        this.api = fallback;
      }
    }

    const response = await this.api.get(`/classifications/${id}`);

    if (response.status === 200 && response.data) {
      return response.data.data;
    }

    throw new Error(`No se pudo obtener la clasificación con id ${id}`);
  }

  /**
   * Fetches the group-relationship records for a classification + group.
   * @param {Object} params
   * @param {string|number} params.classificationId
   * @param {string|number} params.groupId
   * @returns {Promise<any[]>}
   */
  async fetchClassificationsGroupsRelationship({ classificationId, groupId }) {
    if (!classificationId || !groupId)
      throw new Error('Se requieren el Id. de clasificación y el Id. de grupo');

    if (
      !this.api &&
      typeof globalThis !== 'undefined' &&
      globalThis.KACE_ENGINE
    ) {
      const fallback = globalThis.KACE_ENGINE.getService('apiService');
      if (fallback) {
        this.api = fallback;
      }
    }

    const caseId = this.storeService.get('cases.case_id');
    const generatedCaseId = this.storeService.get('cases.generated_case_id');
    const isEditCase = Boolean(caseId) && !generatedCaseId;
    const caseRow = this.storeService.get('cases.case_data');
    if (isEditCase && caseRow && typeof caseRow === 'object') {
      const caseClid = caseRow.clasificacion_id;
      const selectedGid = this.storeService.get('config.selected_group_id');
      const embed =
        caseRow.clasificacion && typeof caseRow.clasificacion === 'object'
          ? /** @type {Record<string, unknown>} */ (caseRow.clasificacion)
          : null;
      const embedDefaultGid = embed?.default_group_id ?? null;

      const sameClassification =
        caseClid != null && String(caseClid) === String(classificationId);
      const groupOk =
        groupId == null ||
        (caseRow.grupo_id != null &&
          String(caseRow.grupo_id) === String(groupId)) ||
        (embedDefaultGid != null &&
          String(embedDefaultGid) === String(groupId)) ||
        (selectedGid != null && String(selectedGid) === String(groupId));

      if (sameClassification && groupOk) {
        const formId = resolveOneScriptFormIdFromCaseOrStore(
          caseRow,
          this.storeService
        );
        if (formId) {
          return [
            {
              classification_id: classificationId,
              group_id: groupId,
              one_script_id: formId,
              form: formId,
              form_id: formId,
              one_script_form_id: formId,
            },
          ];
        }
      }
    }

    const response = await this.api.post(
      '/classifications-groups-relationships/search',
      {
        filter: [
          {
            field: 'classification_id',
            operator: 'eq',
            value: classificationId,
            type: 'AND',
          },
          {
            field: 'group_id',
            operator: 'eq',
            value: groupId,
            type: 'AND',
          },
        ],
        limit: 0,
        offset: 0,
        order: {
          field: 'form',
          direction: 'desc',
        },
        relationship: null,
      }
    );

    if (response.status === 200 && response.data) {
      return response.data.data.items;
    }

    throw new Error('No se pudo obtener la relación de clasificación de grupo');
  }

  /**
   * Fetches both case classifications and (optionally) group relationships.
   * @param {Object} params
   * @param {string|number} params.caseId
   * @param {string|number|null} [params.parentId=null]
   * @returns {Promise<{caseClassifications: any[], groupClassifications: any[]}>}
   */
  async fetchCaseClassificationRelationships({ caseId, parentId = null }) {
    try {
      this.emitEvent('kaceClassificationsLoading', true);

      const caseClassifications = await this.fetchCaseClassification({
        caseId,
      });
      let groupClassifications = [];
      if (!parentId) {
        const groupId = this.storeService.get('userData.user.grupo_activo');
        if (groupId) {
          groupClassifications =
            await this.fetchClassificationsGroupsRelationship({
              classificationId: caseId,
              groupId,
            });
        }
      }

      this.emitEvent('kaceClassificationsLoading', false);

      return {
        caseClassifications,
        groupClassifications,
      };
    } catch (error) {
      throw new Error(`Error al obtener clasificaciones:: ${error.message}`);
    }
  }

  /**
   * Fetches classifications available to the user's active group.
   * When parentClassificationId is provided, skips fetching the parent case and uses it
   * to GET /classifications/:id and return relations (subcase-allowed classifications).
   * When not provided, uses store cases.parent_id to fetch parent case and derive classification id.
   * @param {Object} [params]
   * @param {string|null} [params.parentClassificationId] - Classification ID of the parent case; when set, parent case fetch is skipped.
   * @param {boolean} [params.forceHttpRefresh=false] - Tras un error, omitir caché HTTP de `apiService` (p. ej. `__kaceForceRefresh`).
   * @param {boolean} [params.fullCatalog=false] - Si es true, no usar la clasificación embebida del caso en edición y cargar el catálogo completo del grupo.
   * @param {string|null} [params.groupId=null] - Grupo por el que filtrar. Por defecto el grupo activo del usuario; la reclasificación pasa el grupo del caso, que es contra el que valida el backend.
   * @returns {Promise<any>}
   */
  async fetchGroupClassification({
    parentClassificationId,
    forceHttpRefresh = false,
    fullCatalog = false,
    groupId = null,
  } = {}) {
    let classificationParentId = parentClassificationId ?? null;
    if (!classificationParentId) {
      const parentId = storeService.get('cases.parent_id');
      let caseParentData = {};
      if (parentId) {
        try {
          const response = await this.api.get(`/cases/${parentId}`);
          if (response.status === 200 && response.data) {
            caseParentData = response.data.data;
          }
        } catch (err) {
          console.error(
            '[ClassificationsService] error fetching parent case',
            err
          );
        }
      }
      classificationParentId = caseParentData?.clasificacion_id ?? null;
    }

    const userData = (await this.userService.get('user.user_data')) || null;

    const caseId = storeService.get('cases.case_id');
    const generatedCaseId = storeService.get('cases.generated_case_id');
    const isEditCase = Boolean(caseId) && !generatedCaseId;
    const caseRowForGroup = storeService.get('cases.case_data');
    if (
      isEditCase &&
      !classificationParentId &&
      !forceHttpRefresh &&
      !fullCatalog &&
      caseRowForGroup &&
      typeof caseRowForGroup === 'object' &&
      caseRowForGroup.clasificacion &&
      typeof caseRowForGroup.clasificacion === 'object' &&
      caseRowForGroup.clasificacion_id != null
    ) {
      const emb = /** @type {Record<string, unknown>} */ (
        caseRowForGroup.clasificacion
      );
      const embedId = emb.id ?? emb.clasificacion_id ?? emb.classification_id;
      if (
        embedId != null &&
        String(embedId) === String(caseRowForGroup.clasificacion_id)
      ) {
        return [caseRowForGroup.clasificacion];
      }
    }

    const targetGroup = groupId ?? userData.user.grupo_activo;
    const filter = [
      {
        field: 'classification_group_relationships.group_id',
        operator: 'eq',
        value: targetGroup,
        type: 'AND',
      },
      {
        field: 'clasificaciones.is_active',
        operator: 'eq',
        value: 1,
        type: 'AND',
      },
      {
        field: 'clasificaciones.can_start_sub_cases_flow',
        operator: 'eq',
        value: 'true',
        type: 'AND',
      },
      {
        field: 'clasificaciones.deleted_by',
        value: 'null',
        type: 'AND',
        operator: 'null',
      },
    ];

    const relationship = [
      {
        table: 'classification_group_relationships',
        condition: {
          column: 'clasificaciones.id',
          refColumn: 'classification_group_relationships.classification_id',
        },
        type: 'join',
      },
    ];

    const refreshConfig = forceHttpRefresh ? { __kaceForceRefresh: true } : {};
    let response;
    try {
      if (classificationParentId) {
        response = await this.api.get(
          `/classifications/${classificationParentId}`,
          refreshConfig
        );
      } else {
        response = await this.api.post(
          '/classifications/search',
          {
            filter,
            limit: 0,
            offset: 0,
            order: {
              direction: 'desc',
              field: 'created_at',
            },
            relationship,
          },
          refreshConfig
        );
      }
    } catch (err) {
      console.error(
        '[ClassificationsService] error fetching classifications',
        err
      );
      throw err;
    }

    if (response.status === 200 && response.data) {
      const rawClassifications = classificationParentId
        ? response.data.data?.relations
        : response.data.data.items;
      return rawClassifications;
    }

    throw new Error('No se pudieron obtener las clasificaciones de grupo');
  }
}
