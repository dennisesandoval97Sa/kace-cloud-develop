import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { evaluateKace } from '#plugins/kace/shared/evaluateKace.js';
import { KaceEngine } from '#plugins/kace/KaceEngine.js';
import { useAllowedSubcaseClassifications } from '#plugins/kace/hooks/useAllowedSubcaseClassifications.js';
import { useSubcaseAttachments } from '#plugins/kace/hooks/useSubcaseAttachments.hook.js';
import { removeKeysFromSubmissionData } from '../utils/removeKeysFromSubmissionData';
import {
  DEFAULT_IGNORE_SCHEMA_KEYS,
  STORE_KEY_IGNORE_SCHEMA_KEYS,
} from '../utils/getIgnoreSchemaKeysFromComponent';
import { invalidateKaceResponseCacheForCases } from '#plugins/kace/utils/kaceResponseCache.js';

/**
 * @param {{ dataSourceValues?: Array<{ label: string, value: string }>, data?: { values?: Array<{ label: string, value: string }> }, buttonLabel?: string, tableColumns?: any[], beforeSubmitCode?: string, enforceStateChangeValidation?: boolean }} component - Formio component config (classifications: datagrid dataSourceValues or select data.values; beforeSubmitCode: script después de validar (contexto incluye uploadPendingCaseAttachments(caseId) para adjuntos en store cases.attachments); enforceStateChangeValidation: si es false, no se exige cambio de estado al actualizar subcaso)
 * @param {{ refreshList?: () => Promise<void> }} [options] - Opciones; refreshList se llama tras crear un subcaso.
 * @returns {{
 *   isOpen: boolean,
 *   isLoading: boolean,
 *   isSubmitting: boolean,
 *   error: string | null,
 *   states: Array<{ transition_id: string|number, state_id: string|number, nombre: string }>,
 *   selectedTransitionId: string | number | null,
 *   selectedClassificationId: string | null,
 *   isClassificationLocked: boolean,
 *   handleClassificationChange: (value: string) => void,
 *   mockRoot: { data: { clasificacion_id: string | null } },
 *   auxFormData: Record<string, unknown> | null,
 *   oneScriptFormId: string | null,
 *   schemaId: string | null,
 *   buttonLabel: string,
 *   openModal: () => void,
 *   closeModal: () => void,
 *   handleEditClick: (rowOrId: any) => void,
 *   handleTransitionChange: (value: string) => void,
 *   handleAuxFormUpdate: (value: unknown) => void,
 *   setFormInstance: (instance: unknown) => void,
 *   handleSubmit: () => Promise<void>,
 *   description: string,
 *   handleDescriptionChange: (value: string) => void,
 *   modalKey: number,
 *   selectedSubcase: any,
 *   auxInitialSubmission: Record<string, unknown> | null,
 *   currentStateName: string | null,
 *   isSubcaseClosed: boolean,
 *   isViewMode: boolean,
 *   handleViewClick: (rowOrId: any) => void,
 *   classificationOptions: Array<{ label: string, value: string }>,
 * }}
 */
const ELEMENTO_SUBCASO = 'subcaso';
const STORE_KEY_AUX_SUBCASES_SCHEMA = 'aux_case.aux_subcases_schema';

/**
 * Obtiene el id del caso creado desde la respuesta de POST /cases/auxiliary.
 * @param {import('axios').AxiosResponse<any> | undefined} response
 * @returns {string | number | null}
 */
function extractCreatedCaseIdFromSubmitResponse(response) {
  try {
    if (!response?.data) {
      return null;
    }
    const payload = response.data.data ?? response.data;
    if (payload == null || typeof payload !== 'object') {
      return null;
    }
    const id =
      payload.id ??
      payload.case_id ??
      (payload.case != null && typeof payload.case === 'object'
        ? payload.case.id
        : null);
    if (id == null || id === '') {
      return null;
    }
    return id;
  } catch (_) {
    return null;
  }
}

/**
 * Obtiene la key dinámica del schema (ej. persona_hijo) desde aux_cases.data.
 * aux_cases.data tiene forma { [schemaKey]: { ...campos } }; se usa la primera key.
 * @param {Record<string, unknown> | null} auxData - Objeto aux_cases.data
 * @param {{ get: (key: string) => unknown } | null} [storeService] - Store para fallback desde schema
 * @returns {string | null}
 */
function getSchemaAuxKey(auxData, storeService) {
  if (auxData != null && typeof auxData === 'object') {
    const keys = Object.keys(auxData);
    if (keys.length > 0) return keys[0];
  }
  if (storeService) {
    try {
      const schema = storeService.get(STORE_KEY_AUX_SUBCASES_SCHEMA);
      const dataStructure =
        schema != null &&
        typeof schema === 'object' &&
        'data_structure' in schema
          ? schema.data_structure
          : {};
      const keys = Object.keys(dataStructure ?? {});
      if (keys.length > 0) return keys[0];
    } catch (_) {
      // ignore
    }
  }
  return null;
}

export function useSubcases(component, options = {}) {
  const { refreshList: refreshListCallback } = options;
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [states, setStates] = useState([]);
  const [selectedTransitionId, setSelectedTransitionId] = useState(null);
  const [auxFormData, setAuxFormData] = useState(null);
  const [description, setDescription] = useState('');
  const [oneScriptFormId, setOneScriptFormId] = useState(null);
  const [schemaId, setSchemaId] = useState(null);
  const [modalKey, setModalKey] = useState(0);
  const [selectedSubcase, setSelectedSubcase] = useState(null);
  const [rawAuxData, setRawAuxData] = useState(null);
  const [auxCaseId, setAuxCaseId] = useState(null);
  const [currentStateName, setCurrentStateName] = useState(null);
  const [selectedClassificationId, setSelectedClassificationId] =
    useState(null);
  const [isClassificationLocked, setIsClassificationLocked] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  /** Se incrementa al cambiar de una `clasificacion_id` a otra (no en la primera elección) para forzar otra vez reglas/defs. */
  const [subcaseSchemaRefreshNonce, setSubcaseSchemaRefreshNonce] = useState(0);
  const lastSubcaseModalClasificacionIdRef = useRef(null);
  const sessionNonceRef = useRef(0);
  const parentCaseDataRef = useRef(null);
  const formInstanceRef = useRef(null);
  const sessionStartRef = useRef(null);
  const sessionModeRef = useRef(null);
  const sessionSavedRef = useRef(false);

  const kace = useMemo(() => KaceEngine(), []);
  const storeService = useMemo(
    () => kace?.getService('storeService') ?? null,
    [kace]
  );
  const classificationsService = useMemo(
    () => kace?.getService('classifications') ?? null,
    [kace]
  );
  const statesService = useMemo(
    () => kace?.getService('states') ?? null,
    [kace]
  );
  const caseService = useMemo(() => kace?.getService('cases') ?? null, [kace]);
  const fileService = useMemo(() => kace?.getService('file') ?? null, [kace]);
  const userService = useMemo(() => kace?.getService('user') ?? null, [kace]);
  const oneScriptService = useMemo(
    () => kace?.getService('oneScript') ?? null,
    [kace]
  );

  // Capture parent case data once at mount — before any subcase edit can overwrite
  // cases.case_data in the store with subcase-level data.
  useEffect(() => {
    if (!storeService || parentCaseDataRef.current != null) return;
    const caseData =
      storeService.get('cases.case_data') ?? storeService.get('case.case_data');
    if (caseData != null) {
      parentCaseDataRef.current = caseData;
    }
  }, [storeService]);

  const enableSubcaseAttachments = Boolean(component?.enableAttachments);
  const enforceStateChangeValidation = useMemo(
    () => component?.enforceStateChangeValidation !== false,
    [component?.enforceStateChangeValidation]
  );
  const subcaseAttachments = useSubcaseAttachments({
    enabled: enableSubcaseAttachments,
  });
  const resetSubcaseAttachments = subcaseAttachments.reset;
  const loadSubcaseAttachmentsForCase = subcaseAttachments.loadAttachments;

  const uploadSubcaseAttachments = useCallback(
    async (caseId) => {
      try {
        if (
          !enableSubcaseAttachments ||
          !fileService ||
          caseId == null ||
          caseId === ''
        ) {
          return;
        }
        await fileService.uploadAttachments(caseId, subcaseAttachments.files);
      } catch (err) {
        throw new Error(err?.message ?? String(err));
      }
    },
    [enableSubcaseAttachments, fileService, subcaseAttachments.files]
  );

  const buttonLabel = useMemo(
    () =>
      (component?.buttonLabel && String(component.buttonLabel).trim()) ||
      'Crear subcaso',
    [component?.buttonLabel]
  );

  const { allowedClassificationIds } = useAllowedSubcaseClassifications();

  const classificationOptions = useMemo(() => {
    const fromDatagrid = Array.isArray(component?.dataSourceValues)
      ? component.dataSourceValues
      : [];
    const fromSelect = Array.isArray(component?.data?.values)
      ? component.data.values
      : [];
    const raw = fromDatagrid.length > 0 ? fromDatagrid : fromSelect;
    if (
      !Array.isArray(allowedClassificationIds) ||
      allowedClassificationIds.length === 0
    ) {
      return [];
    }
    const allowedSet = new Set(
      allowedClassificationIds.map((id) => String(id))
    );
    return raw.filter((opt) => opt && allowedSet.has(String(opt.value)));
  }, [
    component?.dataSourceValues,
    component?.data?.values,
    allowedClassificationIds,
  ]);

  const statesList = useMemo(() => states, [states]);

  const auxInitialSubmission = useMemo(
    () =>
      rawAuxData != null && typeof rawAuxData === 'object' ? rawAuxData : null,
    [rawAuxData]
  );

  const primaryKey = useMemo(() => {
    const auxData =
      rawAuxData != null && typeof rawAuxData === 'object'
        ? { ...rawAuxData }
        : {};
    const schemaKey = getSchemaAuxKey(auxData, storeService);
    return auxData?.task_label ?? schemaKey ?? null;
  }, [rawAuxData, storeService]);

  const isSubcaseClosed = useMemo(() => {
    if (selectedSubcase == null) return false;
    const fecha =
      selectedSubcase.fecha_resolucion ??
      selectedSubcase.case?.fecha_resolucion;
    return fecha != null && String(fecha).trim() !== '';
  }, [selectedSubcase]);

  const mockRoot = useMemo(
    () => ({
      data: {
        clasificacion_id: selectedClassificationId ?? null,
        case_id: selectedSubcase?.id ?? selectedSubcase?.case_id ?? null,
      },
    }),
    [selectedClassificationId, selectedSubcase]
  );

  /**
   * Loads states, oneScript/schemaId (and optionally currentStateName + description) for a given classification.
   * @param {string} classificationId
   * @param {object | null} subcaseData - If provided (edit mode), uses subcase's current state and loads description.
   */
  const loadForClassification = useCallback(
    async (classificationId, subcaseData) => {
      const _nonce = sessionNonceRef.current;
      try {
        if (!classificationsService || !statesService || !storeService) {
          throw new Error('Servicios de Kace no disponibles.');
        }
        const classification = await classificationsService.fetchClassification(
          {
            id: classificationId,
          }
        );
        const flujoId = classification?.flujo_id ?? null;
        if (!flujoId) {
          throw new Error(
            'No se encontró flujo asociado a la clasificación configurada.'
          );
        }
        const transitionsRaw = await statesService.fetchTransitionsData({
          flowId: flujoId,
        });

        let currentStateId;
        if (subcaseData != null) {
          const subcaseTransitionId =
            subcaseData?.transicion_id ?? subcaseData?.transicion?.id ?? null;
          const subcaseTransition = Array.isArray(transitionsRaw)
            ? transitionsRaw.find((t) => t.id == subcaseTransitionId)
            : null;
          currentStateId = subcaseTransition?.siguiente_estado_id ?? null;
          if (subcaseTransition != null) {
            const name = await statesService.fetchStateName({
              state_id: subcaseTransition.siguiente_estado_id,
            });
            setCurrentStateName(name ?? 'Estado actual');
          } else {
            setCurrentStateName(null);
          }
        } else {
          setCurrentStateName(null);
          const parentCaseData =
            parentCaseDataRef.current ??
            storeService.get('case.case_data') ??
            storeService.get('cases.case_data') ??
            {};
          const parentTransitionId =
            parentCaseData?.transicion_id ??
            parentCaseData?.transicion?.id ??
            null;
          const currentTransition = Array.isArray(transitionsRaw)
            ? transitionsRaw.find((t) => t.id === parentTransitionId)
            : null;
          currentStateId = currentTransition?.siguiente_estado_id ?? null;
        }

        const nextTransitions = Array.isArray(transitionsRaw)
          ? transitionsRaw.filter(
              (t) => t.estado_actual_id === currentStateId && t.status === 1
            )
          : [];
        const statesWithNames = await Promise.all(
          nextTransitions.map(async (t) => {
            const nombre = await statesService.fetchStateName({
              state_id: t.siguiente_estado_id,
            });
            return {
              transition_id: t.id,
              state_id: t.siguiente_estado_id,
              nombre: nombre ?? 'Sin nombre',
            };
          })
        );
        if (sessionNonceRef.current !== _nonce) return;
        setStates(statesWithNames);
        setSelectedTransitionId(null);

        const userData = await userService?.get('user.user_data');
        const groupId =
          storeService.get('config.selected_group_id') ??
          userData?.grupo_activo?.grupo_id ??
          userData?.user?.grupo_activo ??
          null;
        if (sessionNonceRef.current !== _nonce) return;
        if (groupId) {
          const rels =
            await classificationsService.fetchClassificationsGroupsRelationship(
              {
                classificationId,
                groupId,
              }
            );
          if (sessionNonceRef.current !== _nonce) return;
          const first = Array.isArray(rels) && rels.length ? rels[0] : null;
          const formId =
            first?.one_script_id ??
            first?.form ??
            first?.form_id ??
            first?.one_script_form_id ??
            null;
          if (formId) {
            setOneScriptFormId(formId);
            if (oneScriptService?.fetchOneScriptData) {
              const oneScriptData =
                await oneScriptService.fetchOneScriptData(formId);
              if (sessionNonceRef.current !== _nonce) return;
              const resolvedSchemaId =
                oneScriptData?.schema_id ?? oneScriptData?.schemaId ?? null;
              if (resolvedSchemaId) setSchemaId(resolvedSchemaId);
            }
          } else {
            setOneScriptFormId(null);
            setSchemaId(null);
          }
        } else {
          setOneScriptFormId(null);
          setSchemaId(null);
        }

        if (subcaseData != null && caseService) {
          const descripcionCasoId =
            subcaseData?.descripcion_caso_id ??
            subcaseData?.case?.descripcion_caso_id ??
            null;
          let descriptionText = '';
          if (descripcionCasoId) {
            descriptionText = await caseService
              .fetchCaseDescription({ descripcionCasoId })
              .catch(() => '');
          }
          if (sessionNonceRef.current !== _nonce) return;
          setDescription(
            typeof descriptionText === 'string' ? descriptionText : ''
          );
        }

        if (sessionNonceRef.current !== _nonce) return;
        setModalKey((k) => k + 1);
      } catch (err) {
        if (sessionNonceRef.current !== _nonce) return;
        setError(err?.message ?? String(err));
      } finally {
        if (sessionNonceRef.current === _nonce) {
          setIsLoading(false);
        }
      }
    },
    [
      classificationsService,
      statesService,
      storeService,
      userService,
      oneScriptService,
      caseService,
    ]
  );

  const openModal = useCallback(() => {
    sessionNonceRef.current += 1;
    setIsLoading(false);
    sessionStartRef.current = new Date().toISOString();
    sessionModeRef.current = 'creacion';
    sessionSavedRef.current = false;
    setIsViewMode(false);
    setError(null);
    setSelectedSubcase(null);
    setRawAuxData(null);
    setAuxCaseId(null);
    setCurrentStateName(null);
    setSelectedClassificationId(null);
    setIsClassificationLocked(false);
    setStates([]);
    setOneScriptFormId(null);
    setSchemaId(null);
    setSelectedTransitionId(null);
    setAuxFormData(null);
    setDescription('');
    setIsOpen(true);
    setSubcaseSchemaRefreshNonce(0);
    lastSubcaseModalClasificacionIdRef.current = null;
    // A previous modal session (edit/view/create) may have left a stale
    // aux-form schema in the store — never assume it still matches the
    // classification about to be picked in this new session.
    if (storeService) {
      storeService.set(STORE_KEY_AUX_SUBCASES_SCHEMA, null);
      storeService.set('aux_case.hasSchema', false);
    }
    if (enableSubcaseAttachments) {
      resetSubcaseAttachments();
    }
  }, [enableSubcaseAttachments, resetSubcaseAttachments, storeService]);

  const closeModal = useCallback(() => {
    sessionNonceRef.current += 1;
    setIsLoading(false);
    const mode = sessionModeRef.current;
    const saved = sessionSavedRef.current;
    const start = sessionStartRef.current;
    if (
      (mode === 'edicion' || mode === 'revision') &&
      !saved &&
      selectedSubcase != null
    ) {
      try {
        const auxData =
          rawAuxData != null && typeof rawAuxData === 'object'
            ? { ...rawAuxData }
            : {};
        const schemaKey = getSchemaAuxKey(auxData, storeService);
        if (schemaKey) {
          const inner =
            auxData[schemaKey] != null && typeof auxData[schemaKey] === 'object'
              ? { ...auxData[schemaKey] }
              : {};
          const existingSesiones = Array.isArray(inner.sesiones)
            ? inner.sesiones
            : [];
          const newSession = {
            inicio: start ?? null,
            fin: new Date().toISOString(),
            evento: 'revision',
            elemento: ELEMENTO_SUBCASO,
          };
          inner.sesiones = [...existingSesiones, newSession];
          const { sesiones: _sesiones, ...innerForApi } = inner;
          auxData[schemaKey] = innerForApi;
        }
        const auxPayload = auxData;
        removeKeysFromSubmissionData(auxPayload, ['sesiones']);
        const subcaseId =
          selectedSubcase?.id ?? selectedSubcase?.case_id ?? null;
        const descripcionCasoId =
          selectedSubcase?.descripcion_caso_id ??
          selectedSubcase?.case?.descripcion_caso_id ??
          null;
        const classificationId =
          selectedSubcase?.clasificacion_id ??
          selectedSubcase?.case?.clasificacion_id ??
          null;
        const minimalCase = {
          transicion_id:
            selectedSubcase?.transicion_id ??
            selectedSubcase?.transicion?.id ??
            null,
          clasificacion_id: classificationId,
          descripcion_caso_id: descripcionCasoId,
          parent_id: selectedSubcase?.parent_id ?? null,
          cliente_id: selectedSubcase?.cliente_id ?? null,
          grupo_id: selectedSubcase?.grupo_id ?? null,
          responsable_id: selectedSubcase?.responsable_id ?? null,
        };
        const descFromApi =
          selectedSubcase?.descripcion_caso?.descripcion ??
          selectedSubcase?.case?.descripcion_caso?.descripcion ??
          (typeof selectedSubcase?.descripcion_caso === 'string'
            ? selectedSubcase.descripcion_caso
            : '');
        const descriptionValue =
          (typeof descFromApi === 'string' ? descFromApi.trim() : '') ||
          (typeof description === 'string' ? description.trim() : '');
        caseService
          ?.submitCaseData?.({
            caseData: {
              case: minimalCase,
              aux_cases: { id: auxCaseId ?? undefined, data: auxPayload },
            },
            description: descriptionValue,
            id: subcaseId,
          })
          .catch(() => {});
      } catch (_) {
        // Graceful failure on close; no user-facing error
      }
    }
    sessionStartRef.current = null;
    sessionModeRef.current = null;
    sessionSavedRef.current = false;
    setIsViewMode(false);
    setIsOpen(false);
    setError(null);
    setSelectedTransitionId(null);
    setSelectedClassificationId(null);
    setIsClassificationLocked(false);
    setAuxFormData(null);
    setDescription('');
    setOneScriptFormId(null);
    setSchemaId(null);
    setStates([]);
    setSelectedSubcase(null);
    setRawAuxData(null);
    setAuxCaseId(null);
    setCurrentStateName(null);
    if (enableSubcaseAttachments) {
      resetSubcaseAttachments();
    }
    setSubcaseSchemaRefreshNonce(0);
    lastSubcaseModalClasificacionIdRef.current = null;
    // Do not leave this session's aux-form schema behind for the next
    // modal session (create/edit/view) to accidentally read as its own.
    if (storeService) {
      storeService.set(STORE_KEY_AUX_SUBCASES_SCHEMA, null);
      storeService.set('aux_case.hasSchema', false);
    }
  }, [
    selectedSubcase,
    rawAuxData,
    auxCaseId,
    description,
    caseService,
    storeService,
    enableSubcaseAttachments,
    resetSubcaseAttachments,
  ]);

  const handleClassificationChange = useCallback(
    (value) => {
      const id =
        value != null && String(value).trim() !== ''
          ? String(value).trim()
          : null;
      setSelectedClassificationId(id);
      setError(null);
      if (!id) {
        sessionNonceRef.current += 1;
        setStates([]);
        setOneScriptFormId(null);
        setSchemaId(null);
        setSelectedTransitionId(null);
        setIsLoading(false);
        lastSubcaseModalClasificacionIdRef.current = null;
        if (storeService) {
          storeService.set(STORE_KEY_AUX_SUBCASES_SCHEMA, null);
          storeService.set('aux_case.hasSchema', false);
        }
        return;
      }
      const isSwitchingClassification =
        lastSubcaseModalClasificacionIdRef.current != null &&
        lastSubcaseModalClasificacionIdRef.current !== id;
      lastSubcaseModalClasificacionIdRef.current = id;

      setIsLoading(true);
      setStates([]);
      setSelectedTransitionId(null);
      setOneScriptFormId(null);
      setSchemaId(null);
      if (storeService) {
        storeService.set(STORE_KEY_AUX_SUBCASES_SCHEMA, null);
        storeService.set('aux_case.hasSchema', false);
      }
      if (isSwitchingClassification) {
        setSubcaseSchemaRefreshNonce((n) => n + 1);
      }
      sessionNonceRef.current += 1;
      loadForClassification(id, null);
    },
    [loadForClassification, storeService]
  );

  const handleEditClick = useCallback(
    (rowOrId) => {
      const caseId =
        typeof rowOrId === 'object' && rowOrId != null
          ? (rowOrId?.id ?? rowOrId?.case_id)
          : rowOrId;
      if (caseId == null) return;

      const _nonce = ++sessionNonceRef.current;
      sessionStartRef.current = new Date().toISOString();
      sessionModeRef.current = 'edicion';
      sessionSavedRef.current = false;
      setIsViewMode(false);
      setError(null);
      setSelectedSubcase(null);
      setRawAuxData(null);
      setIsOpen(true);
      setIsLoading(true);
      setSelectedTransitionId(null);
      setAuxFormData(null);
      setDescription('');
      setOneScriptFormId(null);
      setSchemaId(null);
      setSubcaseSchemaRefreshNonce(0);
      lastSubcaseModalClasificacionIdRef.current = null;

      (async () => {
        try {
          if (!caseService) {
            throw new Error('Servicios de Kace no disponibles.');
          }
          // The OS-SCHEMA saves via apiService.post() directly (not caseService.submitCaseData),
          // so invalidateKaceResponseCacheForCases is never called after a beforeSubmitCode save.
          // Force a cache miss here so we always read the post-save state from the server.
          invalidateKaceResponseCacheForCases([String(caseId)]);
          const [fullCaseData, auxResult] = await Promise.all([
            caseService.fetchCaseData({ caseId, logEvent: true }),
            caseService.fetchAuxCase({ caseId }).catch(() => null),
          ]);

          if (sessionNonceRef.current !== _nonce) return;
          setSelectedSubcase(fullCaseData);

          // caseService.fetchCaseData() just overwrote the shared store key
          // `cases.case_data` with this subcase's row (it doesn't know it's
          // being called for a subcase, not the parent case). Anything else
          // reading that key live (e.g. useStates.js for the parent case's
          // Estados panel) would otherwise show the subcase's state until a
          // full page reload re-fetches the parent case. Restore it right
          // after capturing what we need locally in `fullCaseData`.
          if (storeService && parentCaseDataRef.current != null) {
            storeService.set('cases.case_data', parentCaseDataRef.current);
          }

          // Prefer aux_case embedded in the case response: GET /cases/:id?logEvent=true
          // reads from the primary DB (write path), so its data is always fresh even when
          // GET /aux-cases/:id may lag due to read-replica replication delay after a save.
          const embeddedAux = fullCaseData?.aux_case;
          const resolvedAuxData =
            embeddedAux?.data ?? auxResult?.aux_case_data ?? null;
          const resolvedAuxId =
            embeddedAux?.id ?? auxResult?.aux_case_id ?? null;
          if (resolvedAuxData != null) {
            setRawAuxData(resolvedAuxData);
          }
          if (resolvedAuxId != null) {
            setAuxCaseId(resolvedAuxId);
          }

          // The onMountKaceEngineScript on the hidden sync component (usuario_asignado_nombre_loader)
          // reads from case.responsable — not from aux_case — to set usuario_asignado_nombre.
          // When aux_case already has a value the responsable may differ, causing the sync to
          // overwrite the correct loaded value.
          //
          // __KACE_USUARIO_ASIGNADO_TOUCHED__ is checked first in syncFromCurrentCase before any
          // key resolution, making it the most direct and reliable way to block the overwrite.
          // When aux_case has data the value is already authoritative from the server; setting
          // TOUCHED__ signals "don't overwrite this session's value" the same way a user selection
          // would. When there is no aux_case data we clear it so the sync can fill in the name.
          //
          // We also clear INITIAL_SYNC_DONE for all candidate keys so stale flags from a previous
          // session don't block a legitimate sync on a subcase that has no aux data.
          const _w = /** @type {any} */ (window);
          const _storeCaseId = storeService?.get?.('cases.case_id') ?? null;
          const _hasAuxData =
            resolvedAuxData != null && Object.keys(resolvedAuxData).length > 0;

          if (_hasAuxData) {
            // Aux data is authoritative — block the sync from overwriting with case.responsable.
            _w.__KACE_USUARIO_ASIGNADO_TOUCHED__ = true;
          } else {
            // No aux data — let the sync run to resolve the user name from the case.
            delete _w.__KACE_USUARIO_ASIGNADO_TOUCHED__;
          }

          // Reset INITIAL_SYNC_DONE for all candidate syncKeys so every open is a clean start.
          _w.__KACE_ASSIGNMENT_INITIAL_SYNC_DONE__ =
            _w.__KACE_ASSIGNMENT_INITIAL_SYNC_DONE__ || {};
          for (const _key of [caseId, _storeCaseId].filter(Boolean)) {
            delete _w.__KACE_ASSIGNMENT_INITIAL_SYNC_DONE__[_key];
          }

          const classificationId =
            (fullCaseData?.clasificacion_id ??
              fullCaseData?.case?.clasificacion_id) != null
              ? String(
                  fullCaseData.clasificacion_id ??
                    fullCaseData.case.clasificacion_id
                )
              : null;
          if (!classificationId) {
            throw new Error('El subcaso no tiene clasificación asociada.');
          }
          setSelectedClassificationId(classificationId);
          setIsClassificationLocked(true);
          lastSubcaseModalClasificacionIdRef.current = classificationId;
          await loadForClassification(classificationId, fullCaseData);
          if (sessionNonceRef.current === _nonce && enableSubcaseAttachments) {
            await loadSubcaseAttachmentsForCase(caseId);
          }
        } catch (err) {
          if (sessionNonceRef.current === _nonce) {
            setError(err?.message ?? String(err));
          }
        } finally {
          if (sessionNonceRef.current === _nonce) {
            setIsLoading(false);
          }
        }
      })();
    },
    [
      caseService,
      storeService,
      loadForClassification,
      enableSubcaseAttachments,
      loadSubcaseAttachmentsForCase,
    ]
  );

  /**
   * Opens the modal in read-only (view) mode. Registers a "revision" session on close.
   * @param {any} rowOrId - Row data or subcase id
   */
  const handleViewClick = useCallback(
    (rowOrId) => {
      const caseId =
        typeof rowOrId === 'object' && rowOrId != null
          ? (rowOrId?.id ?? rowOrId?.case_id)
          : rowOrId;
      if (caseId == null) return;

      const _nonce = ++sessionNonceRef.current;
      sessionStartRef.current = new Date().toISOString();
      sessionModeRef.current = 'revision';
      sessionSavedRef.current = false;
      setIsViewMode(true);
      setError(null);
      setSelectedSubcase(null);
      setRawAuxData(null);
      setIsOpen(true);
      setIsLoading(true);
      setSelectedTransitionId(null);
      setAuxFormData(null);
      setDescription('');
      setOneScriptFormId(null);
      setSchemaId(null);
      setSubcaseSchemaRefreshNonce(0);
      lastSubcaseModalClasificacionIdRef.current = null;

      (async () => {
        try {
          if (!caseService) {
            throw new Error('Servicios de Kace no disponibles.');
          }
          // The OS-SCHEMA saves via apiService.post() directly (not caseService.submitCaseData),
          // so invalidateKaceResponseCacheForCases is never called after a beforeSubmitCode save.
          // Force a cache miss here so we always read the post-save state from the server.
          invalidateKaceResponseCacheForCases([String(caseId)]);
          const [fullCaseData, auxResult] = await Promise.all([
            caseService.fetchCaseData({ caseId, logEvent: true }),
            caseService.fetchAuxCase({ caseId }).catch(() => null),
          ]);

          if (sessionNonceRef.current !== _nonce) return;
          setSelectedSubcase(fullCaseData);

          // caseService.fetchCaseData() just overwrote the shared store key
          // `cases.case_data` with this subcase's row (it doesn't know it's
          // being called for a subcase, not the parent case). Anything else
          // reading that key live (e.g. useStates.js for the parent case's
          // Estados panel) would otherwise show the subcase's state until a
          // full page reload re-fetches the parent case. Restore it right
          // after capturing what we need locally in `fullCaseData`.
          if (storeService && parentCaseDataRef.current != null) {
            storeService.set('cases.case_data', parentCaseDataRef.current);
          }

          // Prefer aux_case embedded in the case response: GET /cases/:id?logEvent=true
          // reads from the primary DB (write path), so its data is always fresh even when
          // GET /aux-cases/:id may lag due to read-replica replication delay after a save.
          const embeddedAux = fullCaseData?.aux_case;
          const resolvedAuxData =
            embeddedAux?.data ?? auxResult?.aux_case_data ?? null;
          const resolvedAuxId =
            embeddedAux?.id ?? auxResult?.aux_case_id ?? null;
          if (resolvedAuxData != null) {
            setRawAuxData(resolvedAuxData);
          }
          if (resolvedAuxId != null) {
            setAuxCaseId(resolvedAuxId);
          }

          const classificationId =
            (fullCaseData?.clasificacion_id ??
              fullCaseData?.case?.clasificacion_id) != null
              ? String(
                  fullCaseData.clasificacion_id ??
                    fullCaseData.case.clasificacion_id
                )
              : null;
          if (!classificationId) {
            throw new Error('El subcaso no tiene clasificación asociada.');
          }
          setSelectedClassificationId(classificationId);
          setIsClassificationLocked(true);
          lastSubcaseModalClasificacionIdRef.current = classificationId;
          await loadForClassification(classificationId, fullCaseData);
          if (sessionNonceRef.current === _nonce && enableSubcaseAttachments) {
            await loadSubcaseAttachmentsForCase(caseId);
          }
        } catch (err) {
          if (sessionNonceRef.current === _nonce) {
            setError(err?.message ?? String(err));
          }
        } finally {
          if (sessionNonceRef.current === _nonce) {
            setIsLoading(false);
          }
        }
      })();
    },
    [
      caseService,
      storeService,
      loadForClassification,
      enableSubcaseAttachments,
      loadSubcaseAttachmentsForCase,
    ]
  );

  const handleTransitionChange = useCallback((value) => {
    setSelectedTransitionId(value === '' ? null : value);
    setError(null);
  }, []);

  const handleAuxFormUpdate = useCallback((value) => {
    setAuxFormData(value != null && typeof value === 'object' ? value : null);
  }, []);

  const handleDescriptionChange = useCallback((value) => {
    setDescription(typeof value === 'string' ? value : '');
  }, []);

  const setFormInstance = useCallback((instance) => {
    formInstanceRef.current = instance;
  }, []);

  const handleSubmit = useCallback(async () => {
    const isEditing = selectedSubcase != null;
    const currentSubcaseTransitionId =
      selectedSubcase?.transicion_id ?? selectedSubcase?.transicion?.id ?? null;
    const resolvedTransitionId =
      selectedTransitionId ??
      (!enforceStateChangeValidation && isEditing
        ? currentSubcaseTransitionId
        : null);

    if (!resolvedTransitionId) {
      setError('Seleccione un estado siguiente.');
      return;
    }
    const classificationId =
      selectedClassificationId != null &&
      String(selectedClassificationId).trim() !== ''
        ? String(selectedClassificationId).trim()
        : null;
    if (!classificationId) {
      setError('Seleccione una clasificación.');
      return;
    }
    if (!caseService || !storeService || !userService) {
      setError('Servicios de Kace no disponibles.');
      return;
    }
    // This classification expects an aux form (schemaId resolved), but the
    // OneScript form's schema may still be loading asynchronously in
    // AuxCasesSchema — submitting now would validate against a stale or
    // missing schema left over from a previous modal session.
    if (schemaId && !storeService.get('aux_case.hasSchema')) {
      setError(
        'El formulario auxiliar aún se está cargando. Espera un momento e intenta de nuevo.'
      );
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const subcaseAuxData = auxFormData ?? {};
      const schemaKey = getSchemaAuxKey(
        Object.keys(subcaseAuxData).length > 0 ? subcaseAuxData : rawAuxData,
        storeService
      );
      const innerData =
        schemaKey != null &&
        subcaseAuxData[schemaKey] != null &&
        typeof subcaseAuxData[schemaKey] === 'object'
          ? { ...subcaseAuxData[schemaKey] }
          : {};
      const existingSesiones = Array.isArray(rawAuxData?.[schemaKey]?.sesiones)
        ? rawAuxData[schemaKey].sesiones
        : [];
      const newSession = {
        inicio: sessionStartRef.current ?? null,
        fin: new Date().toISOString(),
        evento: isEditing ? 'edicion' : 'creacion',
        elemento: ELEMENTO_SUBCASO,
      };
      innerData.sesiones = [...existingSesiones, newSession];
      const { sesiones: _sesiones, ...innerDataForApi } = innerData;
      const dataWithSesiones =
        schemaKey != null
          ? { ...subcaseAuxData, [schemaKey]: innerDataForApi }
          : subcaseAuxData;
      removeKeysFromSubmissionData(dataWithSesiones, ['sesiones']);
      let descriptionValue =
        typeof description === 'string' ? description.trim() : '';
      const stripped = descriptionValue.replace(/<[^>]*>/g, '').trim();
      if (!stripped) descriptionValue = '';

      let subcasePayload;
      let auxCasesPayload = { data: dataWithSesiones };
      if (isEditing) {
        const descripcionCasoId =
          selectedSubcase?.descripcion_caso_id ??
          selectedSubcase?.case?.descripcion_caso_id ??
          null;

        // Payload completo para edición: incluir todos los campos requeridos
        subcasePayload = {
          transicion_id: resolvedTransitionId,
          clasificacion_id:
            classificationId ?? selectedSubcase?.clasificacion_id ?? null,
          descripcion_caso_id: descripcionCasoId,
          parent_id: selectedSubcase?.parent_id ?? null,
          cliente_id: selectedSubcase?.cliente_id ?? null,
          grupo_id: selectedSubcase?.grupo_id ?? null,
          responsable_id: selectedSubcase?.responsable_id ?? null,
        };

        // Incluir el ID del aux_case si existe
        if (auxCaseId) {
          auxCasesPayload.id = auxCaseId;
        }
      } else {
        const parentCaseData =
          storeService.get('case.case_data') ??
          storeService.get('cases.case_data') ??
          {};
        const parentCase = parentCaseData?.case ?? parentCaseData;
        const parentId =
          storeService.get('cases.case_id') ??
          parentCaseData?.id ??
          parentCase?.id ??
          null;
        const clienteId =
          storeService.get('auth.client_id') ??
          parentCase?.cliente_id ??
          parentCaseData?.cliente_id ??
          null;

        let userData = null;
        try {
          userData = await userService.get('user.user_data');
        } catch (_) {
          // ignorar
        }
        const grupoActivo =
          userData?.user?.grupo_activo ??
          userData?.grupo_activo ??
          storeService.get('config.selected_group_id');
        const grupoId =
          typeof grupoActivo === 'object' &&
          grupoActivo != null &&
          'grupo_id' in grupoActivo
            ? grupoActivo.grupo_id
            : grupoActivo;
        const userId =
          userData?.user_id ??
          userData?.user?.id ??
          storeService.get('user.user_id');

        const subcaseDescripcionCasoId = uuidv4();
        subcasePayload = {
          clasificacion_id: classificationId ?? null,
          transicion_id: resolvedTransitionId,
          parent_id: parentId,
          cliente_id: clienteId,
          grupo_id:
            parentCase?.grupo_id ?? parentCaseData?.grupo_id ?? grupoId ?? null,
          responsable_id:
            parentCase?.responsable_id ??
            parentCaseData?.responsable_id ??
            userId ??
            null,
          descripcion_caso_id: subcaseDescripcionCasoId,
        };
      }

      const keysToIgnore =
        (storeService && storeService.get(STORE_KEY_IGNORE_SCHEMA_KEYS)) ??
        DEFAULT_IGNORE_SCHEMA_KEYS;
      removeKeysFromSubmissionData(subcaseAuxData, keysToIgnore);
      removeKeysFromSubmissionData(subcaseAuxData, ['sesiones']);

      await caseService.validateCaseFields(
        subcasePayload,
        subcaseAuxData,
        descriptionValue,
        isEditing,
        true,
        Boolean(schemaId),
        { skipRequireStateChangeCheck: !enforceStateChangeValidation }
      );

      const beforeSubmitContext = {
        subcasePayload,
        subcaseAuxData,
        subcaseAuxId: auxCaseId || uuidv4(),
        descriptionValue,
        isEditing,
        kaceEngine: kace,
        apiService: kace.getService('apiService'),
        caseService,
        storeService,
        userService,
        fileService,
        uploadPendingCaseAttachments: (caseId) =>
          caseService.uploadPendingCaseAttachments(caseId),
        selectedSubcase: selectedSubcase ?? null,
        setError,
        // Real React close (marks the session as saved and resets all modal
        // state) — beforeSubmitCode should call this instead of clicking the
        // modal's close button in the DOM, which bypasses this hook's
        // lifecycle entirely and can leave stale state (e.g. the aux-form
        // schema in the store) for the next modal session to read.
        closeModal,
        subcaseAttachments: subcaseAttachments.files,
        uploadSubcaseAttachments,
        abort: (mensaje) => {
          beforeSubmitContext.aborted = true;
          beforeSubmitContext.abortMessage =
            typeof mensaje === 'string' ? mensaje : 'Envío cancelado.';
        },
        aborted: false,
        abortMessage: null,
        refreshListCallback: refreshListCallback ?? null,
      };
      if (
        component?.beforeSubmitCode &&
        typeof component.beforeSubmitCode === 'string' &&
        component.beforeSubmitCode.trim() !== ''
      ) {
        try {
          evaluateKace(component.beforeSubmitCode.trim(), beforeSubmitContext);
        } catch (err) {
          setError(err?.message ?? String(err));
          return;
        }
        if (beforeSubmitContext.aborted) {
          setError(beforeSubmitContext.abortMessage ?? 'Envío cancelado.');
          return;
        }
        sessionSavedRef.current = true;
      } else {
        const subcaseData = {
          case: subcasePayload,
          aux_cases: auxCasesPayload,
        };
        const submitResponse = await caseService.submitCaseData({
          caseData: subcaseData,
          description: descriptionValue || '',
          id: isEditing
            ? (selectedSubcase?.id ?? selectedSubcase?.case_id)
            : null,
          uploadAttachments: false,
        });

        if (enableSubcaseAttachments && fileService) {
          const pending = subcaseAttachments.pendingFiles;
          if (pending.length > 0) {
            const uploadId = isEditing
              ? (selectedSubcase?.id ?? selectedSubcase?.case_id)
              : extractCreatedCaseIdFromSubmitResponse(submitResponse);
            if (uploadId == null || uploadId === '') {
              throw new Error(
                'No se pudo obtener el ID del subcaso para subir los adjuntos.'
              );
            }
            await fileService.uploadAttachments(
              uploadId,
              subcaseAttachments.files
            );
          }
        }

        sessionSavedRef.current = true;
        if (!isEditing) {
          const existing = storeService.get('subcases.list') ?? [];
          storeService.set('subcases.list', [
            ...existing,
            { caseData: subcaseData, createdAt: new Date().toISOString() },
          ]);
        }

        closeModal();
        if (typeof refreshListCallback === 'function') {
          refreshListCallback({ force: true }).catch(() => {});
        }
      }
    } catch (err) {
      setError(err?.message ?? String(err));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    selectedTransitionId,
    selectedClassificationId,
    selectedSubcase,
    auxFormData,
    rawAuxData,
    description,
    schemaId,
    auxCaseId,
    caseService,
    storeService,
    userService,
    closeModal,
    refreshListCallback,
    enableSubcaseAttachments,
    fileService,
    subcaseAttachments.files,
    subcaseAttachments.pendingFiles,
    uploadSubcaseAttachments,
    enforceStateChangeValidation,
  ]);

  return {
    isOpen,
    isLoading,
    isSubmitting,
    error,
    states: statesList,
    selectedTransitionId,
    selectedClassificationId,
    isClassificationLocked,
    handleClassificationChange,
    mockRoot,
    auxFormData,
    oneScriptFormId,
    schemaId,
    buttonLabel,
    openModal,
    closeModal,
    handleEditClick,
    handleTransitionChange,
    handleAuxFormUpdate,
    setFormInstance,
    handleSubmit,
    description,
    handleDescriptionChange,
    modalKey,
    selectedSubcase,
    auxInitialSubmission,
    currentStateName,
    isSubcaseClosed,
    isViewMode,
    handleViewClick,
    classificationOptions,
    primaryKey,
    subcaseSchemaRefreshNonce,
    subcaseAttachments,
  };
}
