import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebouncedStableTerm } from '#plugins/kace/hooks/useDebouncedStableTerm.js';
import { useKaceScriptSelectLoad } from '#plugins/kace/hooks/useKaceScriptSelectLoad.js';
import {
  KACE_SELECT_DEFAULT_PAGE_SIZE,
  KACE_SELECT_REMOTE_SEARCH_DEBOUNCE_MS,
} from '#plugins/kace/shared/kaceSelect.constants.js';
import { ensureSelectedOption } from '#plugins/kace/shared/EnsureSelectedOption.js';
import { isKaceSelectScrollNearBottom } from '#plugins/kace/utils/kaceSelectScrollNearBottom.js';

export function useBulkActionModalSelect({
  fieldKey,
  options,
  value,
  showWhenCode,
  evaluateShowWhen,
  setSelectOptions,
  pageSize = KACE_SELECT_DEFAULT_PAGE_SIZE,
  dependencySignature,
  disabled,
  localSearchOnly = false,
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('legacy');
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const segmentedScrollInFlightRef = useRef(false);
  const lastDependencySignatureRef = useRef(dependencySignature);

  const showWhenScript = String(showWhenCode ?? '').trim();
  const hasShowWhenCode = Boolean(showWhenScript);
  const remoteSearchEnabled =
    hasShowWhenCode && open && localSearchOnly !== true;
  const stableRemoteTerm = useDebouncedStableTerm(
    searchTerm,
    KACE_SELECT_REMOTE_SEARCH_DEBOUNCE_MS,
    remoteSearchEnabled
  );

  const baseCatalog = useMemo(
    () => (Array.isArray(options) ? options : []),
    [options]
  );

  const displayCatalog = useMemo(
    () =>
      ensureSelectedOption(baseCatalog, value, {
        createTempOption: (entryValue) => ({
          label: String(entryValue),
          value: String(entryValue),
        }),
      }),
    [baseCatalog, value]
  );

  const filteredOptions = useMemo(() => {
    if (mode === 'segmented' && !localSearchOnly) {
      return displayCatalog;
    }
    const term = String(searchTerm ?? '')
      .trim()
      .toLowerCase();
    if (!term) {
      return displayCatalog;
    }
    return displayCatalog.filter((option) => {
      const label = String(option?.label ?? '').toLowerCase();
      const optionValue = String(option?.value ?? '').toLowerCase();
      return label.includes(term) || optionValue.includes(term);
    });
  }, [displayCatalog, localSearchOnly, mode, searchTerm]);

  const getContext = useCallback(
    () => ({
      page: pageRef.current,
      remoteTerm: localSearchOnly ? '' : stableRemoteTerm,
    }),
    [localSearchOnly, stableRemoteTerm]
  );

  const applyOptions = useCallback(
    (items) => {
      setSelectOptions(fieldKey, items, { replace: true });
    },
    [fieldKey, setSelectOptions]
  );

  const handleInfiniteStall = useCallback(() => {
    hasMoreRef.current = false;
  }, []);

  const { load: loadSegmented, invalidateCache } = useKaceScriptSelectLoad({
    componentKey: `bulk-modal-${String(fieldKey ?? '')}`,
    refetchOnEveryOpen: false,
    segmented: hasShowWhenCode,
    dependencySignature,
    getContext,
    mergeOptionsForDisplay: (items) =>
      ensureSelectedOption(items, value, {
        createTempOption: (entryValue) => ({
          label: String(entryValue),
          value: String(entryValue),
        }),
      }),
    applyOptions,
    onInfiniteStall: handleInfiniteStall,
  });

  const runLoadPass = useCallback(async () => {
    if (!hasShowWhenCode || typeof evaluateShowWhen !== 'function') {
      return;
    }
    setLoading(true);
    try {
      await loadSegmented(
        async ({ setOptions, kaceSelectPage, kaceRemoteSearchTerm }) => {
          await evaluateShowWhen({
            loadPass: true,
            kaceSelectPage,
            kaceRemoteSearchTerm,
            kaceSelectPageSize: pageSize,
            onSetSelectOptions: (nextOptions, meta) => {
              const normalized = Array.isArray(nextOptions) ? nextOptions : [];
              const append =
                meta?.append === true ||
                (kaceSelectPage > 1 && meta?.replace !== true);
              const replace = meta?.replace === true || !append;
              if (append || replace) {
                setMode('segmented');
              }
              hasMoreRef.current = normalized.length >= pageSize;
              if (append) {
                setOptions(normalized, { append: true });
                return;
              }
              setOptions(normalized, { replace: true });
            },
          });
        }
      );
    } catch (err) {
      console.warn(
        '[useBulkActionModalSelect] showWhen loadPass error:',
        fieldKey,
        err?.message ?? err
      );
      hasMoreRef.current = false;
    } finally {
      setLoading(false);
    }
  }, [hasShowWhenCode, evaluateShowWhen, loadSegmented, pageSize, fieldKey]);

  const runLoadPassRef = useRef(runLoadPass);
  runLoadPassRef.current = runLoadPass;

  const openDropdown = useCallback(() => {
    if (disabled) {
      return;
    }
    setOpen(true);
  }, [disabled]);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setSearchTerm('');
    pageRef.current = 1;
    hasMoreRef.current = true;
  }, []);

  const onDropdownScroll = useCallback(
    (event) => {
      if (
        mode !== 'segmented' ||
        loading ||
        segmentedScrollInFlightRef.current ||
        !hasMoreRef.current
      ) {
        return;
      }
      if (!isKaceSelectScrollNearBottom(event.currentTarget)) {
        return;
      }
      segmentedScrollInFlightRef.current = true;
      pageRef.current += 1;
      void runLoadPass().finally(() => {
        segmentedScrollInFlightRef.current = false;
      });
    },
    [loading, mode, runLoadPass]
  );

  const resetForDependencyChange = useCallback(() => {
    setSearchTerm('');
    setOpen(false);
    setLoading(false);
    setMode('legacy');
    pageRef.current = 1;
    hasMoreRef.current = true;
    segmentedScrollInFlightRef.current = false;
    invalidateCache();
  }, [invalidateCache]);

  // Guarda el último término remoto ya cargado (en vez de un contador de
  // "saltar la primera corrida"): así, si `stableRemoteTerm` ya está resuelto
  // en el mismo render que `open`, el efecto de "open" lo consume y el efecto
  // de "term change" lo detecta como ya cargado (no duplica). Si en cambio
  // cambia después, se detecta como distinto y sí dispara la carga.
  const lastLoadedRemoteTermRef = useRef(null);

  useEffect(() => {
    if (!open || !hasShowWhenCode) {
      lastLoadedRemoteTermRef.current = null;
      return;
    }
    pageRef.current = 1;
    hasMoreRef.current = true;
    lastLoadedRemoteTermRef.current = localSearchOnly ? '' : stableRemoteTerm;
    void runLoadPassRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasShowWhenCode]);

  useEffect(() => {
    if (!open || !hasShowWhenCode || localSearchOnly) {
      return;
    }
    if (lastLoadedRemoteTermRef.current === stableRemoteTerm) {
      return;
    }
    lastLoadedRemoteTermRef.current = stableRemoteTerm;
    pageRef.current = 1;
    hasMoreRef.current = true;
    void runLoadPassRef.current();
  }, [localSearchOnly, open, hasShowWhenCode, stableRemoteTerm]);

  useEffect(() => {
    if (lastDependencySignatureRef.current === dependencySignature) {
      return;
    }
    lastDependencySignatureRef.current = dependencySignature;
    resetForDependencyChange();
  }, [dependencySignature, resetForDependencyChange]);

  return {
    open,
    openDropdown,
    closeDropdown,
    searchTerm,
    setSearchTerm,
    loading,
    mode,
    filteredOptions,
    onDropdownScroll,
    resetForDependencyChange,
  };
}
