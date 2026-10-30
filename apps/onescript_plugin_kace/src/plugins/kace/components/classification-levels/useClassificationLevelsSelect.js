import { KaceEngine } from '#plugins/kace/KaceEngine.js';
import { evaluateKace } from '#plugins/kace/shared/evaluateKace.js';
import { useLazySelectOptions } from '#plugins/kace/hooks/useLazySelectOptions.hook.js';
import { getCurrentOptions } from '#plugins/kace/shared/ClassificationsGetCurrentOptions.js';
import { storeService } from '#plugins/kace/services/storeService.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildLevelKeys,
  buildLevelLabelsForOutput,
  buildOptionsFromClassifications,
  classificationTreeSelectDepth,
  countStoreClassificationLevels,
  readLevelValuesFromData,
  resolveSelectionFromData,
  validateSelectionAgainstTree,
} from './classificationLevelsUtils.js';

const LEVEL_KEYS = ['nivel1', 'nivel2', 'nivel3', 'nivel4', 'nivel5'];

function buildLevelsSignature(source, componentKey) {
  return LEVEL_KEYS.map((key) =>
    String(readLevelValuesFromData(source, componentKey)[key] ?? '')
  ).join('\u0001');
}

function hasStoredLevels(source, componentKey) {
  return Object.keys(readLevelValuesFromData(source, componentKey)).length > 0;
}

export function useClassificationLevelsSelect({
  data = {},
  component = {},
  onEvent,
  offEvent,
  onLevelsChange,
  root,
}) {
  const refetchOnEveryOpen = Boolean(component?.refetchOnEveryOpen);
  const componentKey =
    typeof component?.key === 'string' && component.key.trim()
      ? component.key.trim()
      : 'classification_levels';
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

  const [selectedOptions, setSelectedOptions] = useState(() =>
    readLevelValuesFromData(data, componentKey)
  );
  const [classificationsLoading, setClassificationsLoading] = useState(false);
  const [options, setOptions] = useState([]);
  const [hasRequestedOptions, setHasRequestedOptions] = useState(false);
  const [optionsLoadFinished, setOptionsLoadFinished] = useState(false);
  const [levelLabelOverrides, setLevelLabelOverrides] = useState({});
  const [lockedLevelCount, setLockedLevelCount] = useState(0);

  const optionsRef = useRef(options);
  optionsRef.current = options;
  const dataRef = useRef(data);
  dataRef.current = data;
  const rootRef = useRef(root);
  rootRef.current = root;
  const selectedOptionsRef = useRef(selectedOptions);
  selectedOptionsRef.current = selectedOptions;
  const lockedLevelCountRef = useRef(lockedLevelCount);
  lockedLevelCountRef.current = lockedLevelCount;
  const onLevelsChangeRef = useRef(onLevelsChange);
  onLevelsChangeRef.current = onLevelsChange;
  const userChangedSelectionRef = useRef(false);
  const dataSignatureRef = useRef('');
  const lastEmittedSignatureRef = useRef('');

  const kaceEngine = KaceEngine();
  const classificationsService = kaceEngine.getService('classifications');
  const lastGroupHttpFailedRef = useRef(false);

  const treeDepth = useMemo(
    () =>
      Array.isArray(options) && options.length
        ? classificationTreeSelectDepth(options)
        : 0,
    [options]
  );

  const levelKeys = useMemo(() => {
    const hasTree = Array.isArray(options) && options.length > 0;
    const N = Math.max(nStore, treeDepth, hasTree ? 1 : 0, 5);
    if (N <= 0) return {};
    return buildLevelKeys(storeLevelKeys, N, levelLabelOverrides);
  }, [nStore, treeDepth, options, storeLevelKeys, levelLabelOverrides]);

  const loadClassifications = useCallback(
    async ({ isCurrent } = {}) => {
      if (isCurrent && !isCurrent()) return;
      setHasRequestedOptions(true);
      setClassificationsLoading(true);
      setOptionsLoadFinished(false);
      try {
        const groupOptions =
          await classificationsService.fetchGroupClassification({
            fullCatalog: true,
            forceHttpRefresh: lastGroupHttpFailedRef.current,
          });
        if (isCurrent && !isCurrent()) return;
        lastGroupHttpFailedRef.current = false;
        const classifications = Array.isArray(groupOptions)
          ? [...groupOptions]
          : [];
        setOptions(buildOptionsFromClassifications(classifications));
      } catch (err) {
        if (isCurrent && !isCurrent()) return;
        lastGroupHttpFailedRef.current = true;
        console.error(
          '[ClassificationLevels] Error al obtener clasificaciones',
          err?.message ?? err
        );
        setOptions([]);
        throw err;
      } finally {
        if (isCurrent && !isCurrent()) return;
        setClassificationsLoading(false);
        setOptionsLoadFinished(true);
      }
    },
    [classificationsService]
  );

  const { ensureLoaded, resetCache, onExternalDataEvent } =
    useLazySelectOptions({
      refetchOnEveryOpen,
      loadFn: loadClassifications,
    });

  const syncSelectionFromData = useCallback(
    (sourceData, tree = optionsRef.current, force = false) => {
      const fromData = readLevelValuesFromData(sourceData, componentKey);
      if (!Object.keys(fromData).length) return;

      if (!force && userChangedSelectionRef.current) {
        const incomingSignature = buildLevelsSignature(fromData, componentKey);
        const emittedSignature = lastEmittedSignatureRef.current;
        if (
          emittedSignature &&
          (incomingSignature === emittedSignature ||
            incomingSignature ===
              buildLevelsSignature(
                buildLevelLabelsForOutput(tree, selectedOptionsRef.current),
                componentKey
              ))
        ) {
          return;
        }
      }

      setSelectedOptions((prev) => {
        const next =
          Array.isArray(tree) && tree.length
            ? resolveSelectionFromData(tree, sourceData, componentKey)
            : fromData;
        if (!Object.keys(next).length) return prev;
        const same =
          Object.keys(next).length === Object.keys(prev).length &&
          Object.keys(next).every((k) => next[k] === prev[k]);
        return same ? prev : next;
      });
    },
    [componentKey]
  );

  const requestOptionsLoad = useCallback(() => {
    if (optionsRef.current?.length && !refetchOnEveryOpen) {
      setHasRequestedOptions(true);
      setOptionsLoadFinished(true);
      return;
    }
    setHasRequestedOptions(true);
    void ensureLoaded();
  }, [ensureLoaded, refetchOnEveryOpen]);

  const ensureOptionsForCurrentData = useCallback(() => {
    if (optionsRef.current?.length && !refetchOnEveryOpen) return;
    if (classificationsLoading) return;
    requestOptionsLoad();
  }, [classificationsLoading, refetchOnEveryOpen, requestOptionsLoad]);

  useEffect(() => {
    const signature = buildLevelsSignature(data, componentKey);
    const signatureChanged = signature !== dataSignatureRef.current;
    if (signatureChanged) {
      dataSignatureRef.current = signature;
      if (
        hasStoredLevels(data, componentKey) &&
        !userChangedSelectionRef.current
      ) {
        syncSelectionFromData(data, optionsRef.current);
      }
    }

    if (hasStoredLevels(data, componentKey)) {
      ensureOptionsForCurrentData();
    }
  }, [data, componentKey, syncSelectionFromData, ensureOptionsForCurrentData]);

  useEffect(() => {
    if (!options?.length) return;
    if (userChangedSelectionRef.current) return;
    syncSelectionFromData(dataRef.current, options);
  }, [options, syncSelectionFromData]);

  const handleSelectClassification = useCallback((level, selectedValue) => {
    userChangedSelectionRef.current = true;

    if (lockedLevelCountRef.current > 0) {
      const levelNum = parseInt(level.replace('nivel', ''), 10);
      if (
        Number.isFinite(levelNum) &&
        levelNum <= lockedLevelCountRef.current
      ) {
        return;
      }
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
      return newSelectedOptions;
    });
  }, []);

  const runInitScript = useCallback(() => {
    const code = component?.classificationsInitCode;
    if (!code || typeof code !== 'string' || !code.trim()) {
      setLockedLevelCount(0);
      setLevelLabelOverrides({});
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
      if (!Array.isArray(tree) || tree.length === 0) {
        requestOptionsLoad();
        return;
      }
      const validated = validateSelectionAgainstTree(tree, obj);
      userChangedSelectionRef.current = true;
      setSelectedOptions(validated);
      let n = 0;
      for (let i = 1; i <= 5; i++) {
        if (validated[`nivel${i}`]) n = i;
        else break;
      }
      setLockedLevelCount(n);
    };

    const setLevelLabels = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      setLevelLabelOverrides((prev) => ({ ...prev, ...obj }));
    };

    try {
      evaluateKace(code, {
        kaceEngine: engine,
        apiService: engine?.getService?.('apiService'),
        url_api: storeService.get('config.api_url'),
        data: dataRef.current,
        root: rootRef.current,
        options: optionsRef.current,
        caseData: null,
        isEditCase: false,
        setDefaultSelections,
        setLevelLabels,
      });
    } catch (err) {
      if (typeof console !== 'undefined' && console.error) {
        console.error(
          '[ClassificationLevels] classificationsInitCode error:',
          err
        );
      }
    }
  }, [component?.classificationsInitCode, requestOptionsLoad]);

  useEffect(() => {
    const tree = optionsRef.current;
    const labels = buildLevelLabelsForOutput(tree, selectedOptions);
    if (!Object.keys(labels).length) return;

    const signature = buildLevelsSignature(labels, componentKey);

    if (!userChangedSelectionRef.current) {
      const existingData = readLevelValuesFromData(
        dataRef.current,
        componentKey
      );
      if (
        Object.keys(existingData).length &&
        buildLevelsSignature(existingData, componentKey) === signature
      ) {
        lastEmittedSignatureRef.current = signature;
        return;
      }
    }

    onLevelsChangeRef.current?.(labels);
    lastEmittedSignatureRef.current = signature;
  }, [selectedOptions, options, componentKey]);

  useEffect(() => {
    if (classificationsLoading) return;
    if (userChangedSelectionRef.current) return;
    runInitScript();
  }, [classificationsLoading, runInitScript, options]);

  useEffect(() => {
    if (typeof onEvent !== 'function') return;
    const onAuth = () => {
      userChangedSelectionRef.current = false;
      syncSelectionFromData(dataRef.current, optionsRef.current, true);
      runInitScript();
      onExternalDataEvent();
      ensureOptionsForCurrentData();
    };
    const onRedraw = () => {
      if (userChangedSelectionRef.current) return;
      syncSelectionFromData(dataRef.current, optionsRef.current, true);
      runInitScript();
      if (hasStoredLevels(dataRef.current, componentKey)) {
        ensureOptionsForCurrentData();
      }
    };
    const onResetForm = () => {
      userChangedSelectionRef.current = false;
      lastEmittedSignatureRef.current = '';
      dataSignatureRef.current = '';
      setOptionsLoadFinished(false);
      resetCache();
    };
    onEvent('kaceAuthData', onAuth);
    onEvent('redraw', onRedraw);
    onEvent('resetForm', onResetForm);
    return () => {
      offEvent?.('kaceAuthData', onAuth);
      offEvent?.('redraw', onRedraw);
      offEvent?.('resetForm', onResetForm);
    };
  }, [
    onEvent,
    offEvent,
    onExternalDataEvent,
    resetCache,
    runInitScript,
    syncSelectionFromData,
    ensureOptionsForCurrentData,
    componentKey,
  ]);

  const handleFirstLevelInteraction = useCallback(() => {
    requestOptionsLoad();
  }, [requestOptionsLoad]);

  const hasPreloadedLevels = hasStoredLevels(data, componentKey);
  const pendingOptionsLoad =
    hasRequestedOptions || (hasPreloadedLevels && !optionsLoadFinished);

  const deferredCreateEmptyFailed = Boolean(
    optionsLoadFinished &&
    hasRequestedOptions &&
    !classificationsLoading &&
    options.length === 0
  );

  const getLevelOptions = useCallback(
    (nivel) => getCurrentOptions(nivel, options, selectedOptions),
    [options, selectedOptions]
  );

  return {
    levelKeys,
    selectedOptions,
    options,
    classificationsLoading,
    hasRequestedOptions: pendingOptionsLoad,
    handleSelectClassification,
    handleFirstLevelInteraction,
    deferredCreateEmptyFailed,
    lockedLevelCount,
    getLevelOptions,
  };
}
