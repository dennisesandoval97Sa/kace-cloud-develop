import './Classifications.css';
import '#plugins/kace/shared/styles/kace-disabled.css';
import ClassificationsOptions from '#plugins/kace/components/classifications/components/ClassificationsOptions.jsx';
import { KaceEngine } from '#plugins/kace/KaceEngine.js';
import { evaluateKace } from '#plugins/kace/shared/evaluateKace.js';
import {
  isLoadStale,
  useLazySelectOptions,
} from '#plugins/kace/hooks/useLazySelectOptions.hook.js';
import { useKaceDisabled } from '#plugins/kace/hooks/useKaceDisabled.hook.js';
import { useReclassifyUnlockGate } from '#plugins/kace/hooks/useReclassifyUnlockGate.js';
import {
  isReclassificationReasonInvalid,
  isReclassifying,
  RECLASSIFICATION_PRECHECK_STORE_PATH,
  RECLASSIFICATION_REASON_MAX_LENGTH,
  resolveLeafSelectionAction,
  SELECTION_CONFIRM,
} from './reclassificationPolicy.js';
import { useReclassificationWorkflow } from '#plugins/kace/hooks/useReclassificationWorkflow.js';
import { ReclassificationConfirmDialog } from './components/ReclassificationConfirmDialog.jsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClassificationsCreateOptions } from '#plugins/kace/shared/ClassificationsCreateOptions.js';
import { storeService } from '#plugins/kace/services/storeService.js';
import {
  consumePendingDefaults,
  createInitSession,
  isClassificationsAuthReady,
  markScriptRan,
  queueOrResolveDefaults,
  shouldEvaluateUserScript,
} from './classificationsInitPolicy.js';

/**
 * @param {Record<string, string>} selection
 * @param {Array<{ value?: string, options?: unknown[] }>} tree
 * @returns {Record<string, string>}
 */
function validateSelectionAgainstTree(tree, selection) {
  if (
    !Array.isArray(tree) ||
    !tree.length ||
    !selection ||
    typeof selection !== 'object'
  ) {
    return {};
  }
  const out = {};
  let current = tree;
  for (let i = 1; i <= 64; i++) {
    const key = `nivel${i}`;
    const val = selection[key];
    if (val === undefined || val === null || val === '') break;
    const found = current.find((o) => String(o.value) === String(val));
    if (!found) break;
    out[key] = String(val);
    if (!found.options?.length) break;
    current = found.options;
  }
  return out;
}

/**
 * Cantidad de niveles consecutivos desde nivel1 presentes en el objeto validado.
 * @param {Record<string, string>} validated
 */
function consecutiveLockedLevelCount(validated) {
  let n = 0;
  for (let i = 1; i <= 64; i++) {
    if (validated[`nivel${i}`]) n = i;
    else break;
  }
  return n;
}

/**
 * Último nodo del árbol recorriendo nivel1, nivel2… en orden (evita depender del orden de Object.keys).
 * @param {Array<{ value?: string, options?: unknown[] }>} tree
 * @param {Record<string, string>} selectedOptions
 * @returns {unknown | null}
 */
/**
 * Texto visible de cada nivel seleccionado (label de la opción en el árbol).
 * @param {Array<{ label?: string, value?: string, options?: unknown[] }>} tree
 * @param {Record<string, string>} selectedOptions
 * @returns {Record<string, string>}
 */
function buildLevelLabelsFromTree(tree, selectedOptions) {
  if (
    !Array.isArray(tree) ||
    !tree.length ||
    !selectedOptions ||
    typeof selectedOptions !== 'object'
  ) {
    return {};
  }
  const out = {};
  let current = tree;
  for (let i = 1; i <= 64; i++) {
    const key = `nivel${i}`;
    const val = selectedOptions[key];
    if (val === undefined || val === null || val === '') break;
    const found = current.find((o) => String(o.value) === String(val));
    if (!found) break;
    const label =
      found.label != null && String(found.label).trim() !== ''
        ? String(found.label)
        : String(val);
    out[key] = label;
    if (!Array.isArray(found.options) || !found.options.length) break;
    current = found.options;
  }
  return out;
}

/**
 * Camino de `nivelN` hasta la hoja cuya clasificación es `id`.
 *
 * A nivel de módulo porque lo usan dos sitios: la re-sincronización con el caso y la cancelación
 * de una reclasificación, que restaura ese mismo camino.
 *
 * @param {Array<{ value?: string, options?: unknown[] }>} opts
 * @param {unknown} id
 * @param {Array<{ value?: string }>} path
 * @returns {Array<{ value?: string }> | null}
 */
function findNivelPath(opts, id, path = []) {
  const normalizedId = id != null ? String(id) : null;
  if (!normalizedId || !Array.isArray(opts)) return null;

  for (const opt of opts) {
    if (opt.options && opt.options.length) {
      const found = findNivelPath(opt.options, id, [
        ...path,
        { value: opt.value },
      ]);
      if (found) return found;
    }
    const optClassificationId = opt.classification_id ?? opt.clasificacion_id;
    if (
      optClassificationId != null &&
      String(optClassificationId) === normalizedId
    ) {
      return [...path, { value: opt.value }];
    }
  }
  return null;
}

/**
 * El camino de `findNivelPath` como el objeto `{ nivel1, nivel2… }` que maneja el componente.
 *
 * @param {Array<{ value?: string }> | null} path
 * @returns {Record<string, string>}
 */
function nivelPathToSelection(path) {
  const selection = {};
  if (!Array.isArray(path)) return selection;
  path.forEach(({ value }, index) => {
    if (value) selection[`nivel${index + 1}`] = value;
  });
  return selection;
}

function getDeepestSelectedTreeNode(tree, selectedOptions) {
  if (
    !Array.isArray(tree) ||
    !tree.length ||
    !selectedOptions ||
    typeof selectedOptions !== 'object'
  ) {
    return null;
  }
  let current = tree;
  let lastNode = null;
  for (let i = 1; i <= 64; i++) {
    const key = `nivel${i}`;
    const val = selectedOptions[key];
    if (val === undefined || val === null || val === '') break;
    const found = current.find((o) => String(o.value) === String(val));
    if (!found) break;
    lastNode = found;
    current =
      Array.isArray(found.options) && found.options.length ? found.options : [];
  }
  return lastNode;
}

/**
 * @param {Record<string, unknown>} configLabels
 */
function countStoreClassificationLevels(configLabels) {
  const keys = Object.keys(configLabels || {}).filter((k) =>
    k.startsWith('label_')
  );
  return keys.reduce((max, key) => {
    const num = parseInt(String(key.split('_')[1]), 10);
    return Number.isFinite(num) ? Math.max(max, num) : max;
  }, 0);
}

/**
 * En edición, `GET /cases/:id` incluye `clasificacion` anidada; evita POST `/classifications/search`
 * y el árbol de niveles (ClassificationsCreateOptions) se arma con una sola fila.
 *
 * @param {Record<string, unknown> | null | undefined} caseRow
 * @returns {ReturnType<typeof ClassificationsCreateOptions> | null}
 */
function tryBuildClassificationOptionsFromEmbeddedCase(caseRow) {
  if (!caseRow || typeof caseRow !== 'object') {
    return null;
  }
  const cid = caseRow.clasificacion_id;
  const embed = caseRow.clasificacion;
  if (cid == null || !embed || typeof embed !== 'object') {
    return null;
  }
  const emb = /** @type {Record<string, unknown>} */ (embed);
  const embedId = emb.id ?? emb.clasificacion_id ?? emb.classification_id;
  if (embedId != null && String(embedId) !== String(cid)) {
    return null;
  }
  const row = { ...emb };
  if (row.id == null) {
    row.id = cid;
  }
  const opts = ClassificationsCreateOptions([row]);
  return Array.isArray(opts) && opts.length > 0 ? opts : null;
}

/**
 * Profundidad máxima de selects en el árbol (1 = solo raíz).
 * @param {Array<{ options?: unknown[] }>} nodes
 */
function classificationTreeSelectDepth(nodes) {
  if (!Array.isArray(nodes) || !nodes.length) return 0;
  let max = 1;
  for (const o of nodes) {
    if (o.options && o.options.length > 0) {
      max = Math.max(max, 1 + classificationTreeSelectDepth(o.options));
    }
  }
  return max;
}

/**
 * @param {Record<string, string>} storeLevelKeys
 * @param {number} N
 * @param {Record<string, string>} overrides
 */
function buildLevelKeys(storeLevelKeys, N, overrides) {
  const merged = {};
  for (let i = 1; i <= N; i++) {
    const k = `nivel${i}`;
    const fromStore = storeLevelKeys[k];
    merged[k] = fromStore || `Nivel ${i}`;
    if (overrides[k]) merged[k] = overrides[k];
  }
  return merged;
}

/**
 * Carga: si el caso trae `clasificacion_id`, se pide al resolverse el contexto. Si no (creación
 * limpia), se difiere a la primera interacción (pointer) en el área de niveles, salvo
 * `refetchOnEveryOpen` (Custom) que mantiene la caché del hook de carga perezosa.
 *
 * Coexiste con `classificationsInitCode` / `setDefaultSelections` (develop) y con el
 * desplegable con búsqueda y orden (ClassificationsOptions).
 */
export const Classifications = ({
  handleChange,
  emitEvent,
  root,
  disabled = false,
  data = {},
  onEvent,
  offEvent,
  component = {},
}) => {
  const {
    disabled: isDisabled,
    readOnlyLock,
    className: disabledClassName,
  } = useKaceDisabled(disabled);
  const refetchOnEveryOpen = Boolean(component?.refetchOnEveryOpen);
  const caseId = storeService.get('cases.case_id');
  const configLabels =
    storeService.get(
      'config.global_config.layouts.application.admin.classifications'
    ) || {};
  const storeLevelKeys = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(configLabels)
          .filter(([key]) => key.startsWith('label_'))
          .map(([key, value]) => [`nivel${key.split('_')[1]}`, value])
      ),
    [configLabels]
  );

  const nStore = useMemo(
    () => countStoreClassificationLevels(configLabels),
    [configLabels]
  );

  const [levelLabelOverrides, setLevelLabelOverrides] = useState({});
  const [lockedLevelCount, setLockedLevelCount] = useState(0);

  const [selectedOptions, setSelectedOptions] = useState({});
  const [classificationsLoading, setClassificationsLoading] = useState(false);
  const [options, setOptions] = useState([]);
  const [caseData, setCaseData] = useState(null);
  const [lastValidClasificacionId, setLastValidClasificacionId] =
    useState(null);
  const [isEditCase, setIsEditCase] = useState(false);
  const [hasRequestedOptions, setHasRequestedOptions] = useState(false);
  const [caseContextResolved, setCaseContextResolved] = useState(false);

  const isCreateCase = caseContextResolved && !isEditCase;

  const treeDepth = useMemo(
    () =>
      Array.isArray(options) && options.length
        ? classificationTreeSelectDepth(options)
        : 0,
    [options]
  );

  const levelKeys = useMemo(() => {
    const hasTree = Array.isArray(options) && options.length > 0;
    const N = Math.max(nStore, treeDepth, hasTree ? 1 : 0);
    if (N <= 0) return {};
    return buildLevelKeys(
      storeLevelKeys,
      N,
      isCreateCase ? levelLabelOverrides : {}
    );
  }, [
    nStore,
    treeDepth,
    options,
    storeLevelKeys,
    levelLabelOverrides,
    isCreateCase,
  ]);

  const optionsRef = useRef(options);
  optionsRef.current = options;
  const caseDataRef = useRef(caseData);
  caseDataRef.current = caseData;
  const isEditCaseRef = useRef(isEditCase);
  isEditCaseRef.current = isEditCase;
  const caseContextResolvedRef = useRef(caseContextResolved);
  caseContextResolvedRef.current = caseContextResolved;
  const dataRef = useRef(data);
  dataRef.current = data;
  const rootRef = useRef(root);
  rootRef.current = root;
  const lockedLevelCountRef = useRef(lockedLevelCount);
  lockedLevelCountRef.current = lockedLevelCount;
  const initSessionRef = useRef(createInitSession());

  /** Reclasificación (MSKT-1392): gobierna el desbloqueo del desplegable en un caso ya clasificado. */
  const { reclassifyUnlocked, reclassifyUnlockedRef } = useReclassifyUnlockGate(
    {
      onEvent,
      offEvent,
      caseHasClassification: Boolean(caseData?.clasificacion_id),
      caseIsClosed: Boolean(caseData?.fecha_resolucion),
    }
  );
  /** Una vez que el asesor elige otra clasificación, la re-sincronización con el caso deja de mandar. */
  const userChangedClassificationRef = useRef(false);

  const kaceEngine = KaceEngine();
  const classificationsService = kaceEngine.getService('classifications');
  const caseService = kaceEngine.getService('cases');

  const persistClassificationLabels = useCallback((selection, tree) => {
    const sourceTree =
      Array.isArray(tree) && tree.length ? tree : optionsRef.current;
    const labels = buildLevelLabelsFromTree(sourceTree, selection);
    if (!Object.keys(labels).length) {
      storeService.set('classifications.selected_classifications', null);
      return;
    }
    storeService.set('classifications.selected_classifications', labels);
  }, []);

  /** Restaura el camino de la clasificación del caso al cancelar una reclasificación. */
  const restoreSelection = useCallback(
    (restored, tree) => {
      setSelectedOptions(restored);
      persistClassificationLabels(restored, tree);
    },
    [persistClassificationLabels]
  );

  const resolveSelectionFor = useCallback(
    (tree, clasificacionId) =>
      nivelPathToSelection(findNivelPath(tree, clasificacionId)),
    []
  );

  const reclassifying = isReclassifying({
    reclassifyUnlocked,
    selectedClasificacionId: lastValidClasificacionId,
    caseClasificacionId: caseData?.clasificacion_id,
  });

  /*
   * Toda la orquestación de la reclasificación —motivo, precheck, confirmación, cancelación y la
   * limpieza de un precheck abandonado— vive en su propio hook. Se invoca AQUÍ, antes que el resto
   * de efectos del componente, porque su efecto de limpieza tiene que correr antes del que rebaja
   * `userChangedClassificationRef`: React corre los efectos en orden de declaración.
   */
  const {
    reclassificationReason,
    setReclassificationReason,
    confirmedClasificacionId,
    isCheckingPrecheck,
    precheckBlockerMessage,
    confirmReclassification,
    cancelReclassification,
    abandonCurrentTarget,
    persistReason,
  } = useReclassificationWorkflow({
    caseService,
    emitEvent,
    caseId,
    caseData,
    caseContextResolved,
    reclassifying,
    caseDataRef,
    optionsRef,
    userChangedClassificationRef,
    onRestoreSelection: restoreSelection,
    resolveSelectionFor,
  });

  const reasonInvalid = isReclassificationReasonInvalid(reclassificationReason);

  /** Tras error al cargar grupo, el siguiente `get` fuerza caché HTTP (`__kaceForceRefresh`). */
  const lastGroupHttpFailedRef = useRef(false);

  const loadClassifications = useCallback(
    async ({ isCurrent } = {}) => {
      setHasRequestedOptions(true);
      setClassificationsLoading(true);
      /*
       * El catálogo que se pide NO es el mismo con el flag de reclasificación puesto que sin él:
       * desbloqueado se pide el árbol completo del grupo, bloqueado el recortado. El flag del
       * tenant puede resolver DESPUÉS de haber lanzado la petición, y entonces la respuesta en
       * vuelo describe un catálogo que ya no es el que corresponde.
       *
       * Quién está obsoleto lo dice `isCurrent`, el contador de generación de
       * `useLazySelectOptions` —el efecto que depende del flag hace `resetCache()` en cada
       * cambio—, no una comparación contra el valor que tenía el flag al arrancar: esa vuelve a
       * coincidir en un doble cambio (A→B→A) y trata la carga más vieja como vigente.
       */
      const unlockedAtStart = reclassifyUnlockedRef.current;
      const isStaleLoad = () => isLoadStale(isCurrent);
      try {
        const storedCase = storeService.get('cases.case_data');
        const refCase = caseDataRef.current;
        const caseRow =
          storedCase &&
          refCase &&
          typeof storedCase === 'object' &&
          typeof refCase === 'object'
            ? { ...storedCase, ...refCase }
            : refCase && typeof refCase === 'object'
              ? refCase
              : storedCase && typeof storedCase === 'object'
                ? storedCase
                : null;

        // Reclasificando, el atajo embebido sobra: devuelve un solo nodo —la clasificación actual—
        // y es justo lo que hay que poder cambiar.
        const fromEmbedded = unlockedAtStart
          ? null
          : tryBuildClassificationOptionsFromEmbeddedCase(caseRow);
        if (fromEmbedded) {
          lastGroupHttpFailedRef.current = false;
          optionsRef.current = fromEmbedded;
          setOptions(fromEmbedded);
          return;
        }

        // Directo al servicio y no por el magic getter de `BaseService`, que serviría el catálogo
        // recortado ya cacheado en el store. El grupo es el del caso: contra él valida el backend.
        const groupOptions = unlockedAtStart
          ? await classificationsService.fetchGroupClassification({
              fullCatalog: true,
              groupId: caseRow?.grupo_id ?? null,
              forceHttpRefresh: lastGroupHttpFailedRef.current,
            })
          : await classificationsService.get(
              'classifications.group_classification',
              {
                forceHttpRefresh: lastGroupHttpFailedRef.current,
              }
            );
        if (isStaleLoad()) return;
        lastGroupHttpFailedRef.current = false;
        let classifications = Array.isArray(groupOptions)
          ? [...groupOptions]
          : [];

        const currentId = caseDataRef.current?.clasificacion_id;
        if (currentId) {
          const exists = classifications.some((c) => {
            const id = c.id ?? c.clasificacion_id ?? c.classification_id;
            return id != null && String(id) === String(currentId);
          });

          if (!exists) {
            try {
              const classification =
                await classificationsService.fetchClassification({
                  id: currentId,
                });
              if (classification) classifications.push(classification);
            } catch (err) {
              console.error(
                '[Classifications] No se pudo obtener la clasificación del caso actual:',
                err?.message ?? err
              );
            }
          }
        }

        if (isStaleLoad()) return;
        const built = ClassificationsCreateOptions(classifications);
        optionsRef.current = built;
        setOptions(built);
      } catch (err) {
        if (isStaleLoad()) throw err;
        lastGroupHttpFailedRef.current = true;
        console.error(
          '[Classifications] Error al obtener clasificaciones',
          err
        );
        optionsRef.current = [];
        setOptions([]);
        throw err;
      } finally {
        // Una carga abandonada no apaga el spinner: la que la reemplaza sigue corriendo.
        if (!isStaleLoad()) setClassificationsLoading(false);
      }
    },
    [classificationsService]
  );

  const { ensureLoaded, resetCache, onExternalDataEvent } =
    useLazySelectOptions({
      refetchOnEveryOpen,
      loadFn: loadClassifications,
    });

  const handleSelectClassification = useCallback(
    (level, selectedValue) => {
      if (isCreateCase && lockedLevelCountRef.current > 0) {
        const levelNum = parseInt(level.replace('nivel', ''), 10);
        if (
          Number.isFinite(levelNum) &&
          levelNum <= lockedLevelCountRef.current
        ) {
          return;
        }
      }

      if (reclassifyUnlockedRef.current) {
        userChangedClassificationRef.current = true;
        // Cambiar de rama invalida el destino anterior entero: motivo, confirmación y precheck.
        abandonCurrentTarget();
      }

      setSelectedOptions((prev) => {
        const newSelectedOptions = { ...prev, [level]: selectedValue };
        Object.keys(newSelectedOptions)
          .filter(
            (key) =>
              parseInt(key.replace('nivel', ''), 10) >
              parseInt(level.replace('nivel', ''), 10)
          )
          .forEach((key) => {
            delete newSelectedOptions[key];
          });
        persistClassificationLabels(newSelectedOptions, optionsRef.current);
        return newSelectedOptions;
      });
    },
    [isCreateCase, persistClassificationLabels, abandonCurrentTarget]
  );

  const applyValidatedDefaults = useCallback(
    (validated, tree) => {
      setSelectedOptions(validated);
      setLockedLevelCount(consecutiveLockedLevelCount(validated));
      persistClassificationLabels(validated, tree);
    },
    [persistClassificationLabels]
  );

  const flushPendingDefaults = useCallback(
    (treeArg) => {
      const tree =
        Array.isArray(treeArg) && treeArg.length ? treeArg : optionsRef.current;
      if (!Array.isArray(tree) || !tree.length) return;
      if (!initSessionRef.current?.pendingDefaults) return;
      const result = consumePendingDefaults(
        initSessionRef.current,
        tree,
        validateSelectionAgainstTree
      );
      initSessionRef.current = result.session;
      if (result.kind === 'apply') {
        applyValidatedDefaults(result.validated, tree);
      }
    },
    [applyValidatedDefaults]
  );

  const loadOptionsAndFlushPending = useCallback(() => {
    const loaded = ensureLoaded();
    if (loaded != null && typeof loaded.then === 'function') {
      void loaded.then(flushPendingDefaults).catch(() => {});
      return;
    }
    flushPendingDefaults();
  }, [ensureLoaded, flushPendingDefaults]);

  const readAuthReady = useCallback(
    () => isClassificationsAuthReady((path) => storeService.get(path)),
    []
  );

  const runInitScriptOnce = useCallback(() => {
    const code = component?.classificationsInitCode;
    const session = initSessionRef.current;

    if (isEditCaseRef.current) {
      setLockedLevelCount(0);
      setLevelLabelOverrides({});
      return;
    }

    if (!caseContextResolvedRef.current) {
      return;
    }

    if (!code || typeof code !== 'string' || !code.trim()) {
      setLockedLevelCount(0);
      setLevelLabelOverrides({});
      return;
    }

    if (
      !shouldEvaluateUserScript(session, {
        caseContextResolved: caseContextResolvedRef.current,
        isEditCase: isEditCaseRef.current,
        authReady: readAuthReady(),
        code,
      })
    ) {
      return;
    }

    setLockedLevelCount(0);
    setLevelLabelOverrides({});

    let engine;
    try {
      engine = KaceEngine();
    } catch {
      engine = null;
    }

    const setDefaultSelections = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      const tree = optionsRef.current;
      const result = queueOrResolveDefaults(
        initSessionRef.current,
        obj,
        tree,
        validateSelectionAgainstTree
      );
      initSessionRef.current = result.session;
      if (result.kind === 'queue') {
        setHasRequestedOptions(true);
        loadOptionsAndFlushPending();
        return;
      }
      if (result.kind === 'apply') {
        applyValidatedDefaults(result.validated, tree);
      }
    };

    const setLevelLabels = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      setLevelLabelOverrides((prev) => ({ ...prev, ...obj }));
    };

    const plainStore = storeService.store ?? null;

    try {
      evaluateKace(code, {
        kaceEngine: engine,
        apiService: engine?.getService?.('apiService'),
        url_api: storeService.get('config.api_url'),
        data: dataRef.current,
        root: rootRef.current,
        options: optionsRef.current,
        caseData: caseDataRef.current,
        isEditCase: isEditCaseRef.current,
        store: plainStore,
        storeService,
        setDefaultSelections,
        setDefaultSelection: setDefaultSelections,
        setLevelLabels,
      });
    } catch (err) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('[Classifications] classificationsInitCode error:', err);
      }
    } finally {
      initSessionRef.current = markScriptRan(initSessionRef.current);
    }
  }, [
    component?.classificationsInitCode,
    loadOptionsAndFlushPending,
    applyValidatedDefaults,
    readAuthReady,
  ]);

  useEffect(() => {
    if (!caseContextResolved) return;
    if (isEditCase) return;
    runInitScriptOnce();
  }, [caseContextResolved, isEditCase, runInitScriptOnce]);

  useEffect(() => {
    if (!options?.length) return;
    flushPendingDefaults(options);
  }, [options, flushPendingDefaults]);

  useEffect(() => {
    if (!options?.length) {
      if (!Object.keys(selectedOptions).length) {
        storeService.set('classifications.selected_classifications', null);
      }
      return;
    }
    persistClassificationLabels(selectedOptions, options);
  }, [selectedOptions, options, persistClassificationLabels]);

  /**
   * `cases.case_id` puede resolver DESPUÉS del primer montaje: lo escribe el handshake
   * `kaceAuthData` (`Auth.jsx`), que es asíncrono. Sin `cases.case_id` en el store,
   * `caseService.get('cases.case_data')` (servicio) rechaza siempre con `No case id` —tanto en la
   * carrera de montaje como en la creación genuina de un caso nuevo, que nunca tiene `case_id`—,
   * así que se evita esa llamada condenada a fallar en vez de lanzarla y capturar el error: sin
   * esto, CADA apertura de un formulario de caso (la carrera es la norma, no la excepción) dejaba
   * un `console.error` en la consola de producción. `caseContextResolved` se asienta igual que
   * antes, tratando la falta de dato como creación hasta que el reintento de `kaceAuthData` (el
   * efecto de abajo) traiga el caso real si el `case_id` resultó ser una carrera y no una
   * creación.
   */
  const fetchCaseData = useCallback(async () => {
    if (!storeService.get('cases.case_id')) {
      setCaseContextResolved(true);
      return;
    }
    try {
      const fetched = await caseService.get('cases.case_data');
      const storeId = storeService.get('cases.case_id');
      if (
        storeId &&
        fetched?.id != null &&
        String(fetched.id) !== String(storeId)
      ) {
        return;
      }
      /** Caso "con datos de edición" (caso con id o ya clasificado); el bloqueo del desplegable usa solo `clasificacion_id`. */
      const isEdit = Boolean(fetched?.clasificacion_id || storeId);
      setIsEditCase(isEdit);

      if (fetched?.parent) {
        storeService.set('cases.parent_id', fetched.parent.id ?? null);
      } else {
        storeService.set('cases.parent_id', null);
      }

      setCaseData(fetched);
    } catch (err) {
      console.error(
        '[Classifications] No se pudo obtener el caso:',
        err?.message ?? err
      );
    } finally {
      setCaseContextResolved(true);
    }
  }, [caseService, caseId]);

  useEffect(() => {
    void fetchCaseData();
  }, [fetchCaseData]);

  /*
   * `onEvent` es `this.on.bind(this)` y el wrapper Formio lo re-crea en cada
   * `renderReactComponent()` —que corre también en cada `setDisabled()`—, así que este efecto
   * vuelve a suscribir. `eventemitter3` no deduplica: sin dar de baja los handlers anteriores,
   * cada re-render deja otro listener vivo sobre el mismo emisor.
   */
  useEffect(() => {
    if (typeof onEvent !== 'function') return undefined;
    const onAuth = () => {
      onExternalDataEvent();
      runInitScriptOnce();
      if (initSessionRef.current?.pendingDefaults) {
        loadOptionsAndFlushPending();
      }
      const storeId = storeService.get('cases.case_id');
      const loadedId = caseDataRef.current?.id;
      if (
        storeId &&
        (caseDataRef.current == null || String(loadedId) !== String(storeId))
      ) {
        void fetchCaseData();
      }
    };
    const onRedraw = () => {
      onExternalDataEvent();
    };
    onEvent('kaceAuthData', onAuth);
    onEvent('redraw', onRedraw);
    onEvent('resetForm', resetCache);
    return () => {
      offEvent?.('kaceAuthData', onAuth);
      offEvent?.('redraw', onRedraw);
      offEvent?.('resetForm', resetCache);
    };
  }, [
    onEvent,
    offEvent,
    onExternalDataEvent,
    resetCache,
    loadOptionsAndFlushPending,
    runInitScriptOnce,
    fetchCaseData,
  ]);

  useEffect(() => {
    if (!isCreateCase) {
      setLockedLevelCount(0);
    }
  }, [isCreateCase]);

  const hasCaseData = caseData != null;
  const caseClasificacionId = caseData?.clasificacion_id;
  useEffect(() => {
    if (!hasCaseData) {
      return;
    }
    if (caseClasificacionId) {
      resetCache();
      void ensureLoaded();
    } else {
      setClassificationsLoading(false);
    }
    // `reclassifyUnlocked` entra como dependencia porque el flag del tenant puede resolver después
    // del montaje: al pasar a true hay que recargar, o el árbol se queda en el único nodo embebido.
  }, [
    hasCaseData,
    caseId,
    caseClasificacionId,
    reclassifyUnlocked,
    ensureLoaded,
    resetCache,
  ]);

  const caseHasClassification = Boolean(caseData?.clasificacion_id);

  const handleFirstLevelInteraction = useCallback(() => {
    if (caseData?.clasificacion_id && !reclassifyUnlocked) {
      return;
    }
    setHasRequestedOptions(true);
    void ensureLoaded();
  }, [caseData?.clasificacion_id, reclassifyUnlocked, ensureLoaded]);

  /** Hoja del árbol elegida ahora mismo, o `null` si la selección aún está a medias. */
  const selectedLeaf = useMemo(() => {
    if (!options?.length) return null;
    const node = getDeepestSelectedTreeNode(options, selectedOptions);
    if (!node) return null;
    return node.options?.length ? null : node;
  }, [options, selectedOptions]);

  const leafSelectionAction = resolveLeafSelectionAction({
    leafClasificacionId: selectedLeaf?.clasificacion_id,
    caseClasificacionId: caseData?.clasificacion_id,
    reclassifyUnlocked,
    confirmedClasificacionId,
  });

  /** Mientras exista, el formulario NO se ha tocado: el asesor todavía no confirmó. */
  const pendingReclassification =
    leafSelectionAction === SELECTION_CONFIRM ? selectedLeaf : null;

  useEffect(() => {
    if (!options?.length) return;

    const selectedOpt = selectedLeaf;

    if (selectedOpt) {
      if (leafSelectionAction === SELECTION_CONFIRM) return;

      const newClasificacionId = selectedOpt.clasificacion_id;
      const newFlujoId = selectedOpt.flujo_id;

      if (
        newClasificacionId != null &&
        newClasificacionId !== '' &&
        newClasificacionId !== undefined
      ) {
        setLastValidClasificacionId(newClasificacionId);

        if (root) {
          if (!root.data) root.data = {};
          root.data.clasificacion_id = newClasificacionId;
          if (!root.submission) root.submission = {};
          if (!root.submission.data) root.submission.data = {};
          if (!root.submission.data.case_data)
            root.submission.data.case_data = {};
          if (!root.submission.data.case_data.case)
            root.submission.data.case_data.case = {};
          root.submission.data.case_data.case.clasificacion_id =
            newClasificacionId;
          root.emit?.('change', {
            changed: {
              component: { key: 'classification_id' },
              value: newClasificacionId,
            },
          });
        }
        handleChange('clasificacion_id', newClasificacionId);
        storeService.set(
          'classifications.current_classification',
          newClasificacionId
        );
      }

      if (newFlujoId != null && newFlujoId !== '' && newFlujoId !== undefined) {
        handleChange('flujo_id', newFlujoId);
        storeService.set('aux_case.hasSchema', false);
      }
    } else if (lastValidClasificacionId) {
      handleChange('clasificacion_id', null);
      handleChange('flujo_id', null);
      setLastValidClasificacionId(null);
      storeService.set('classifications.current_classification', null);
    }
  }, [
    selectedLeaf,
    leafSelectionAction,
    options,
    handleChange,
    root,
    lastValidClasificacionId,
  ]);

  /** Un caso distinto (o recargado tras guardar) vuelve a mandar sobre la selección. */
  useEffect(() => {
    userChangedClassificationRef.current = false;
  }, [caseId, caseData?.clasificacion_id]);

  useEffect(() => {
    if (!options?.length) return;
    if (!caseData?.clasificacion_id) return;
    // Sin esto el efecto revierte la reclasificación en cuanto el asesor elige otra rama:
    // `verifyCurrentSelection()` deja de coincidir con el caso y re-deriva la selección original.
    if (userChangedClassificationRef.current) return;

    /**
     * Tras confirmar, el formulario destino remonta este componente. La sesión viva ya
     * hidrata `confirmedClasificacionId`; si se re-sincronizara contra el caso, volveríamos
     * a la clasificación original y el asesor perdería el destino que acaba de confirmar.
     */
    const syncClasificacionId =
      confirmedClasificacionId ?? caseData.clasificacion_id;

    const verifyCurrentSelection = () => {
      if (Object.keys(selectedOptions).length === 0) return false;

      const findDeepestOption = (opts, selected, nivelIndex = 1) => {
        const nivel = `nivel${nivelIndex}`;
        const selectedValue = selected[nivel];

        if (!selectedValue) return null;

        const found = opts.find((opt) => opt.value === selectedValue);
        if (!found) return null;

        const foundClassificationId =
          found.clasificacion_id ?? found.classification_id;
        const targetClassificationId = syncClasificacionId;
        if (
          foundClassificationId != null &&
          targetClassificationId != null &&
          String(foundClassificationId) === String(targetClassificationId)
        ) {
          return found;
        }

        if (found.options && found.options.length > 0) {
          const nextNivel = `nivel${nivelIndex + 1}`;
          if (selected[nextNivel]) {
            const nestedFound = findDeepestOption(
              found.options,
              selected,
              nivelIndex + 1
            );
            if (nestedFound) return nestedFound;
          }
        }

        return null;
      };

      const deepestOption = findDeepestOption(options, selectedOptions);
      return deepestOption !== null;
    };

    if (!verifyCurrentSelection()) {
      const nivelPath = findNivelPath(options, syncClasificacionId);
      if (nivelPath && nivelPath.length > 0) {
        const initialSelected = nivelPathToSelection(nivelPath);
        if (Object.keys(initialSelected).length > 0) {
          const isDifferent =
            Object.keys(initialSelected).length !==
              Object.keys(selectedOptions).length ||
            Object.keys(initialSelected).some(
              (key) => initialSelected[key] !== selectedOptions[key]
            );
          if (isDifferent) {
            setSelectedOptions(initialSelected);
            persistClassificationLabels(initialSelected, options);
          }
        }
      }
    }

    if (confirmedClasificacionId != null) {
      userChangedClassificationRef.current = true;
    }
  }, [
    options,
    caseData?.clasificacion_id,
    confirmedClasificacionId,
    selectedOptions,
    persistClassificationLabels,
  ]);

  const effectiveLockedLevels = isCreateCase ? lockedLevelCount : 0;

  if (classificationsLoading && caseData?.clasificacion_id) {
    return (
      <div className="card shadow-sm">
        <div className="card-body p-4">
          <h1 className="h3 font-weight-bold mb-2">Clasificaciones</h1>
          <p className="text-muted mb-4">
            Seleccione un nivel de clasificación para ver los estados
            disponibles
          </p>

          <div className="overflow-auto" style={{ height: '500px' }}>
            <div
              className="d-flex justify-content-center align-items-center"
              style={{ height: '100%' }}
            >
              <div className="text-primary spinner-border" role="status">
                <span className="sr-only">Cargando...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const deferredCreateEmptyFailed = Boolean(
    !caseData?.clasificacion_id &&
    hasRequestedOptions &&
    !classificationsLoading &&
    options.length === 0
  );

  return (
    <div className={`card shadow-sm ${disabledClassName}`}>
      <div className="card-body p-4">
        <h1 className="h3 font-weight-bold mb-2">Clasificaciones</h1>
        <p className="text-muted mb-4">
          Seleccione un nivel de clasificación para ver los estados disponibles.
        </p>

        <div
          className="overflow-auto classifications-levels"
          style={{ minHeight: '3rem' }}
        >
          {(!caseData?.clasificacion_id || (options && options.length > 0)) && (
            <ClassificationsOptions
              classifications={levelKeys}
              handleSelect={handleSelectClassification}
              isLoading={Boolean(
                !caseData?.clasificacion_id &&
                hasRequestedOptions &&
                classificationsLoading &&
                !options.length
              )}
              isDeferredEmptyFailed={deferredCreateEmptyFailed}
              onNivel1EmptyActivate={handleFirstLevelInteraction}
              options={options}
              selectedOptions={selectedOptions}
              disabled={
                isDisabled || (caseHasClassification && !reclassifyUnlocked)
              }
              lockedLevelCount={effectiveLockedLevels}
            />
          )}

          {options.length === 0 &&
            hasRequestedOptions &&
            !classificationsLoading &&
            !deferredCreateEmptyFailed && (
              <div className="text-center text-muted py-5">
                <p>No se encontraron clasificaciones disponibles.</p>
              </div>
            )}
        </div>

        {reclassifying && (
          <div className="classifications-reclassification mt-4">
            <h2 className="h5 font-weight-bold mb-1">Reclasificación</h2>
            <p className="text-muted small mb-3">
              El caso pasará a la clasificación seleccionada y se cargará el
              formulario de su flujo.
            </p>

            <label
              className="font-weight-bold mb-1 d-block"
              htmlFor="reclassification-reason"
            >
              Motivo
            </label>
            <textarea
              id="reclassification-reason"
              className="form-control"
              rows={3}
              maxLength={RECLASSIFICATION_REASON_MAX_LENGTH}
              value={reclassificationReason}
              disabled={isDisabled}
              required
              onChange={(event) =>
                setReclassificationReason(event.target.value)
              }
              onBlur={(event) => persistReason(event.target.value)}
            />
            <div className="d-flex justify-content-between small mt-1">
              <span className="text-danger">
                {reasonInvalid
                  ? 'El motivo de la reclasificación debe tener al menos 3 caracteres.'
                  : ''}
              </span>
              <span className="text-muted">
                {reclassificationReason.length}/
                {RECLASSIFICATION_REASON_MAX_LENGTH}
              </span>
            </div>
          </div>
        )}
      </div>

      {pendingReclassification && (
        <ReclassificationConfirmDialog
          classificationLabel={pendingReclassification.label}
          isChecking={isCheckingPrecheck}
          blockerMessage={precheckBlockerMessage}
          onConfirm={() => confirmReclassification(pendingReclassification)}
          onCancel={cancelReclassification}
        />
      )}
    </div>
  );
};
