import {
  CASE_TRANSITION_STALE,
  CASE_RESPONSIBLE_STALE,
  CASE_CLIENT_STALE,
  CASE_CLASSIFICATION_STALE,
  CASE_GROUP_STALE,
} from '@kace/error-codes';
import { BaseService } from './baseService';
import { v4 as uuidv4 } from 'uuid';
import { storeService } from './storeService';
import { removeKeysFromSubmissionData } from '../utils/removeKeysFromSubmissionData';
import {
  DEFAULT_IGNORE_SCHEMA_KEYS,
  STORE_KEY_IGNORE_SCHEMA_KEYS,
} from '../utils/getIgnoreSchemaKeysFromComponent';
import { invalidateKaceResponseCacheForCases } from '#plugins/kace/utils/kaceResponseCache.js';
import {
  attachAuxiliaryReclassificationComment,
  assertAuxiliaryReclassificationReason,
  ensureAuxiliaryReclassificationTransition,
  hasAuxiliaryReclassificationIntent,
} from '#plugins/kace/utils/attachAuxiliaryReclassificationComment.js';
import { httpErrorMessage } from '#plugins/kace/utils/httpErrorMessage.js';
import { storeConditionFieldLabel } from '#plugins/kace/utils/conditionFieldLabel.js';
import { hydrateEditCaseToStore } from '#plugins/kace/utils/hydrateEditCaseToStore.js';
import { captureEditSnapshotDescription } from '#plugins/kace/utils/editSnapshot.js';
import { buildDirtyAuxiliaryPayload } from '#plugins/kace/utils/buildDirtyAuxiliaryPayload.js';
import {
  applySaveOutcomeToSnapshot,
  extractStaleCodes,
} from '#plugins/kace/utils/applySaveOutcomeToSnapshot.js';
import {
  RECLASSIFICATION_APPLIED_STORE_PATH,
  RECLASSIFICATION_REASON_MIN_LENGTH,
  RECLASSIFICATION_REASON_STORE_PATH,
  RECLASSIFY_PENDING_AUX_MESSAGE,
} from '#plugins/kace/shared/reclassification.constants.js';

export {
  CASE_TRANSITION_STALE,
  CASE_RESPONSIBLE_STALE,
  CASE_CLIENT_STALE,
  CASE_CLASSIFICATION_STALE,
  CASE_GROUP_STALE,
};

export const TRANSITION_STALE_WARNING =
  'El estado del caso fue actualizado automáticamente durante la edición. Se guardaron los demás cambios, pero el estado no fue modificado.';

export const RESPONSIBLE_STALE_WARNING =
  'El responsable del caso fue actualizado automáticamente durante la edición. Se guardaron los demás cambios, pero el responsable no fue modificado.';

export const CLIENTE_STALE_WARNING =
  'El cliente del caso fue actualizado automáticamente durante la edición. Se guardaron los demás cambios, pero el cliente no fue modificado.';

export const CLASSIFICATION_STALE_WARNING =
  'La clasificación del caso fue actualizada automáticamente durante la edición. Se guardaron los demás cambios, pero la clasificación no fue modificada.';

export const GROUP_STALE_WARNING =
  'El grupo del caso fue actualizado automáticamente durante la edición. Se guardaron los demás cambios, pero el grupo no fue modificado.';

export const STALE_CODE_WARNINGS = {
  [CASE_TRANSITION_STALE]: TRANSITION_STALE_WARNING,
  [CASE_RESPONSIBLE_STALE]: RESPONSIBLE_STALE_WARNING,
  [CASE_CLIENT_STALE]: CLIENTE_STALE_WARNING,
  [CASE_CLASSIFICATION_STALE]: CLASSIFICATION_STALE_WARNING,
  [CASE_GROUP_STALE]: GROUP_STALE_WARNING,
};

const normalizeId = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  if (!normalized || normalized === 'null' || normalized === 'undefined') {
    return null;
  }
  return normalized;
};

const safeStoreGet = (storeServiceInstance, key) => {
  try {
    return storeServiceInstance?.get?.(key);
  } catch {
    return undefined;
  }
};

const INTERACTION_ID_KEYS = ['interaction_id', 'interactionId'];
const INTERACTION_STORE_KEYS = [
  'interactions.interaction_id',
  'interactions.interactionId',
  'cases.interaction_id',
  'cases.interactionId',
];

const getUrlParam = (key) => {
  try {
    if (typeof window === 'undefined') return null;
    return normalizeId(new URLSearchParams(window.location.search).get(key));
  } catch {
    return null;
  }
};

const hasUrlParam = (key) => {
  try {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).has(key);
  } catch {
    return false;
  }
};

const resolveInteractionId = (storeServiceInstance) => {
  const handshakeParams = safeStoreGet(
    storeServiceInstance,
    'auth.handshake_params'
  );
  const candidates = [
    handshakeParams?.interaction_id,
    handshakeParams?.interactionId,
    safeStoreGet(storeServiceInstance, 'interactions.interaction_id'),
    safeStoreGet(storeServiceInstance, 'interactions.interactionId'),
    safeStoreGet(storeServiceInstance, 'cases.interaction_id'),
    safeStoreGet(storeServiceInstance, 'cases.interactionId'),
    getUrlParam('interaction_id'),
    getUrlParam('interactionId'),
  ];

  for (const candidate of candidates) {
    const id = normalizeId(candidate);
    if (id) return id;
  }
  return null;
};

const warnMissingInteractionId = () => {
  if (typeof console === 'undefined' || !console.warn) return;

  console.warn(
    '[Kace] CaseService.createCase: no interaction_id found; skipping interaction-case relation'
  );
};

const hasInteractionContextHint = (storeServiceInstance) => {
  const handshakeParams = safeStoreGet(
    storeServiceInstance,
    'auth.handshake_params'
  );
  if (
    handshakeParams &&
    typeof handshakeParams === 'object' &&
    INTERACTION_ID_KEYS.some((key) =>
      Object.prototype.hasOwnProperty.call(handshakeParams, key)
    )
  ) {
    return true;
  }

  if (
    INTERACTION_STORE_KEYS.some((key) => {
      const value = safeStoreGet(storeServiceInstance, key);
      return value !== undefined;
    })
  ) {
    return true;
  }

  return INTERACTION_ID_KEYS.some((key) => hasUrlParam(key));
};

const resolveCreatedCaseId = (caseData, response) => {
  // The backend replaces request-body ids with server-generated ones, so the
  // response is the source of truth; the local id is only a legacy fallback.
  const candidates = [
    response?.data?.data?.case?.id,
    response?.data?.data?.id,
    response?.data?.case?.id,
    caseData?.case?.id,
  ];

  for (const candidate of candidates) {
    const id = normalizeId(candidate);
    if (id) return id;
  }
  return null;
};

/**
 * ¿La marca de «reclasificación ya aplicada» es de este caso?
 *
 * La marca vive en el store, que sobrevive al cambio de caso (localStorage), y guarda su
 * `case_id` justo para esto: sin compararlo, un residuo del caso A haría que un fallo de
 * guardado del caso B se anunciara como una reclasificación a medias que nunca ocurrió —y que
 * un guardado correcto de B borrara la marca que A todavía necesita. Mismo criterio que
 * `applyPendingReclassification`.
 *
 * @param {{ get: (path: string) => any }} store
 * @param {string|number|null|undefined} caseId
 * @returns {boolean}
 */
const hasPendingReclassificationFor = (store, caseId) => {
  const applied = store?.get?.(RECLASSIFICATION_APPLIED_STORE_PATH);
  if (!applied || caseId == null || caseId === '') return false;

  return String(applied.case_id ?? '') === String(caseId);
};

/**
 * Sobre QUÉ caso se está guardando, a efectos de la marca de reclasificación.
 *
 * No coincide siempre con el `caseId` que resuelve `submitCaseData`: ese cae al `cases.case_id`
 * del store para decidir URL y adjuntos, y al CREAR un subcaso el payload no trae id propio —
 * todavía no existe—, así que el fallback devuelve el caso PADRE. Atribuirle a ese padre el
 * guardado del subcaso le borraría su marca de reclasificación pendiente sin que su formulario
 * se haya guardado, o le achacaría al subcaso un mensaje de reclasificación que no es suyo.
 *
 * Se descarta exactamente ese caso —el payload declara como `parent_id` el mismo id al que iba a
 * caer el fallback— y no cualquier payload con `parent_id`: un subcaso abierto como caso
 * principal sí lleva `parent_id` y sí es el caso que se está guardando.
 *
 * @param {{ id: string|number|null, caseData: Object, resolvedCaseId: string|number|null, storeCaseId: string|number|null }} params
 * @returns {string|number|null}
 */
const resolveReclassificationTargetCaseId = ({
  id,
  caseData,
  resolvedCaseId,
  storeCaseId,
}) => {
  const explicitId = id ?? caseData?.case?.id ?? null;
  if (explicitId != null && explicitId !== '') return explicitId;

  const parentId = caseData?.case?.parent_id;
  if (
    parentId != null &&
    parentId !== '' &&
    storeCaseId != null &&
    String(parentId) === String(storeCaseId)
  ) {
    return null;
  }

  return resolvedCaseId;
};

export class CaseService extends BaseService {
  /**
   * @param {Object} params
   * @param {import('./apiService').ApiService} params.apiService
   * @param {any} params.store
   * @param {(eventName: string, payload: any) => void} [params.emitEvent]
   * @param {import('./fileService').FileService} [params.fileService]
   * @param {import('./auxService').AuxService} [params.auxService]
   */
  constructor({ apiService, store, emitEvent, fileService, auxService }) {
    super({ store });
    this.api = apiService;
    this.emitEvent = emitEvent;
    this.fileService = fileService;
    this.auxService = auxService;

    if (
      !this.api &&
      typeof globalThis !== 'undefined' &&
      globalThis.KACE_ENGINE
    ) {
      try {
        const fallbackApi = globalThis.KACE_ENGINE.getService('apiService');
        if (fallbackApi) {
          this.api = fallbackApi;
        }
      } catch (e) {}
    }

    if (
      !this.fileService &&
      typeof globalThis !== 'undefined' &&
      globalThis.KACE_ENGINE
    ) {
      try {
        const fallbackFile = globalThis.KACE_ENGINE.getService('file');
        if (fallbackFile) {
          this.fileService = fallbackFile;
        }
      } catch (e) {
        //ignore
      }
    }

    if (
      !this.auxService &&
      typeof globalThis !== 'undefined' &&
      globalThis.KACE_ENGINE
    ) {
      try {
        const fallbackAux = globalThis.KACE_ENGINE.getService('aux');
        if (fallbackAux) {
          this.auxService = fallbackAux;
        }
      } catch (e) {
        //ignore
      }
    }
  }

  /**
   * Fetch transitions data for the current case from the API.
   * @returns {Promise<Object|null>} The transitions data or null
   */
  async getTransitionsData() {
    try {
      const caseId = this.storeService.get('cases.case_id');
      if (!caseId) throw new Error('El ID del caso es requerido');

      const response = await this.api.get(`/case-transitions/${caseId}`);
      if (response.status === 200 && response.data) {
        return response.data.data;
      }

      return null;
    } catch (error) {
      throw new Error(`Error al crear el temporizador: ${error.message}`);
    }
  }

  /**
   * Pregunta si el caso puede moverse a una clasificación destino (MSKT-1392 API-3).
   *
   * Un bloqueo de negocio llega como 200 con `eligible: false` y su motivo, no como excepción: el
   * rechazo queda para lo que impide formular la pregunta (404, 403, red). Por eso el llamador
   * distingue `eligible === false` —texto del backend en `blocker.message`— de un `catch`.
   *
   * @param {Object} params
   * @param {string} params.caseId
   * @param {string} params.clasificacionId - Clasificación destino.
   * @returns {Promise<{eligible: boolean, blocker: {code?: string, message?: string}|null, states: unknown[], transitionRules: unknown[]}>}
   */
  async fetchReclassificationPrecheck({ caseId, clasificacionId }) {
    if (!caseId) throw new Error('El ID del caso es requerido');
    if (!clasificacionId)
      throw new Error('La clasificación destino es requerida');

    const response = await this.api.get(
      `/case-reclassification-precheck/${caseId}`,
      { params: { clasificacion_id: clasificacionId } }
    );

    const data = response?.data?.data ?? {};
    return {
      eligible: data.eligible === true,
      blocker: data.blocker ?? null,
      states: Array.isArray(data.states) ? data.states : [],
      transitionRules: Array.isArray(data.transition_rules)
        ? data.transition_rules
        : [],
    };
  }

  /**
   *
   * No es atómico con el guardado auxiliar que viene después: si esto va bien y aquél falla, el
   * caso queda reclasificado con el formulario sin guardar. Por eso deja la marca
   * `RECLASSIFICATION_APPLIED_STORE_PATH`, que impide que un reintento repita la reclasificación
   * —lo que duplicaría el comentario de motivo— y permite explicar al asesor qué quedó a medias.
   *
   * @param {Object} params
   * @param {string} params.caseId
   * @param {string} params.clasificacionId - Clasificación destino.
   * @param {string} params.transicionId - Transición elegida en el flujo destino.
   * @param {string} [params.currentClasificacionId] - La que tenía el caso, para el chequeo de concurrencia.
   * @param {string} [params.motivo]
   * @param {string} [params.updatedAt]
   * @param {string} [params.updatedBy]
   * @returns {Promise<{response: object, reasonDiscarded: boolean}>} `reasonDiscarded` queda en
   *   `false`: el motivo es obligatorio (≥ 3) y viaja siempre como `comment.descripcion`.
   */
  async reclassifyCase({
    caseId,
    clasificacionId,
    transicionId,
    currentClasificacionId,
    motivo,
    updatedAt,
    updatedBy,
  }) {
    if (!caseId) throw new Error('El ID del caso es requerido');
    if (!clasificacionId)
      throw new Error('La clasificación destino es requerida');
    if (!transicionId) throw new Error('Debe seleccionar un estado');

    const payload = {
      clasificacion_id: clasificacionId,
      transicion_id: transicionId,
    };
    if (currentClasificacionId) {
      payload.current_clasificacion_id = currentClasificacionId;
    }
    if (updatedAt) payload.updated_at = updatedAt;
    if (updatedBy) payload.updated_by = updatedBy;

    const descripcion = typeof motivo === 'string' ? motivo.trim() : '';
    if (descripcion.length < RECLASSIFICATION_REASON_MIN_LENGTH) {
      throw new Error(
        `El motivo de la reclasificación debe tener al menos ${RECLASSIFICATION_REASON_MIN_LENGTH} caracteres.`
      );
    }
    payload.comment = { descripcion };
    const reasonDiscarded = false;

    const response = await this.api.post(
      `/case-reclassification/${caseId}`,
      payload
    );

    this.storeService.set(RECLASSIFICATION_APPLIED_STORE_PATH, {
      case_id: String(caseId),
      clasificacion_id: String(clasificacionId),
    });
    // El motivo ya viajó; dejarlo lo reenviaría en un reintento.
    this.storeService.set(RECLASSIFICATION_REASON_STORE_PATH, null);

    // Rebase del snapshot: sin esto, el diff de `buildDirtyAuxiliaryPayload` volvería a mandar la
    // clasificación y la transición que este POST ya guardó. No se usa
    // `applySaveOutcomeToSnapshot` porque lee `data.warnings[]` y esta respuesta no trae cuerpo.
    const snapshot = this.storeService.get('cases.edit_snapshot');
    if (snapshot && typeof snapshot === 'object') {
      this.storeService.set('cases.edit_snapshot', {
        ...snapshot,
        case: {
          ...(snapshot.case ?? {}),
          clasificacion_id: clasificacionId,
          transicion_id: transicionId,
        },
      });
    }

    return { response, reasonDiscarded };
  }

  /**
   * Validate required case fields and auxiliary data before submission.
   * @param {Object} caseData - The case data object
   * @param {Object} auxCaseData - The auxiliary case data object
   * @param {string} description - The case description
   * @param {boolean} isUpdate - Whether the case is being updated (true) or created (false)
   * @param {boolean} [isSubcase=false] - Si es true, usa aux_subcases_schema para validar; si no, aux_cases_schema.
   * @param {boolean} [subcaseHasAuxSchema] - Solo aplica si isSubcase. Si la clasificación del subcaso tiene esquema auxiliar; si no se pasa, se infiere desde el store.
   * @param {{ skipRequireStateChangeCheck?: boolean }} [validationOptions] - Si skipRequireStateChangeCheck es true, no se aplica la validación de cambio de estado (p. ej. subcasos con la opción desactivada en el componente).
   * @throws {Error} If any required field is missing or invalid
   */
  async validateCaseFields(
    caseData,
    auxCaseData,
    description,
    isUpdate = false,
    isSubcase = false,
    subcaseHasAuxSchema = false,
    validationOptions = {}
  ) {
    const { skipRequireStateChangeCheck = false } = validationOptions ?? {};
    const translation = {
      cliente_id: 'cliente',
      transicion_id: 'estados',
      clasificacion_id: 'clasificación',
      responsable_id: 'responsable',
      descripcion_caso_id: 'descripción',
      grupo_id: 'grupo',
      parent_id: 'caso padre',
    };

    if (!caseData) throw new Error('Los campos del caso son requeridos');

    if (caseData?.fecha_resolucion)
      throw new Error('El caso ya esta resuelto y no es posible actualizar');

    const hasAuxForm = isSubcase
      ? subcaseHasAuxSchema
      : storeService.get('aux_case.hasSchema');
    if (hasAuxForm && (!auxCaseData || Object.keys(auxCaseData).length === 0))
      throw new Error('Los campos del auxiliar de caso son requeridos');

    const storeCaseRow =
      this.storeService.get('cases.case_data') ??
      this.storeService.get('case.case_data');
    const current_transition_id =
      storeCaseRow && typeof storeCaseRow === 'object'
        ? storeCaseRow.transicion_id
        : null;
    const {
      case_require_state_change = false,
      allow_description_empty = false,
    } = this.storeService.get(
      'config.global_config.behaviors.application.agente.casos'
    );

    if (
      !skipRequireStateChangeCheck &&
      current_transition_id === caseData.transicion_id &&
      case_require_state_change &&
      isUpdate
    ) {
      throw new Error(
        'Debe cambiar el estado para poder actualizar el caso, consulte las configuraciones globales del grupo'
      );
    }

    if ((!description || description === '<br>') && !allow_description_empty) {
      throw new Error(
        'No se permite la descripción vacia, consulte las configuraciones globales del grupo'
      );
    }

    const requiresTransition = !isUpdate || case_require_state_change;
    // Prefiere el snapshot de edición: `reclassifyCase` lo rebasa a la transición del flujo
    // DESTINO justo después de reclasificar, mientras que `cases.case_data` (el GET original)
    // se queda con la del flujo VIEJO hasta el próximo fetch. Usar ese valor stale acá
    // reescribiría la transición ya reclasificada.
    const fallbackTransitionId =
      this.storeService.get('cases.edit_snapshot')?.case?.transicion_id ??
      current_transition_id;
    if (
      !requiresTransition &&
      !caseData.transicion_id &&
      fallbackTransitionId
    ) {
      // Sin cambio de estado exigido: el payload debe seguir llevando la transición
      // vigente, no null — el widget de estados no siempre la repuebla a tiempo.
      caseData.transicion_id = fallbackTransitionId;
    }
    const emptyFields = Object.entries(caseData)
      .filter(
        ([key, value]) =>
          key !== 'parent_id' &&
          (key !== 'transicion_id' || requiresTransition) &&
          (value === undefined || value === null || value === '')
      )
      .map(([key]) => translation[key] ?? key);

    if (emptyFields.length > 0) {
      const message =
        emptyFields.length === 1
          ? `El campo: ${emptyFields.join(', ')} es requerido`
          : `Los campos: ${emptyFields.join(', ')} son requeridos`;
      throw new Error(message);
    }

    if (hasAuxForm) {
      const schemaKey = isSubcase
        ? 'aux_case.aux_subcases_schema'
        : 'aux_case.aux_cases_schema';
      const auxSchema = await this.auxService.get(schemaKey);

      let payloadToValidate = auxCaseData;
      const payloadKeys = Object.keys(auxCaseData || {});
      const isSingleWrappedKey =
        payloadKeys.length === 1 && !auxSchema.data_structure?.[payloadKeys[0]];
      if (isSingleWrappedKey) {
        const inner = auxCaseData[payloadKeys[0]];
        if (inner && typeof inner === 'object') {
          payloadToValidate = inner;
        }
      }

      await this.auxService.validateSchema({
        data_structure: auxSchema.data_structure,
        payload: payloadToValidate,
        isUpdate,
      });
    }
  }

  /**
   * Fetch aux-case data for a given case.
   * @param {Object} params
   * @param {string|number|null} [params.caseId=null]
   * @returns {Promise<{aux_case_data: any, aux_case_id: any} | null>}
   */
  async fetchAuxCase({ caseId = null }) {
    try {
      const id = caseId || this.storeService.get('cases.case_id');
      if (!id) return null;

      const response = await this.api.get(`/aux-cases/${id}`);
      if (response.status === 200 && response.data) {
        return {
          aux_case_data: response.data.data.data,
          aux_case_id: response.data.data.id,
        };
      }
      return null;
    } catch (error) {
      throw new Error(`Error fetching aux case: ${error.message}`);
    }
  }

  /**
   * Submits case + auxiliary data and uploads pending attachments.
   * @param {Object} params
   * @param {Object} params.caseData
   * @param {string} params.description
   * @param {string|number|null} [params.id=null]
   * @param {boolean} [params.uploadAttachments=true] - Whether to upload pending attachments
   * @returns {Promise<import('axios').AxiosResponse<any>>}
   */
  async submitCaseData({
    caseData,
    description,
    id = null,
    uploadAttachments = true,
  }) {
    if (this.emitEvent) {
      this.emitEvent('kaceAttachmentsLoading', true);
      this.emitEvent('kaceDescriptionLoading', true);
    }
    // Declarado fuera del `try` porque el `catch` necesita saber de qué caso se habla para
    // decidir si la marca de reclasificación pendiente es de ESTE guardado.
    let reclassificationCaseId = null;
    try {
      const storeCaseId = this.storeService.get('cases.case_id');
      const caseId =
        id ||
        caseData?.case?.id ||
        storeCaseId ||
        this.storeService.get('cases.generated_case_id') ||
        null;
      reclassificationCaseId = resolveReclassificationTargetCaseId({
        id,
        caseData,
        resolvedCaseId: caseId,
        storeCaseId,
      });
      const isUpdate = Boolean(
        !this.storeService.get('cases.generated_case_id')
      );
      // Upload attachments before the POST so case actions (e.g. email
      // templates sending case attachments) can see them: the case.created/
      // case.updated event is queued as soon as the POST commits, and the
      // async SendEmail action reads case_attachments at that moment. On
      // create the backend accepts the pre-generated id after a collision
      // check; on update the case already exists.
      const uploadBeforeSubmit = uploadAttachments && caseId;
      const url =
        caseId && isUpdate
          ? `/cases/auxiliary/${caseId}?override=true`
          : `/cases/auxiliary`;

      // Se borra sobre una copia: `caseData` es la submission viva del formulario y un guardado
      // fallido la dejaría sin id, así que el reintento no sabría qué caso actualizar.
      if (caseId && isUpdate) {
        caseData = {
          ...caseData,
          case: { ...caseData.case },
          aux_cases: { ...caseData.aux_cases },
        };
        delete caseData.case.id;
        delete caseData.aux_cases.caso_id;
      }

      const parentId = storeCaseId;
      const shouldRecorte = Boolean(
        isUpdate && caseId && parentId && String(caseId) === String(parentId)
      );
      const casosConfig = this.storeService.get(
        'config.global_config.behaviors.application.agente.casos'
      );
      const lockDescriptionEdit =
        casosConfig?.lock_case_description_edit === true;

      let liveForRefresh = null;
      if (shouldRecorte) {
        const snapshot = this.storeService.get('cases.edit_snapshot');
        liveForRefresh = {
          case: caseData.case ?? {},
          aux_cases: caseData.aux_cases ?? {},
          description,
        };
        const dirty = buildDirtyAuxiliaryPayload(liveForRefresh, snapshot);
        caseData = {
          case: dirty.case,
          aux_cases: dirty.aux_cases,
          ...(dirty.description ? { description: dirty.description } : {}),
        };
      } else {
        if (!isUpdate && !Object.entries(caseData.aux_cases).length) {
          caseData.aux_cases = {
            caso_id: caseId,
            data: {},
          };
        }

        caseData.description = {
          id: caseData.case.descripcion_caso_id,
          descripcion: description,
        };
      }

      if (isUpdate && lockDescriptionEdit) {
        delete caseData.description;
      }

      const keysToIgnore =
        (storeService && storeService.get(STORE_KEY_IGNORE_SCHEMA_KEYS)) ??
        DEFAULT_IGNORE_SCHEMA_KEYS;
      let payload =
        keysToIgnore.length > 0
          ? (() => {
              const cloned = JSON.parse(JSON.stringify(caseData ?? {}));
              removeKeysFromSubmissionData(cloned, keysToIgnore);
              return cloned;
            })()
          : (caseData ?? {});

      const reason = this.storeService.get(RECLASSIFICATION_REASON_STORE_PATH);
      assertAuxiliaryReclassificationReason(payload, reason);
      payload = attachAuxiliaryReclassificationComment(payload, reason);
      payload = ensureAuxiliaryReclassificationTransition(payload, {
        live: liveForRefresh?.case?.transicion_id,
        storeTransition: this.storeService.get('states.current_transition')
          ?.transition_id,
        snapshot: this.storeService.get('cases.edit_snapshot')?.case
          ?.transicion_id,
      });

      if (uploadBeforeSubmit) {
        await this.uploadPendingCaseAttachments(caseId);
      }

      const response = await this.api.post(url, payload);

      // El motivo ya viajó en este POST; dejarlo lo reenviaría en un reintento.
      if (
        payload?.comment != null ||
        hasAuxiliaryReclassificationIntent(payload?.case)
      ) {
        this.storeService.set(RECLASSIFICATION_REASON_STORE_PATH, null);
      }

      if (liveForRefresh) {
        applySaveOutcomeToSnapshot(this.storeService, liveForRefresh, response);
      }

      try {
        const affected = new Set();
        const add = (v) => {
          if (v != null && v !== '') affected.add(String(v));
        };
        add(caseId);
        add(caseData?.case?.id);
        add(caseData?.case?.parent_id);
        const respData = response?.data?.data;
        if (respData != null && typeof respData === 'object') {
          add(respData.id);
          add(respData.case_id);
          add(respData.case?.id);
        }
        add(caseData?.aux_cases?.caso_id);
        invalidateKaceResponseCacheForCases([...affected]);
      } catch (_) {
        // no bloquear el flujo por invalidación de caché
      }

      if (uploadAttachments && !uploadBeforeSubmit) {
        await this.uploadPendingCaseAttachments(
          resolveCreatedCaseId(caseData, response) ?? caseId
        );
      }
      // El auxiliar aterrizó: la reclasificación ya no está a medias.
      if (
        hasPendingReclassificationFor(this.storeService, reclassificationCaseId)
      ) {
        this.storeService.set(RECLASSIFICATION_APPLIED_STORE_PATH, null);
      }

      return response;
    } catch (error) {
      const message = this.handleErrorMessage(error);
      // La reclasificación sí se aplicó y este guardado no: decirlo explícitamente, o el asesor
      // no sabe que el caso ya cambió de clasificación y que solo falta reintentar el formulario.
      if (
        hasPendingReclassificationFor(this.storeService, reclassificationCaseId)
      ) {
        throw new Error(
          `${RECLASSIFY_PENDING_AUX_MESSAGE} Detalle: ${message}`
        );
      }
      throw new Error(`Error guardando el caso: ${message}`);
    } finally {
      if (this.emitEvent) {
        this.emitEvent('kaceAttachmentsLoading', false);
        this.emitEvent('kaceDescriptionLoading', false);
      }
    }
  }

  /**
   * Sube adjuntos pendientes desde el store `cases.attachments` (entradas sin `id`)
   * para el caso indicado. Misma lógica que al final de {@link submitCaseData}.
   *
   * @param {string|number|null|undefined} caseId - ID del caso destino (subcaso o caso padre según flujo).
   * @returns {Promise<void>}
   */
  async uploadPendingCaseAttachments(caseId) {
    try {
      if (!this.fileService) {
        throw new Error('Servicio de archivos no disponible');
      }
      if (caseId == null || caseId === '') {
        throw new Error('ID de caso requerido para subir adjuntos');
      }
      const attachments = this.storeService.get('cases.attachments') || [];

      await this.fileService.updateModifiedAttachmentTypes();

      if (!attachments.length) {
        return;
      }
      const pending = attachments.filter((element) => element && !element.id);
      if (!pending.length) {
        return;
      }
      await Promise.all(
        pending.map((attachment) =>
          this.fileService.uploadFile({
            id: caseId,
            contentType: attachment.description,
            fileName: attachment.path,
            file: attachment.file,
            fileTypeCategory: attachment.tipoFoto?.label ?? null,
            fileTypeNumeric: attachment.attachmentType ?? null,
          })
        )
      );
    } catch (error) {
      throw new Error(
        `Error al subir adjuntos del caso: ${this.handleErrorMessage(error)}`
      );
    }
  }

  /**
   * Creates a case and persists its id in store.
   * @param {Object} params
   * @param {Object} params.caseData
   * @param {string} params.description
   * @returns {Promise<{ staleCodes: string[], caseId: string|null }>}
   */
  async createCase({ caseData, description }) {
    try {
      removeKeysFromSubmissionData(caseData);
      const response = await this.submitCaseData({ caseData, description });
      const createdCaseId = resolveCreatedCaseId(caseData, response);
      if (createdCaseId) {
        this.storeService.set('cases.case_id', createdCaseId);
      }
      const interactionId = resolveInteractionId(this.storeService);
      if (
        !interactionId &&
        createdCaseId &&
        this.api?.post &&
        hasInteractionContextHint(this.storeService)
      ) {
        warnMissingInteractionId();
      } else if (interactionId && createdCaseId && this.api?.post) {
        try {
          await this.api.post('/interactions/interaction-cases', {
            interaction_id: interactionId,
            caso_id: createdCaseId,
          });
        } catch (error) {
          console.warn(
            'No se pudo relacionar el caso con la interacción',
            error
          );
        }
      }
      return { staleCodes: extractStaleCodes(response), caseId: createdCaseId };
    } catch (error) {
      throw new Error(error.message);
    }
  }

  resolveCaseId() {
    return (
      this.storeService.get('cases.case_id') ||
      this.storeService.get('cases.generated_case_id') ||
      null
    );
  }

  isCreatingCase() {
    return Boolean(this.storeService.get('cases.generated_case_id'));
  }

  /**
   * Creates a case session duration timer in backend.
   * @param {{ caseId?: string | null }} [options={}]
   * @returns {Promise<any>}
   */
  async createTimer(options = {}) {
    const caseId = options.caseId ?? this.resolveCaseId();
    if (!caseId) {
      throw new Error('Error al crear el temporizador: no hay id de caso');
    }
    const payload = {
      id: uuidv4(),
      case_id: caseId,
      event_type: 'VIEW',
      justification: '',
    };
    try {
      const response = await this.api.post(`/case-session-duration`, payload);
      if (response.status === 201 && response.data) {
        return response.data;
      }
      throw new Error('Error al crear el temporizador');
    } catch (error) {
      throw new Error(`Error al crear el temporizador: ${error.message}`);
    }
  }

  /**
   * Starts a timer locally when the case is not persisted yet.
   * @returns {{ data: { id: string, localOnly: true } }}
   */
  createLocalTimer() {
    return {
      data: {
        id: uuidv4(),
        localOnly: true,
      },
    };
  }

  /**
   * @param {{ caseId?: string | null, localOnly?: boolean }} [options={}]
   * @returns {Promise<any>}
   */
  async startTimerSession(options = {}) {
    if (options.localOnly || this.isCreatingCase()) {
      return this.createLocalTimer();
    }
    return this.createTimer({ caseId: options.caseId });
  }

  /**
   * Finishes the timer on submit. For new cases, creates the session after the case exists.
   * @param {string} timerId
   * @param {string} [justification='Formulario Guardado']
   * @returns {Promise<any>}
   */
  async finishTimerAfterSubmit(timerId, justification = 'Formulario Guardado') {
    const caseTimerRaw =
      typeof window !== 'undefined' ? localStorage.getItem('caseTimer') : null;
    const isLocalOnly = caseTimerRaw
      ? Boolean(JSON.parse(caseTimerRaw)?.localOnly)
      : false;

    if (!isLocalOnly && !this.isCreatingCase()) {
      return this.updateTimer(timerId, 'FINISHED', justification);
    }

    const caseId = this.resolveCaseId();
    if (!caseId) {
      return null;
    }

    if (!isLocalOnly) {
      try {
        return await this.updateTimer(timerId, 'FINISHED', justification);
      } catch (_) {}
    }

    const createResponse = await this.createTimer({ caseId });
    const newTimerId = createResponse?.data?.id;
    if (!newTimerId) {
      throw new Error('Error al crear el temporizador');
    }
    return this.updateTimer(newTimerId, 'FINISHED', justification);
  }

  /**
   * Searches for case-session-duration records for current user + case.
   * @returns {Promise<any|null>}
   */
  async getCaseSessionId() {
    const userId = this.storeService.get('user.user_id');
    const caseId = this.resolveCaseId();

    try {
      const response = await this.api.post(
        `/case-session-duration/search?caseId=${caseId}&userId=${userId}`
      );
      if (response.status === 200 && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      throw new Error(
        `Error al obtener el ID de sesión del caso: ${error.message}`
      );
    }
  }

  /**
   * Returns the most recent open (unfinished) case-session-duration record.
   * @returns {Promise<any|null>}
   */
  async getOpenCaseSession() {
    const sessionData = await this.getCaseSessionId();
    const items = sessionData?.data?.items || [];
    const openSessions = items.filter((item) => {
      const hasNoFinishedAt =
        item.finished_at === null || item.finished_at === undefined;
      const hasNoEventType =
        item.event_type === null || item.event_type === undefined;
      const hasNoJustification =
        item.justification === null || item.justification === undefined;
      return hasNoFinishedAt && hasNoEventType && hasNoJustification;
    });
    if (!openSessions.length) {
      return null;
    }
    openSessions.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return openSessions[0];
  }

  /**
   * Updates a timer session with the next event type and optional justification.
   * @param {string} timerId
   * @param {string} eventType
   * @param {string|null} [justification=null]
   * @returns {Promise<any>}
   */
  async updateTimer(timerId, eventType, justification = null) {
    const payload = {
      justification,
      next_event_type: eventType,
    };
    try {
      const response = await this.api.post(
        `/case-session-duration/${timerId}`,
        payload
      );
      if (response.status === 200 && response.data) {
        return response.data;
      }
    } catch (error) {
      throw new Error(`Error al actualizar el temporizador: ${error.message}`);
    }
  }

  /**
   * Fetches case data from API and returns the data payload.
   * Used by BaseService.get('cases.case_data') via fetcher naming.
   * @param {Object} [args={}]
   * @param {string|number} [args.caseId]
   * @param {boolean} [args.forceRefresh] - Si true, omite caché HTTP de {@link ApiService} para esta petición.
   * @returns {Promise<any>}
   */
  async fetchCaseData(args = {}) {
    const id = args.caseId || this.storeService.get('cases.case_id');
    const logEvent = args.logEvent ?? false;
    const forceRefresh = args.forceRefresh === true;
    if (!id) throw new Error('No case id');

    if (!this.api || typeof this.api.get !== 'function') {
      throw new Error(
        'Api service unavailable in CaseService (this.api is undefined). Check service registration/injection.'
      );
    }

    let url = `/cases/${id}`;
    if (logEvent) {
      url += '?logEvent=true';
    }

    const response = await this.api.get(
      url,
      forceRefresh ? { __kaceForceRefresh: true } : {}
    );
    if (response.status === 200 && response.data) {
      const caseRow = response.data.data;
      // Persistir antes de hidratar para que cualquier consumidor del store que se
      // ejecute durante la hidratación (transitions, classifications) ya vea el caso.
      try {
        this.storeService.set('cases.case_data', caseRow);
      } catch (_) {
        // ignore: BaseService.get también escribirá el valor al retornar
      }
      hydrateEditCaseToStore(this.storeService, caseRow);
      this.applyEmbeddedPayloadFlags(caseRow);
      return caseRow;
    }
    throw new Error('No se pudo recuperar el caso');
  }

  /**
   * Pre-llena `cases.attachments` y `cases.attachments_prefetched=true` apenas regresa
   * `GET /cases/:id`, para que `useAttachment` salte directo a render sin pasar por
   * `fetchAttachmentsByCaseId`. Los spinners de Adjuntos/Estados/Descripción se apagan
   * desde {@link readEmbeddedPayloadFlags} + `Auth.jsx` (que sí emite via Form.io
   * y por tanto sí llega a `useEventData`).
   *
   * @param {Record<string, unknown> | null | undefined} caseRow
   * @returns {void}
   */
  applyEmbeddedPayloadFlags(caseRow) {
    if (!caseRow || typeof caseRow !== 'object') return;
    try {
      const rawAttachments =
        caseRow.attachments ??
        caseRow.case_attachments ??
        caseRow.caseAttachments;
      if (rawAttachments === undefined) return;

      let list = [];
      if (Array.isArray(rawAttachments)) {
        list = rawAttachments;
      } else if (rawAttachments && typeof rawAttachments === 'object') {
        const rec = /** @type {Record<string, unknown>} */ (rawAttachments);
        const lenRaw = rec.length;
        const len =
          typeof lenRaw === 'number'
            ? lenRaw
            : typeof lenRaw === 'string'
              ? Number(lenRaw)
              : NaN;
        if (Number.isFinite(len) && len >= 0) {
          for (let i = 0; i < len; i++) {
            if (String(i) in rec) list.push(rec[String(i)]);
          }
        }
      }
      try {
        const normalizedList = list.map((attachment) =>
          attachment && typeof attachment === 'object'
            ? {
                ...attachment,
                attachmentType: attachment.attachmentType ?? attachment.type,
              }
            : attachment
        );
        this.storeService.set('cases.attachments', normalizedList);
        this.storeService.set('cases.attachments_prefetched', true);
      } catch (_) {
        // no bloquear el flujo si falla el set
      }
    } catch (_) {
      // El flujo principal no debe romperse por errores al apagar spinners.
    }
  }

  /**
   * Inspecciona qué secciones (Estados / Adjuntos / Descripción) ya vienen embebidas en
   * `GET /cases/:id`. El consumidor (Auth.jsx) usa esto para apagar spinners apenas vuelve
   * `initSession`, sin esperar a que `hydrateExistingCase` complete attachments/aux/etc.
   *
   * @param {Record<string, unknown> | null | undefined} caseRow
   * @returns {{ states: boolean, attachments: boolean, description: boolean }}
   */
  readEmbeddedPayloadFlags(caseRow) {
    if (!caseRow || typeof caseRow !== 'object') {
      return { states: false, attachments: false, description: false };
    }
    const states =
      (caseRow.transicion != null && typeof caseRow.transicion === 'object') ||
      caseRow.transitions_available != null;
    const attachments =
      caseRow.attachments !== undefined ||
      caseRow.case_attachments !== undefined ||
      caseRow.caseAttachments !== undefined;
    const description =
      (caseRow.descripcion_caso != null &&
        typeof caseRow.descripcion_caso === 'object') ||
      caseRow.descripcion_caso_id === null ||
      caseRow.descripcion_caso_id === '';
    return { states, attachments, description };
  }

  /**
   * Fetches subcases for a parent case (search with pagination and filter).
   * When classificationIds is provided and non-empty, only subcases whose clasificacion_id
   * is in that array are returned (allowed subcase classifications for the parent case).
   * @param {Object} params
   * @param {string|number} params.parentId
   * @param {number} [params.page=1]
   * @param {number} [params.pageSize=50]
   * @param {(string|number)[]} [params.classificationIds] - Optional; when set, only subcases with clasificacion_id in this list are returned.
   * @param {Array<{ table: string, condition: { column: string, refColumn: string }, type: string }>|null} [params.relationship] - Optional JOINs (e.g. aux_cases).
   * @param {string[]} [params.select] - Optional SQL select fragments with aliases (e.g. aux_cases.data->>'name' as aux_nombre). JSONB wildcard at first level under data: aux_cases.data->'*'->>'nombre' as aux_nombre (backend translates to jsonb_path_query_first).
   * @returns {Promise<{ items: any[], totalCount: number }>}
   */
  async fetchSubcases({
    parentId,
    page = 1,
    pageSize = 50,
    classificationIds,
    relationship,
    select,
    forceRefresh = false,
  }) {
    if (!parentId) throw new Error('Parent case ID is required');
    if (!this.api || typeof this.api.post !== 'function') {
      throw new Error('Api service unavailable in CaseService.');
    }
    const limit = pageSize;
    const offset = (page - 1) * pageSize;
    const filter = [
      {
        filters: [
          {
            field: 'cases.is_visible',
            operator: 'eq',
            type: 'OR',
            value: 'true',
          },
          {
            field: 'cases.is_visible',
            operator: 'null',
            type: 'OR',
            value: 'null',
          },
        ],
        groupType: 'OR',
      },
    ];
    if (Array.isArray(classificationIds) && classificationIds.length > 0) {
      const classificationFilters = classificationIds.map((id) => ({
        field: 'cases.clasificacion_id',
        operator: 'eq',
        type: 'OR',
        value: String(id),
      }));
      filter.push({
        filters: classificationFilters,
        groupType: 'AND',
      });
    }
    const body = {
      filter,
      limit,
      offset,
      order: {
        direction: 'desc',
        field: 'created_at',
      },
      relationship:
        Array.isArray(relationship) && relationship.length > 0
          ? relationship
          : null,
    };
    if (Array.isArray(select) && select.length > 0) {
      body.select = select;
    }
    const response = await this.api.post(
      `/cases/${parentId}/sub-cases/search`,
      body,
      forceRefresh ? { __kaceForceRefresh: true } : undefined
    );
    const data = response.data?.data ?? {};
    const items = data.items ?? [];
    const metadata = data.metadata ?? {};
    const totalCount = metadata.count ?? items.length;
    return { items, totalCount };
  }

  /**
   * Fetches the case description string (HTML) from API.
   * El endpoint espera el ID del registro de descripción (descripcion_caso_id), no el case_id.
   * @param {Object} [params]
   * @param {string|number|null} [params.caseId=null] - Case id; se usa para resolver descripcion_caso_id si no se pasa.
   * @param {string|null} [params.descripcionCasoId=null] - ID del registro de descripción (UUID). Si se pasa, se usa para la petición; si no, se usa caseId (comportamiento legacy).
   * @returns {Promise<string>}
   */
  async fetchCaseDescription(params = {}) {
    try {
      const {
        caseId: paramCaseId = null,
        descripcionCasoId: paramDescripcionCasoId = null,
      } = params;
      this.emitEvent('kaceDescriptionLoading', true);

      const caseId = paramCaseId ?? this.storeService.get('cases.case_id');
      const idForRequest = paramDescripcionCasoId ?? caseId;
      let caseDescription = '';

      if (!!idForRequest) {
        const response = await this.api.get(
          `/case-descriptions/${idForRequest}`
        );
        if (response.status === 200 && response.data) {
          caseDescription = response.data.data.descripcion;
          captureEditSnapshotDescription(this.storeService, caseDescription);
          if (paramCaseId == null && paramDescripcionCasoId == null) {
            this.storeService.set(
              'cases.is_description_created',
              Boolean(response.data.data.id)
            );
          }
        }
      }

      if (this.emitEvent) {
        this.emitEvent('kaceDescriptionLoading', false);
      }

      return caseDescription;
    } catch (error) {
      throw new Error(
        `Error al obtener los datos de descripción del caso: ${error.message}`
      );
    }
  }

  /**
   * Normalizes error messages from API responses.
   * @param {any} error
   * @returns {string}
   */
  handleErrorMessage(error) {
    return httpErrorMessage(error, {
      fieldLabel: storeConditionFieldLabel(this.storeService),
    });
  }

  /**
   * Updates the state of a case.
   * @param {Object} params
   * @param {string} params.transition_id
   * @returns {Promise<any[]>}
   */
  async updateState({ transition_id }) {
    try {
      const caseId = this.storeService.get('cases.case_id');
      if (!transition_id)
        throw new Error('El ID de la transición es requerido');
      if (!caseId) throw new Error('El ID del caso es requerido');
      const payload = {
        case: {
          transicion_id: transition_id,
        },
        aux_cases: {},
      };
      const response = await this.api.post(
        `/cases/auxiliary/${caseId}`,
        payload
      );
      if (response.status === 200 && response.data) {
        return response.data.data.items;
      }
      return [];
    } catch (error) {
      throw new Error(
        `Error al actualizar estado: ${this.handleErrorMessage(error)}`
      );
    }
  }

  /**
   * Fetches the available states for a case.
   * @returns {Promise<any[]>} The available states or an empty array
   */
  async getCaseAvailableStates() {
    try {
      const caseId = this.storeService.get('cases.case_id');
      if (!caseId) throw new Error('El ID del caso es requerido');
      const response = await this.api.get(`/case-available-states/${caseId}`);
      if (response.status === 200 && response.data) {
        return response?.data?.data?.items || [];
      }
      return [];
    } catch (error) {
      throw new Error(
        `Error al obtener los estados disponibles del caso: ${error.message}`
      );
    }
  }
}
