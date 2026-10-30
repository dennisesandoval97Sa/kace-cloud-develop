import './CustomSelect.css';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { evaluateKace } from '#plugins/kace/shared/evaluateKace.js';
import kace_data from '#plugins/kace/shared/KaceData.js';
import { KaceEngine } from '#plugins/kace/KaceEngine.js';
import { normalize } from '#plugins/kace/utils/normalize.js';
import { ensureSelectedOption } from '#plugins/kace/shared/EnsureSelectedOption.js';
import '#plugins/kace/shared/styles/kace-disabled.css';
import '#plugins/kace/shared/styles/kace-select-loader.css';
import { useLazySelectOptions } from '#plugins/kace/hooks/useLazySelectOptions.hook.js';
import { useKaceDisabled } from '#plugins/kace/hooks/useKaceDisabled.hook.js';
import { useDebouncedStableTerm } from '#plugins/kace/hooks/useDebouncedStableTerm.js';
import { useKaceScriptSelectLoad } from '#plugins/kace/hooks/useKaceScriptSelectLoad.js';
import {
  getEffectiveEvalPromise,
  wrapApiServiceForEvalLastHttpPromise,
} from '#plugins/kace/utils/wrapApiServiceForEvalLastHttpPromise.js';
import { wrapKaceApiServiceForRefetch } from '#plugins/kace/utils/wrapKaceApiServiceForRefetch.js';
import { isKaceSelectScrollNearBottom } from '#plugins/kace/utils/kaceSelectScrollNearBottom.js';
import { isSelectValueInCatalog } from '#plugins/kace/utils/selectCatalogReconcile.js';

/**
 * @typedef Props
 * @prop {{ [x: string]: unknown }} component - `this.component` properties
 * @prop {(value: any, flags?: any, source?: any) => any} updateValue - Function to update `this.value` (formio component instance) value
 * @prop {boolean} [disabled=false] - Disables interactions when Form.io sets disable
 * @prop {any} [dependencyValue] - Current value of the field this component depends on (set via `dependsOn`)
 */

/**
 * @param {Props} props
 */
export const CustomSelect = ({
  component,
  value,
  data,
  updateValue,
  onEvent,
  offEvent,
  root,
  disabled = false,
  dependencyValue,
}) => {
  const {
    disabled: isDisabled,
    readOnlyLock,
    className: disabledClassName,
  } = useKaceDisabled(disabled);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [allOptions, setAllOptions] = useState(
    /** @type {any[] | null} */ (null)
  );
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const wrapperRef = useRef(null);
  const searchInputRef = useRef(null);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const segmentedScrollInFlightRef = useRef(false);
  const remoteLoadFocusRef = useRef(false);
  const paginationFocusSuppressionRef = useRef(false);
  const openRef = useRef(false);
  const isFirstDepRender = useRef(true);
  const valueRef = useRef(value);
  const allOptionsRef = useRef(allOptions);
  const lastValueSyncKeyRef = useRef(null);
  const rawCatalogForReconcileRef = useRef([]);
  valueRef.current = value;
  allOptionsRef.current = allOptions;

  const kaceEngine = KaceEngine();
  const storeService = kaceEngine.getService('storeService');
  const apiUrl = storeService.get('config.api_url');
  const refetchOnEveryOpen = Boolean(component?.refetchOnEveryOpen);
  const infiniteScroll = Boolean(component?.infiniteScroll);
  const remoteSearch = Boolean(component?.remoteSearch);
  const pageSize =
    Number(component?.pageSize) > 0 ? Number(component?.pageSize) : 20;
  const segmented = infiniteScroll || remoteSearch;
  const dependencySignature = useMemo(() => {
    try {
      return JSON.stringify(dependencyValue ?? null);
    } catch {
      return '';
    }
  }, [dependencyValue]);

  const mergeAllOptionsWithCurrentValue = useCallback(
    (incoming) => {
      const safe = Array.isArray(incoming) ? [...incoming] : [];
      if (component?.dependsOn) {
        rawCatalogForReconcileRef.current = safe;
      }
      const v = valueRef.current;
      if (v === null || v === undefined || v === '') {
        return safe;
      }
      return ensureSelectedOption(safe, v, {
        createTempOption: (x) => ({
          label: String(x),
          value: String(x),
        }),
      });
    },
    [component?.dependsOn]
  );

  const displayOptions = useMemo(
    () => (allOptions === null ? ensureSelectedOption([], value) : allOptions),
    [allOptions, value]
  );

  const stableRemoteTerm = useDebouncedStableTerm(
    search,
    500,
    remoteSearch && open
  );

  const getContext = useCallback(
    () => ({
      page: pageRef.current,
      remoteTerm: stableRemoteTerm,
    }),
    [stableRemoteTerm]
  );

  const handleInfiniteStall = useCallback(() => {
    hasMoreRef.current = false;
  }, []);

  const { load: loadSegmented, invalidateCache: invalidateSegmentedCache } =
    useKaceScriptSelectLoad({
      componentKey: String(component?.key ?? ''),
      refetchOnEveryOpen,
      segmented,
      dependencySignature,
      getContext,
      mergeOptionsForDisplay: mergeAllOptionsWithCurrentValue,
      applyOptions: setAllOptions,
      onInfiniteStall: handleInfiniteStall,
    });

  const filteredOptions = useMemo(() => {
    try {
      if (remoteSearch && segmented) {
        return displayOptions;
      }
      const q = normalize(search);

      if (!q) {
        return displayOptions;
      }

      return displayOptions.filter((o) => {
        if (o !== null && typeof o === 'object') {
          return (
            normalize(o.label).includes(q) ||
            normalize(String(o.value ?? '')).includes(q)
          );
        }

        return normalize(String(o ?? '')).includes(q);
      });
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[CustomSelect] filteredOptions:', err);
      }

      return displayOptions;
    }
  }, [displayOptions, search, remoteSearch, segmented]);

  const handlerClear = () => {
    updateValue('');
    setSelected('');
    setSearch('');
    setAllOptions(null);
  };

  const runSegmentedEvaluate = useCallback(
    async ({
      setOptions: setOptionsFromLoad,
      kaceSelectPage,
      kaceRemoteSearchTerm,
    }) => {
      if (!component?.code) return;
      setError(null);
      try {
        const baseApi = wrapKaceApiServiceForRefetch(
          kaceEngine.getService('apiService'),
          refetchOnEveryOpen
        );
        const { lastHttp, api: apiForEval } =
          wrapApiServiceForEvalLastHttpPromise(baseApi);
        lastHttp.last = null;
        const result = evaluateKace(component.code, {
          kaceEngine,
          apiService: apiForEval,
          url_api: apiUrl,
          data,
          kace_data,
          kaceSelectPage,
          kaceRemoteSearchTerm,
          kaceSelectPageSize: pageSize,
          setOptions: (newOptions, opts) => {
            if (infiniteScroll) {
              const arr = Array.isArray(newOptions) ? newOptions : [];
              hasMoreRef.current = arr.length > 0 && arr.length >= pageSize;
            }
            setOptionsFromLoad(newOptions, opts);
          },
          setLoading,
          setError,
          handlerClear,
          setSelectedValue: setSelected,
          updateValue,
          root,
        });
        const asyncRes = getEffectiveEvalPromise(result, lastHttp);
        if (asyncRes) {
          return asyncRes.catch((e) => {
            if (typeof console !== 'undefined' && console.error) {
              console.error('[CustomSelect] segmented eval (async)', e);
            }
            throw e;
          });
        }
      } catch (e) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('[CustomSelect] segmented eval', e);
        }
        throw e;
      }
    },
    [
      component?.code,
      data,
      kaceEngine,
      apiUrl,
      root,
      refetchOnEveryOpen,
      pageSize,
      infiniteScroll,
      updateValue,
    ]
  );

  const handlerData = useCallback(() => {
    if (segmented) {
      return Promise.resolve();
    }
    if (!component?.code) return;

    setAllOptions(null);
    setError(null);
    try {
      const baseApi = wrapKaceApiServiceForRefetch(
        kaceEngine.getService('apiService'),
        refetchOnEveryOpen
      );
      const { lastHttp, api: apiForEval } =
        wrapApiServiceForEvalLastHttpPromise(baseApi);
      lastHttp.last = null;
      const result = evaluateKace(component.code, {
        kaceEngine,
        apiService: apiForEval,
        url_api: apiUrl,
        data,
        kace_data,

        // @ts-ignore
        setOptions: (newOptions) => {
          setAllOptions(mergeAllOptionsWithCurrentValue(newOptions));
        },

        setLoading,
        setError,
        handlerClear,
        setSelectedValue: setSelected,
        root,
      });
      const asyncRes = getEffectiveEvalPromise(result, lastHttp);
      if (asyncRes) {
        return asyncRes.catch((e) => {
          if (typeof console !== 'undefined' && console.error) {
            console.error('[CustomSelect] handlerData (async)', e);
          }
          throw e;
        });
      }
    } catch (e) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('[CustomSelect] handlerData', e);
      }
      throw e;
    }
  }, [
    component?.code,
    data,
    kaceEngine,
    apiUrl,
    root,
    refetchOnEveryOpen,
    mergeAllOptionsWithCurrentValue,
    segmented,
  ]);

  const { ensureLoaded, resetCache, onExternalDataEvent } =
    useLazySelectOptions({
      refetchOnEveryOpen,
      loadFn: handlerData,
    });

  const clear = useCallback(() => {
    setSelected(null);
    updateValue('');
    setSearch('');
  }, [updateValue]);

  const onResetForm = useCallback(() => {
    clear();
    resetCache();
    invalidateSegmentedCache();
    pageRef.current = 1;
    hasMoreRef.current = true;
  }, [clear, resetCache, invalidateSegmentedCache]);

  openRef.current = open;

  useEffect(() => {
    if (!segmented || !remoteSearch || !openRef.current) {
      return;
    }
    pageRef.current = 1;
    hasMoreRef.current = true;
    invalidateSegmentedCache();
    void loadSegmented(runSegmentedEvaluate);
  }, [
    stableRemoteTerm,
    segmented,
    remoteSearch,
    invalidateSegmentedCache,
    loadSegmented,
    runSegmentedEvaluate,
  ]);

  useLayoutEffect(() => {
    if (!segmented || !remoteSearch || !open) {
      return;
    }
    if (paginationFocusSuppressionRef.current) {
      if (!loading) {
        remoteLoadFocusRef.current = false;
      } else {
        remoteLoadFocusRef.current = true;
      }
      return;
    }
    if (!loading && remoteLoadFocusRef.current) {
      remoteLoadFocusRef.current = false;
      searchInputRef.current?.focus();
    }
    if (loading) {
      remoteLoadFocusRef.current = true;
    }
  }, [loading, segmented, remoteSearch, open]);

  useEffect(() => {
    if (typeof onEvent !== 'function') {
      return;
    }
    const onAuthOrRedraw = segmented
      ? invalidateSegmentedCache
      : onExternalDataEvent;
    onEvent('kaceAuthData', onAuthOrRedraw);
    onEvent('redraw', onAuthOrRedraw);
    onEvent('resetForm', onResetForm);
    return () => {
      offEvent?.('kaceAuthData', onAuthOrRedraw);
      offEvent?.('redraw', onAuthOrRedraw);
      offEvent?.('resetForm', onResetForm);
    };
  }, [
    onEvent,
    offEvent,
    onExternalDataEvent,
    onResetForm,
    segmented,
    invalidateSegmentedCache,
  ]);

  const handleSelect = (option) => {
    setSelected(option);
    updateValue(option.value);

    setOpen(false);
    setSearch('');

    if (component?.onChangeCode) {
      setLoading(true);
      setError(null);
      try {
        const baseApi = wrapKaceApiServiceForRefetch(
          kaceEngine.getService('apiService'),
          refetchOnEveryOpen
        );
        const { lastHttp, api: apiForEval } =
          wrapApiServiceForEvalLastHttpPromise(baseApi);
        lastHttp.last = null;
        const result = evaluateKace(component.onChangeCode, {
          kaceEngine,
          apiService: apiForEval,
          url_api: apiUrl,
          data,
          setOptions: (newOptions) => {
            setAllOptions(mergeAllOptionsWithCurrentValue(newOptions));
            setLoading(false);
          },
          setLoading,
          setError,
          handlerClear,
          selected:
            (allOptions ?? []).find((o) => o.value === option.value) || null,
          setSelectedValue: setSelected,
          updateValue,
          root,
        });
        const asyncRes = getEffectiveEvalPromise(result, lastHttp);
        if (asyncRes) {
          asyncRes
            .catch((e) => {
              if (typeof console !== 'undefined' && console.error) {
                console.error('[CustomSelect] onChangeCode (async)', e);
              }
            })
            .finally(() => {
              setLoading(false);
            });
        } else {
          setLoading(false);
        }
      } catch (e) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('[CustomSelect] onChangeCode', e);
        }
        setLoading(false);
      }
    }
  };

  // Sync Form.io `value` → display only when `value` changes, not when options
  // refetch (same pattern as Multiselect).
  useEffect(() => {
    if (value === null || value === undefined || value === '') {
      setSelected(null);
      lastValueSyncKeyRef.current = '__empty__';
      return;
    }

    let syncKey;
    try {
      syncKey = JSON.stringify(value);
    } catch {
      return;
    }
    if (syncKey === lastValueSyncKeyRef.current) {
      return;
    }
    lastValueSyncKeyRef.current = syncKey;

    const merged = ensureSelectedOption(
      Array.isArray(allOptionsRef.current) ? [...allOptionsRef.current] : [],
      value,
      {
        createTempOption: (v) => ({
          label: String(v),
          value: String(v),
        }),
      }
    );
    const found = merged.find((o) => String(o.value) === String(value));
    if (found) {
      setSelected(found);
      return;
    }

    setSelected({
      label: String(value),
      value: String(value),
    });
  }, [value]);

  useEffect(() => {
    const handler = (e) => {
      if (!wrapperRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);

    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (isFirstDepRender.current) {
      isFirstDepRender.current = false;
      return;
    }
    if (!component?.dependsOn) {
      return;
    }
    if (segmented) {
      pageRef.current = 1;
      hasMoreRef.current = true;
      invalidateSegmentedCache();
      void loadSegmented(runSegmentedEvaluate);
    } else {
      handlerData();
    }
  }, [dependencyValue]);

  // Auto-clear: if the current value is not in the freshly loaded options, reset it
  useEffect(() => {
    if (component?.dependsOn) return;
    if (allOptions === null || !value) return;
    if (!isSelectValueInCatalog(value, allOptions)) {
      updateValue('');
      setSelected(null);
    }
  }, [allOptions]);

  useEffect(() => {
    if (!component?.dependsOn) return;
    if (allOptions === null || !value) return;
    const catalog = rawCatalogForReconcileRef.current;
    if (!Array.isArray(catalog)) return;
    if (!isSelectValueInCatalog(value, catalog)) {
      updateValue('');
      setSelected(null);
    }
  }, [allOptions, dependencySignature]);

  return (
    <div ref={wrapperRef} className={`custom-dropdown ${disabledClassName}`}>
      <div
        className="custom-dropdown-control"
        onClick={() => {
          if (isDisabled) {
            return;
          }
          if (!open) {
            if (segmented) {
              pageRef.current = 1;
              hasMoreRef.current = true;
              void loadSegmented(runSegmentedEvaluate);
            } else {
              void ensureLoaded();
            }
          }
          setOpen((prev) => !prev);
        }}
      >
        {selected?.label || component.placeholder || 'Elige una opción'}
        <span className="arrow">▾</span>
      </div>

      {open && (
        <div className="custom-dropdown-menu">
          <input
            ref={searchInputRef}
            className="custom-dropdown-search"
            placeholder="Escriba para buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            disabled={isDisabled}
          />

          {loading && (filteredOptions?.length ?? 0) > 0 && (
            <small
              className="kace-select-loader d-block"
              role="status"
              aria-live="polite"
            >
              Cargando...
            </small>
          )}
          {error && <small className="text-danger">Error</small>}

          <ul
            className="custom-dropdown-list"
            style={
              infiniteScroll
                ? { maxHeight: '240px', overflowY: 'auto' }
                : undefined
            }
            onScroll={(e) => {
              if (
                !segmented ||
                !infiniteScroll ||
                loading ||
                segmentedScrollInFlightRef.current ||
                !hasMoreRef.current
              ) {
                return;
              }
              const el = e.currentTarget;
              if (!isKaceSelectScrollNearBottom(el)) {
                return;
              }
              paginationFocusSuppressionRef.current = true;
              segmentedScrollInFlightRef.current = true;
              pageRef.current += 1;
              void loadSegmented(runSegmentedEvaluate).finally(() => {
                segmentedScrollInFlightRef.current = false;
                queueMicrotask(() => {
                  paginationFocusSuppressionRef.current = false;
                });
              });
            }}
          >
            {filteredOptions.map((option) => (
              <li
                key={option.value}
                onClick={() => !isDisabled && handleSelect(option)}
              >
                {option.label}
              </li>
            ))}

            {!filteredOptions?.length && loading && (
              <li
                className="empty kace-select-list-loading"
                role="status"
                aria-live="polite"
              >
                Cargando…
              </li>
            )}

            {!filteredOptions?.length && !loading && (
              <li className="empty">No se encontraron resultados</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
