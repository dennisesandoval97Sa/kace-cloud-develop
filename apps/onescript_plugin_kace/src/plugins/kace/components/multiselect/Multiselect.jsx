import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import './Multiselect.css';
import { evaluateKace } from '#plugins/kace/shared/evaluateKace.js';
import MultiSelectBase from '#plugins/kace/shared/ui/MultiSelectBase.jsx';
import { KaceEngine } from '#plugins/kace/KaceEngine.js';
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

/**
 * @typedef Props
 * @prop {{ [x: string]: unknown }} component - `this.component` properties
 * @prop {(value: any, flags: any, source: any) => any} updateValue - Function to update `this.value` (formio component instance) value
 * @prop {boolean} [disabled=false] - Disables interactions when Form.io sets disable
 */

/**
 * @param {Props} props
 */
export const Multiselect = ({
  component,
  values,
  data,
  updateValue,
  onEvent,
  offEvent,
  disabled = false,
}) => {
  const {
    disabled: isDisabled,
    readOnlyLock,
    className: disabledClassName,
  } = useKaceDisabled(disabled);
  const [selectedValues, setSelectedValues] = useState([]);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuSearch, setMenuSearch] = useState('');
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const segmentedScrollInFlightRef = useRef(false);
  const searchInputRef = useRef(null);
  const menuOpenRef = useRef(false);
  const remoteLoadFocusRef = useRef(false);
  const paginationFocusSuppressionRef = useRef(false);
  const valuesRef = useRef(values);
  const selectedValuesRef = useRef([]);
  const optionsRef = useRef(options);
  const lastValuesSyncKeyRef = useRef(null);
  const pendingUserClearRef = useRef(false);
  selectedValuesRef.current = selectedValues;
  optionsRef.current = options;

  const kaceEngine = KaceEngine();
  const storeService = kaceEngine.getService('storeService');
  const apiUrl = storeService.get('config.api_url');
  const refetchOnEveryOpen = Boolean(component?.refetchOnEveryOpen);
  const infiniteScroll = Boolean(component?.infiniteScroll);
  const remoteSearch = Boolean(component?.remoteSearch);
  const pageSize =
    Number(component?.pageSize) > 0 ? Number(component?.pageSize) : 20;
  const resolvedPlaceholder =
    typeof component?.placeholder === 'string' &&
    component.placeholder.trim() !== ''
      ? component.placeholder
      : 'Seleccione una opción';
  const segmented = infiniteScroll || remoteSearch;
  const stableRemoteTerm = useDebouncedStableTerm(
    menuSearch,
    500,
    remoteSearch && menuOpen
  );

  const mergeOptionsWithCurrentSelection = useCallback((incoming) => {
    const base = Array.isArray(incoming) ? [...incoming] : [];
    return selectedValuesRef.current.reduce((acc, item) => {
      if (!item || item.value === undefined || item.value === null) {
        return acc;
      }
      return ensureSelectedOption(acc, item.value, {
        createTempOption: (optionValue) => ({
          value: optionValue,
          label: String(item.label ?? optionValue),
        }),
      });
    }, base);
  }, []);

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
      dependencySignature: '',
      getContext,
      mergeOptionsForDisplay: mergeOptionsWithCurrentSelection,
      applyOptions: setOptions,
      onInfiniteStall: handleInfiniteStall,
    });

  const displayOptions = useMemo(() => {
    try {
      return selectedValues.reduce(
        (acc, item) => {
          if (!item || item.value === undefined || item.value === null) {
            return acc;
          }

          return ensureSelectedOption(acc, item.value, {
            createTempOption: (optionValue) => ({
              value: optionValue,
              label: String(item.label ?? optionValue),
            }),
          });
        },
        Array.isArray(options) ? options : []
      );
    } catch {
      return Array.isArray(options) ? options : [];
    }
  }, [options, selectedValues]);

  const markUserClearPending = useCallback(() => {
    pendingUserClearRef.current = true;
    lastValuesSyncKeyRef.current = '[]';
  }, []);

  const handlerChange = (name, value) => {
    if (Array.isArray(value) && value.length === 0) {
      markUserClearPending();
    }
    setSelectedValues(value);
    updateValue(value);
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
            setOptions(mergeOptionsWithCurrentSelection(newOptions));
            setLoading(false);
          },
          setLoading,
          setError,
          handlerClear: clearSelection,
          name,
          value,
          setSelectedValues,
          updateValue,
        });
        const asyncRes = getEffectiveEvalPromise(result, lastHttp);
        if (asyncRes) {
          asyncRes
            .catch((e) => {
              if (typeof console !== 'undefined' && console.error) {
                console.error('[Multiselect] onChangeCode (async)', e);
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
          console.error('[Multiselect] onChangeCode', e);
        }
        setLoading(false);
      }
    }
  };

  const clearSelection = () => {
    handlerChange(component.key, []);
  };

  const runSegmentedEvaluateRef = useRef(null);

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
          handlerClear: clearSelection,
          setSelectedValues,
          updateValue,
        });
        const asyncRes = getEffectiveEvalPromise(result, lastHttp);
        if (asyncRes) {
          return asyncRes.catch((e) => {
            if (typeof console !== 'undefined' && console.error) {
              console.error('[Multiselect] segmented eval (async)', e);
            }
            throw e;
          });
        }
      } catch (e) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('[Multiselect] segmented eval', e);
        }
        throw e;
      }
    },
    [
      component?.code,
      data,
      kaceEngine,
      apiUrl,
      refetchOnEveryOpen,
      pageSize,
      infiniteScroll,
      clearSelection,
    ]
  );

  runSegmentedEvaluateRef.current = runSegmentedEvaluate;

  const handlerData = useCallback(() => {
    if (segmented) {
      return Promise.resolve();
    }
    if (!component?.code) return;

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
      const result = evaluateKace(component.code, {
        kaceEngine,
        apiService: apiForEval,
        url_api: apiUrl,
        data,
        setOptions: (newOptions) => {
          setOptions(mergeOptionsWithCurrentSelection(newOptions));
          setLoading(false);
        },
        setLoading,
        setError,
        handlerClear: clearSelection,
        setSelectedValues,
        updateValue,
      });
      const asyncRes = getEffectiveEvalPromise(result, lastHttp);
      if (asyncRes) {
        return asyncRes
          .catch((e) => {
            if (typeof console !== 'undefined' && console.error) {
              console.error('[Multiselect] handlerData (async)', e);
            }
            throw e;
          })
          .finally(() => {
            setLoading(false);
          });
      }
      setLoading(false);
    } catch (e) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('[Multiselect] handlerData', e);
      }
      setLoading(false);
      throw e;
    }
  }, [
    component?.code,
    data,
    kaceEngine,
    apiUrl,
    updateValue,
    refetchOnEveryOpen,
    mergeOptionsWithCurrentSelection,
    segmented,
  ]);

  const { ensureLoaded, resetCache, onExternalDataEvent } =
    useLazySelectOptions({
      refetchOnEveryOpen,
      loadFn: handlerData,
    });

  const onResetForm = useCallback(() => {
    pendingUserClearRef.current = true;
    lastValuesSyncKeyRef.current = '[]';
    resetCache();
    invalidateSegmentedCache();
    pageRef.current = 1;
    hasMoreRef.current = true;
    setMenuSearch('');
    setSelectedValues([]);
    updateValue([]);
  }, [resetCache, invalidateSegmentedCache, updateValue]);

  menuOpenRef.current = menuOpen;

  useEffect(() => {
    if (!segmented || !remoteSearch || !menuOpenRef.current) {
      return;
    }
    pageRef.current = 1;
    hasMoreRef.current = true;
    invalidateSegmentedCache();
    void loadSegmented((args) => runSegmentedEvaluateRef.current?.(args));
  }, [
    stableRemoteTerm,
    segmented,
    remoteSearch,
    invalidateSegmentedCache,
    loadSegmented,
  ]);

  useLayoutEffect(() => {
    if (!segmented || !remoteSearch || !menuOpen) {
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
  }, [loading, segmented, remoteSearch, menuOpen]);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

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

  // Sync Form.io `values` → local state only when `values` actually changes.
  // Including `options` in deps caused a refetch to re-run this effect and wipe
  // chips if `values` was briefly empty or out of sync with the UI.
  useEffect(() => {
    if (values === undefined) {
      return;
    }
    if (!Array.isArray(values)) {
      setSelectedValues([]);
      lastValuesSyncKeyRef.current = null;
      return;
    }

    let syncKey;
    try {
      syncKey = JSON.stringify(values);
    } catch {
      return;
    }
    if (syncKey === lastValuesSyncKeyRef.current) {
      if (pendingUserClearRef.current && values.length === 0) {
        pendingUserClearRef.current = false;
      }
      return;
    }

    if (pendingUserClearRef.current && values.length > 0) {
      return;
    }

    if (pendingUserClearRef.current && values.length === 0) {
      pendingUserClearRef.current = false;
    }

    if (values.length === 0 && selectedValuesRef.current.length > 0) {
      return;
    }

    lastValuesSyncKeyRef.current = syncKey;

    const opts = Array.isArray(optionsRef.current)
      ? [...optionsRef.current]
      : [];

    setSelectedValues((prev) =>
      values.map((val) => {
        if (
          typeof val === 'object' &&
          val !== null &&
          val.value !== undefined
        ) {
          return val;
        }
        const merged = prev.reduce((acc, item) => {
          if (!item || item.value === undefined || item.value === null) {
            return acc;
          }
          return ensureSelectedOption(acc, item.value, {
            createTempOption: (optionValue) => ({
              value: optionValue,
              label: String(item.label ?? optionValue),
            }),
          });
        }, opts);
        const option = merged.find((opt) => String(opt?.value) === String(val));
        if (option) {
          return option;
        }
        return { value: val, label: String(val) };
      })
    );
  }, [values]);

  const handleRequestOpen = useCallback(() => {
    if (segmented) {
      pageRef.current = 1;
      hasMoreRef.current = true;
      void loadSegmented((args) => runSegmentedEvaluateRef.current?.(args));
    } else {
      void ensureLoaded();
    }
  }, [segmented, ensureLoaded, loadSegmented]);

  const handleMenuScroll = useCallback(
    (e) => {
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
      void loadSegmented((args) =>
        runSegmentedEvaluateRef.current?.(args)
      ).finally(() => {
        segmentedScrollInFlightRef.current = false;
        queueMicrotask(() => {
          paginationFocusSuppressionRef.current = false;
        });
      });
    },
    [segmented, infiniteScroll, loading, loadSegmented]
  );

  return (
    <div className={`form-group ${disabledClassName}`}>
      {error && (
        <div className="alert alert-danger" role="alert">
          <small>Error: {error}</small>
        </div>
      )}

      <div role="presentation">
        <MultiSelectBase
          name={component.key}
          options={displayOptions}
          selected={selectedValues}
          onChange={handlerChange}
          placeholder={resolvedPlaceholder}
          loading={loading}
          onRequestOpen={handleRequestOpen}
          onOpenChange={setMenuOpen}
          onMenuScroll={handleMenuScroll}
          disableClientFilter={segmented && remoteSearch}
          searchInputRef={searchInputRef}
          searchTerm={segmented && remoteSearch ? menuSearch : undefined}
          onSearchTermChange={
            segmented && remoteSearch
              ? (e) => setMenuSearch(e.target.value)
              : undefined
          }
        />
      </div>
    </div>
  );
};
