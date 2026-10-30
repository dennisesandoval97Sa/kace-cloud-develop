import './CustomMultiselect.css';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { evaluateKace } from '#plugins/kace/shared/evaluateKace.js';
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
import { mergeScriptSelectOptions } from '#plugins/kace/utils/mergeScriptSelectOptions.js';

const getOptionValueKey = (option) => {
  if (!option) return '';
  const value =
    option.value !== undefined ? option.value : (option.label ?? '');
  return String(value);
};

const getOptionLabelKey = (option) => String(option?.label ?? '').toLowerCase();

const matchesSelectedOption = (option, selectedItem) => {
  if (!option || !selectedItem) return false;
  return (
    getOptionValueKey(option) === getOptionValueKey(selectedItem) ||
    (getOptionLabelKey(option) !== '' &&
      getOptionLabelKey(option) === getOptionLabelKey(selectedItem))
  );
};

const BULK_MAX_PAGES = 100;

/**
 * @typedef Props
 * @prop {{ [x: string]: unknown }} component - `this.component` properties
 * @prop {(value: any, flags?: any, source?: any) => any} updateValue - Function to update `this.value` (formio component instance) value
 * @prop {any[]} [values] - Current selected values from Form.io
 * @prop {{ [x: string]: unknown }} [data] - Form submission data
 * @prop {(event: string, handler: Function) => void} onEvent - Form.io event emitter
 * @prop {boolean} [disabled=false] - Disables interactions when Form.io sets disable
 * @prop {any} [dependencyValue] - Current value of the field this component depends on (set via `dependsOn`)
 * @prop {boolean} [dependencyChanged=false] - True when the parent dependency value changed since last render
 */

/**
 * @param {Props} props
 */
export const CustomMultiselect = ({
  component,
  updateValue,
  values,
  data,
  onEvent,
  offEvent,
  disabled = false,
  dependencyValue,
  dependencyChanged = false,
}) => {
  const {
    disabled: isDisabled,
    readOnlyLock,
    className: disabledClassName,
  } = useKaceDisabled(disabled);
  const [options, setOptions] = useState(
    /** @type {Array<{value: any, label: string}> | null} */ (null)
  );
  const [selected, setSelected] = useState(
    /** @type {Array<{value: any, label: string}>} */ (
      Array.isArray(values) ? values : []
    )
  );
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const segmentedScrollInFlightRef = useRef(false);
  const searchInputRef = useRef(null);
  const openRef = useRef(false);
  const remoteLoadFocusRef = useRef(false);
  const paginationFocusSuppressionRef = useRef(false);
  const isFirstDepRender = useRef(true);
  const valuesRef = useRef(values);
  const selectedRef = useRef([]);
  selectedRef.current = selected;
  const lastValuesSyncKeyRef = useRef(null);
  const pendingUserSelectionRef = useRef(false);
  const dependencyEmptyClearAppliedRef = useRef(false);
  const bulkSelectAllInProgressRef = useRef(false);
  const [bulkSelectAllLoading, setBulkSelectAllLoading] = useState(false);

  const multiple = Boolean(component.multiple);
  const kaceEngine = KaceEngine();
  const storeService = kaceEngine.getService('storeService');
  const apiUrl = storeService.get('config.api_url');
  const refetchOnEveryOpen = Boolean(component?.refetchOnEveryOpen);
  const infiniteScroll = Boolean(component?.infiniteScroll);
  const remoteSearch = Boolean(component?.remoteSearch);
  const pageSize =
    Number(component?.pageSize) > 0 ? Number(component?.pageSize) : 20;
  const displayTempOptionCap = Math.max(pageSize, 1);
  const segmented = infiniteScroll || remoteSearch;
  const dependencySignature = useMemo(() => {
    try {
      return JSON.stringify(dependencyValue ?? null);
    } catch {
      return '';
    }
  }, [dependencyValue]);

  const isDependencyEmpty = useMemo(() => {
    if (
      dependencyValue === undefined ||
      dependencyValue === null ||
      dependencyValue === ''
    ) {
      return true;
    }
    if (Array.isArray(dependencyValue)) {
      return dependencyValue.length === 0;
    }
    return false;
  }, [dependencyValue]);

  const stableRemoteTerm = useDebouncedStableTerm(
    searchTerm,
    500,
    remoteSearch && isOpen
  );

  const shouldIncludeSelectionInOptionList = useMemo(() => {
    if (!remoteSearch || !segmented) {
      return true;
    }
    return String(stableRemoteTerm ?? '').trim() === '';
  }, [remoteSearch, segmented, stableRemoteTerm]);

  const mergeOptionsWithCurrentSelection = useCallback(
    (incoming) => {
      const base = Array.isArray(incoming) ? [...incoming] : [];
      if (!shouldIncludeSelectionInOptionList) {
        return base;
      }
      const selectedNotInOptions = selectedRef.current.filter(
        (item) =>
          item &&
          item.value !== undefined &&
          item.value !== null &&
          !base.some(
            (option) =>
              option &&
              getOptionLabelKey(option) !== '' &&
              getOptionLabelKey(option) === getOptionLabelKey(item)
          )
      );
      if (selectedNotInOptions.length > displayTempOptionCap) {
        return base;
      }
      return selectedRef.current.reduce((acc, item) => {
        if (!item || item.value === undefined || item.value === null) {
          return acc;
        }
        const hasLabelMatch = acc.some(
          (option) =>
            option &&
            getOptionLabelKey(option) !== '' &&
            getOptionLabelKey(option) === getOptionLabelKey(item)
        );
        if (hasLabelMatch) {
          return acc;
        }
        return ensureSelectedOption(acc, item.value, {
          createTempOption: (optionValue) => ({
            value: optionValue,
            label: String(item.label ?? optionValue),
          }),
        });
      }, base);
    },
    [shouldIncludeSelectionInOptionList, displayTempOptionCap]
  );

  const deduplicateOptionsByValue = (opts, selectedItems = []) => {
    if (!Array.isArray(opts)) return [];

    const selectedList = Array.isArray(selectedItems) ? selectedItems : [];
    const isPreferred = (option) =>
      selectedList.some((item) => matchesSelectedOption(option, item));

    const labelBest = new Map();
    for (const option of opts) {
      if (!option) continue;
      const labelKey = getOptionLabelKey(option);
      const mapKey = labelKey || `__value__${getOptionValueKey(option)}`;
      const current = labelBest.get(mapKey);
      if (!current) {
        labelBest.set(mapKey, option);
        continue;
      }
      if (isPreferred(option) && !isPreferred(current)) {
        labelBest.set(mapKey, option);
      }
    }

    const seenValueKeys = new Set();
    const result = [];
    for (const option of opts) {
      if (!option) continue;
      const labelKey = getOptionLabelKey(option);
      const mapKey = labelKey || `__value__${getOptionValueKey(option)}`;
      if (labelBest.get(mapKey) !== option) continue;
      const valueKey = getOptionValueKey(option);
      if (seenValueKeys.has(valueKey)) continue;
      seenValueKeys.add(valueKey);
      result.push(option);
    }
    return result;
  };

  const displayMerge = useCallback(
    (items) =>
      deduplicateOptionsByValue(
        mergeOptionsWithCurrentSelection(items),
        selectedRef.current
      ),
    [mergeOptionsWithCurrentSelection]
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
      mergeOptionsForDisplay: displayMerge,
      applyOptions: setOptions,
      onInfiniteStall: handleInfiniteStall,
    });

  const handleSelect = (option) => {
    let newSelected;

    if (multiple) {
      const isAlreadySelected = selected.some((item) =>
        matchesSelectedOption(option, item)
      );

      if (isAlreadySelected) {
        newSelected = selected.filter(
          (item) => !matchesSelectedOption(option, item)
        );
      } else {
        newSelected = [...selected, option];
      }
    } else {
      newSelected = [option];
      setIsOpen(false);
    }

    markPendingUserSelection(newSelected);
    setSelected(newSelected);
    updateValue(newSelected);

    if (component?.onChangeCode) {
      setLoading(true);
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
            setOptions(displayMerge(newOptions));
            setLoading(false);
          },
          setLoading,
          updateValue,
          setSelected: (newSel) => {
            markPendingUserSelection(newSel);
            setSelected(newSel);
            updateValue(newSel);
          },
        });
        const asyncRes = getEffectiveEvalPromise(result, lastHttp);
        if (asyncRes) {
          asyncRes
            .catch((e) => {
              if (typeof console !== 'undefined' && console.error) {
                console.error('[CustomMultiselect] onChangeCode (async)', e);
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
          console.error('[CustomMultiselect] onChangeCode', e);
        }
        setLoading(false);
      }
    }
  };

  const markPendingUserSelection = useCallback((newSelected) => {
    pendingUserSelectionRef.current = true;
    try {
      lastValuesSyncKeyRef.current = JSON.stringify(newSelected);
      valuesRef.current = newSelected;
    } catch {
      pendingUserSelectionRef.current = false;
    }
  }, []);

  const handleRemove = (optionValue, e) => {
    e.stopPropagation();
    const newSelected = selected.filter(
      (item) => getOptionValueKey(item) !== String(optionValue)
    );
    markPendingUserSelection(newSelected);
    setSelected(newSelected);
    updateValue(newSelected);
  };

  const isSelectedOption = (option) =>
    selected.some((item) => matchesSelectedOption(option, item));

  const filteredOptions = useMemo(() => {
    const baseOptions = displayMerge(options === null ? [] : options);

    if (remoteSearch && segmented) {
      return baseOptions;
    }

    return baseOptions.filter((option) =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm, remoteSearch, segmented, displayMerge]);

  const handleSelectAll = async () => {
    if (!segmented) {
      const newSelected = [...(options ?? [])];
      markPendingUserSelection(newSelected);
      setSelected(newSelected);
      updateValue(newSelected);
      setIsOpen(false);
      return;
    }

    const term = remoteSearch ? stableRemoteTerm : '';
    bulkSelectAllInProgressRef.current = true;
    setBulkSelectAllLoading(true);
    setLoading(true);

    try {
      let buffer = [];
      let lastPageItems = [];

      for (let page = 1; page <= BULK_MAX_PAGES; page += 1) {
        const baseApi = wrapKaceApiServiceForRefetch(
          kaceEngine.getService('apiService'),
          refetchOnEveryOpen
        );
        const { lastHttp, api: apiForEval } =
          wrapApiServiceForEvalLastHttpPromise(baseApi);
        lastHttp.last = null;

        const injectedSetOptions = (items) => {
          const arr = Array.isArray(items) ? items : [];
          lastPageItems = arr;
          buffer = mergeScriptSelectOptions(buffer, arr, true);
        };

        const result = evaluateKace(component.code, {
          kaceEngine,
          apiService: apiForEval,
          url_api: apiUrl,
          data,
          kaceSelectPage: page,
          kaceRemoteSearchTerm: term,
          kaceSelectPageSize: pageSize,
          setOptions: injectedSetOptions,
          setLoading: () => {},
          updateValue,
          handlerClear,
          setSelected: () => {},
        });

        const asyncRes = getEffectiveEvalPromise(result, lastHttp);
        if (asyncRes) await asyncRes;

        if (lastPageItems.length === 0 || lastPageItems.length < pageSize) {
          break;
        }
      }

      if (buffer.length > 0) {
        markPendingUserSelection(buffer);
        setSelected(buffer);
        updateValue(buffer);
      }
      setIsOpen(false);
    } catch (e) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('[CustomMultiselect] handleSelectAll (bulk)', e);
      }
    } finally {
      bulkSelectAllInProgressRef.current = false;
      setBulkSelectAllLoading(false);
      setLoading(false);
    }
  };

  const handleClearAll = () => {
    bulkSelectAllInProgressRef.current = false;
    setBulkSelectAllLoading(false);
    markPendingUserSelection([]);
    setSelected([]);
    updateValue([]);
    setIsOpen(false);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handlerClear = useCallback(() => {
    pendingUserSelectionRef.current = true;
    lastValuesSyncKeyRef.current = '[]';
    valuesRef.current = [];
    setSelected([]);
    updateValue([]);
    setOptions(null);
  }, [updateValue]);

  const runSegmentedEvaluate = useCallback(
    async ({
      setOptions: setOptionsFromLoad,
      kaceSelectPage,
      kaceRemoteSearchTerm,
    }) => {
      if (!component?.code) return;
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
          updateValue,
          handlerClear,
          setSelected: (newSel) => {
            markPendingUserSelection(newSel);
            setSelected(newSel);
            updateValue(newSel);
          },
        });
        const asyncRes = getEffectiveEvalPromise(result, lastHttp);
        if (asyncRes) {
          return asyncRes.catch((e) => {
            if (typeof console !== 'undefined' && console.error) {
              console.error('[CustomMultiselect] segmented eval (async)', e);
            }
            throw e;
          });
        }
      } catch (e) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('[CustomMultiselect] segmented eval', e);
        }
        throw e;
      }
    },
    [
      component?.code,
      data,
      kaceEngine,
      apiUrl,
      updateValue,
      refetchOnEveryOpen,
      pageSize,
      infiniteScroll,
      handlerClear,
      markPendingUserSelection,
    ]
  );

  const handlerData = useCallback(() => {
    if (segmented) {
      return Promise.resolve();
    }
    if (!component?.code) return;
    setOptions(null);
    setLoading(true);
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
          setOptions(displayMerge(newOptions));
          setLoading(false);
        },
        setLoading,
        updateValue,
        setSelected: (newSel) => {
          markPendingUserSelection(newSel);
          setSelected(newSel);
          updateValue(newSel);
        },
      });
      const asyncRes = getEffectiveEvalPromise(result, lastHttp);
      if (asyncRes) {
        return asyncRes
          .catch((e) => {
            if (typeof console !== 'undefined' && console.error) {
              console.error('[CustomMultiselect] handlerData (async)', e);
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
        console.error('[CustomMultiselect] handlerData', e);
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
    displayMerge,
    segmented,
    markPendingUserSelection,
  ]);

  const { ensureLoaded, resetCache, onExternalDataEvent } =
    useLazySelectOptions({
      refetchOnEveryOpen,
      loadFn: handlerData,
    });

  const syncSelectedFromFormValues = useCallback(
    (incoming) => {
      if (!Array.isArray(incoming)) {
        setSelected([]);
        lastValuesSyncKeyRef.current = null;
        return;
      }

      let syncKey;
      try {
        syncKey = JSON.stringify(incoming);
      } catch {
        return;
      }
      if (syncKey === lastValuesSyncKeyRef.current) {
        if (pendingUserSelectionRef.current) {
          pendingUserSelectionRef.current = false;
        }
        return;
      }

      if (pendingUserSelectionRef.current) {
        return;
      }

      if (component?.dependsOn) {
        if (isDependencyEmpty) {
          lastValuesSyncKeyRef.current = '[]';
          return;
        }
      } else if (incoming.length === 0 && selectedRef.current.length > 0) {
        return;
      }

      lastValuesSyncKeyRef.current = syncKey;

      setSelected((prev) =>
        incoming.map((val) => {
          if (
            typeof val === 'object' &&
            val !== null &&
            val.value !== undefined
          ) {
            return val;
          }
          const fromPrev = prev.find((p) => String(p?.value) === String(val));
          if (fromPrev) {
            return fromPrev;
          }
          const catalog = Array.isArray(options) ? options : [];
          const fromCatalog = catalog.find(
            (o) => o && String(o.value) === String(val)
          );
          if (fromCatalog) {
            return fromCatalog;
          }
          return { value: val, label: String(val) };
        })
      );
    },
    [options, component?.dependsOn, isDependencyEmpty]
  );

  const reloadOptionsPreservingSelection = useCallback(() => {
    pageRef.current = 1;
    hasMoreRef.current = true;
    if (segmented) {
      invalidateSegmentedCache();
      void loadSegmented(runSegmentedEvaluate);
      return;
    }
    onExternalDataEvent();
    void ensureLoaded();
  }, [
    segmented,
    invalidateSegmentedCache,
    loadSegmented,
    runSegmentedEvaluate,
    onExternalDataEvent,
    ensureLoaded,
  ]);

  const onRedraw = useCallback(() => {
    lastValuesSyncKeyRef.current = null;
    syncSelectedFromFormValues(valuesRef.current);
    setSearchTerm('');
    reloadOptionsPreservingSelection();
  }, [syncSelectedFromFormValues, reloadOptionsPreservingSelection]);

  const onResetForm = useCallback(() => {
    handlerClear();
    resetCache();
    invalidateSegmentedCache();
    pageRef.current = 1;
    hasMoreRef.current = true;
    setSearchTerm('');
    lastValuesSyncKeyRef.current = null;
  }, [handlerClear, resetCache, invalidateSegmentedCache]);

  openRef.current = isOpen;

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
    if (!segmented || !remoteSearch || !isOpen) {
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
  }, [loading, segmented, remoteSearch, isOpen]);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (values === undefined) {
      return;
    }
    syncSelectedFromFormValues(values);
  }, [values, syncSelectedFromFormValues]);

  useEffect(() => {
    if (segmented) {
      pageRef.current = 1;
      hasMoreRef.current = true;
      void loadSegmented(runSegmentedEvaluate);
    } else {
      handlerData();
    }
  }, [component?.dependsOn]);

  useEffect(() => {
    if (!component?.dependsOn) {
      return;
    }
    if (!isDependencyEmpty) {
      dependencyEmptyClearAppliedRef.current = false;
      return;
    }
    if (dependencyEmptyClearAppliedRef.current) {
      return;
    }
    dependencyEmptyClearAppliedRef.current = true;
    lastValuesSyncKeyRef.current = '[]';
    setSelected([]);
    setSearchTerm('');
    setOptions([]);
    updateValue([]);
  }, [
    component?.dependsOn,
    isDependencyEmpty,
    dependencySignature,
    updateValue,
  ]);

  useEffect(() => {
    if (typeof onEvent !== 'function') {
      return;
    }
    onEvent('kaceAuthData', onRedraw);
    onEvent('redraw', onRedraw);
    onEvent('resetForm', onResetForm);
    return () => {
      offEvent?.('kaceAuthData', onRedraw);
      offEvent?.('redraw', onRedraw);
      offEvent?.('resetForm', onResetForm);
    };
  }, [onEvent, offEvent, onRedraw, onResetForm]);

  const handleMultiSelectInputClick = useCallback(() => {
    if (isDisabled) {
      return;
    }
    if (!isOpen) {
      if (segmented) {
        pageRef.current = 1;
        hasMoreRef.current = true;
        void loadSegmented(runSegmentedEvaluate);
      } else {
        void ensureLoaded();
      }
    }
    setIsOpen((prev) => !prev);
  }, [
    isDisabled,
    isOpen,
    ensureLoaded,
    segmented,
    loadSegmented,
    runSegmentedEvaluate,
  ]);

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
  }, [dependencySignature, component?.dependsOn]);

  useEffect(() => {
    if (bulkSelectAllInProgressRef.current) return;
    if (component?.dependsOn) return;
    if (options === null || selected.length === 0) return;
    const formValues = Array.isArray(valuesRef.current)
      ? valuesRef.current
      : [];
    const formValueKeys = new Set(
      formValues.map((val) =>
        String(typeof val === 'object' && val !== null ? val.value : val)
      )
    );
    const validSelected = selected.filter((item) => {
      if (!item || item.value === undefined || item.value === null) {
        return false;
      }
      const inCatalog = options.some(
        (option) => option && String(option.value) === String(item.value)
      );
      return inCatalog || formValueKeys.has(String(item.value));
    });
    if (validSelected.length !== selected.length) {
      setSelected(validSelected);
      updateValue(validSelected);
    }
  }, [options]);

  return (
    <div
      className={`multi-select-container ${disabledClassName}`}
      ref={containerRef}
    >
      <div
        className={`multi-select-input ${isOpen ? 'open' : ''}`}
        onClick={handleMultiSelectInputClick}
      >
        {selected.length === 0 ? (
          <span className="multi-select-placeholder">
            {component?.placeholder || 'Seleccione una opción'}
          </span>
        ) : (
          selected.map((item) => (
            <span key={item.value} className="badge badge-primary">
              {item.label}
              <span
                className="badge-close"
                onClick={(e) => !isDisabled && handleRemove(item.value, e)}
              >
                ×
              </span>
            </span>
          ))
        )}
      </div>

      {isOpen && (
        <div
          className="multi-select-dropdown"
          data-testid="kace-custom-multiselect-options-scroll"
          style={
            infiniteScroll
              ? { maxHeight: '280px', overflowY: 'auto' }
              : undefined
          }
          onScroll={
            infiniteScroll
              ? (e) => {
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
                }
              : undefined
          }
        >
          <div
            className="kace-multiselect-menu-sticky"
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 2,
              background: '#fff',
              paddingBottom: '8px',
              marginBottom: '4px',
              borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
            }}
          >
            <input
              ref={searchInputRef}
              type="text"
              className="multi-select-search"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={handleSearchChange}
              onClick={(e) => e.stopPropagation()}
              disabled={isDisabled || loading}
            />

            {loading && (Array.isArray(options) ? options.length : 0) > 0 && (
              <div
                className="kace-select-loader px-2 py-1"
                role="status"
                aria-live="polite"
              >
                <small>Cargando...</small>
              </div>
            )}

            {multiple && (
              <div className="multi-select-actions">
                <button
                  className="btn-action btn-select-all"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isDisabled) handleSelectAll();
                  }}
                  disabled={isDisabled || bulkSelectAllLoading}
                >
                  Seleccionar todos
                </button>
                <button
                  className="btn-action btn-clear-all"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isDisabled) handleClearAll();
                  }}
                  disabled={isDisabled || bulkSelectAllLoading}
                >
                  Quitar todos
                </button>
              </div>
            )}
          </div>

          {filteredOptions.length === 0 && loading && (
            <div
              className="no-results kace-select-list-loading"
              role="status"
              aria-live="polite"
            >
              Cargando…
            </div>
          )}

          {filteredOptions.length === 0 && !loading && (
            <div className="no-results">No se encontraron resultados</div>
          )}

          {filteredOptions.length > 0 &&
            filteredOptions.map((option) => (
              <div
                key={option.value}
                className={`multi-select-option ${isSelectedOption(option) ? 'selected' : ''}`}
                onClick={() => !isDisabled && handleSelect(option)}
              >
                {multiple && (
                  <input
                    type="checkbox"
                    checked={isSelectedOption(option)}
                    onChange={() => {}}
                    style={{ marginRight: '8px' }}
                    disabled={isDisabled}
                  />
                )}
                {option.label}
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
