import { SELECT_LEVELS } from '#plugins/kace/data/constants.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelectState } from '#plugins/kace/hooks/useSelectState.jsx';
import { useLazySelectOptions } from '#plugins/kace/hooks/useLazySelectOptions.hook.js';
import './SelectReferenceLiterals.css';
import { CascadingSelect } from './components/CascadingSelect';
import '#plugins/kace/shared/styles/kace-disabled.css';
import { useKaceDisabled } from '#plugins/kace/hooks/useKaceDisabled.hook.js';
import { KaceEngine } from '#plugins/kace/KaceEngine.js';
import { FormLabel } from '#plugins/kace/shared/ui/FormLabel.jsx';

/**
 * Carga perezosa: las opciones de cada nivel se obtienen al abrir el panel (`CascadingSelect`)
 * o al inicializar con valor precargado (`value.model` / `field` / `option`). El buscador va
 * dentro del menú desplegable (mismo patrón que CustomSelect).
 *
 * @typedef Props
 * @prop {{ [x: string]: unknown }} component - `this.component` properties
 * @prop {{ model?: string, field?: string, option?: string }} value - Current Formio value
 * @prop {(value: any, flags?: any, source?: any) => any} updateValue - Formio update function
 * @prop {((ev: string, fn: () => void) => void) | undefined} onEvent
 * @prop {boolean} [disabled=false] - Disables interactions when Form.io sets disable
 */
export const SelectReferenceLiterals = ({
  component = {},
  value = {},
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
  const model = useSelectState();
  const field = useSelectState();
  const option = useSelectState();
  const {
    setOptions: setModelOptions,
    setLoading: setModelLoading,
    setValue: setModelValue,
  } = model;
  const {
    setOptions: setFieldOptions,
    setLoading: setFieldLoading,
    setValue: setFieldValue,
  } = field;
  const {
    setOptions: setOptionOptions,
    setLoading: setOptionLoading,
    setValue: setOptionValue,
  } = option;

  const isInitialized = useRef(false);
  const initInProgress = useRef(false);
  const isInternalChange = useRef(false);
  /** Reintento tras error: el siguiente `fetchAuxReference` usa `__kaceForceRefresh` aunque el Custom no tenga refetch. */
  const lastLiteralFetchFailedRef = useRef(false);
  const [hasRequestedOptions, setHasRequestedOptions] = useState(false);
  const modelValueRef = useRef(model.value);
  const fieldValueRef = useRef(field.value);
  useEffect(() => {
    modelValueRef.current = model.value;
  }, [model.value]);
  useEffect(() => {
    fieldValueRef.current = field.value;
  }, [field.value]);

  const kaceEngine = KaceEngine();
  const literalsService = kaceEngine.getService('literals');
  const refetchOnEveryOpen = Boolean(component?.refetchOnEveryOpen);

  const fetchOptions = useCallback(
    async (parentId = null) => {
      try {
        const items = await literalsService.fetchAuxReference({
          entityId: parentId,
          forceRefresh: refetchOnEveryOpen || lastLiteralFetchFailedRef.current,
        });
        lastLiteralFetchFailedRef.current = false;
        return Array.isArray(items) ? items : [];
      } catch (e) {
        lastLiteralFetchFailedRef.current = true;
        throw e;
      }
    },
    [literalsService, refetchOnEveryOpen]
  );

  const runLoadModel = useCallback(() => {
    setModelLoading(true);
    return (async () => {
      try {
        const modelItems = await fetchOptions();
        setModelOptions(modelItems);
      } finally {
        setModelLoading(false);
      }
    })();
  }, [fetchOptions, setModelLoading, setModelOptions]);

  const runLoadField = useCallback(() => {
    const parent = modelValueRef.current;
    if (!parent) {
      return Promise.resolve();
    }
    setFieldLoading(true);
    return (async () => {
      try {
        const fieldItems = await fetchOptions(parent);
        setFieldOptions(fieldItems);
      } finally {
        setFieldLoading(false);
      }
    })();
  }, [fetchOptions, setFieldLoading, setFieldOptions]);

  const runLoadOption = useCallback(() => {
    const parent = fieldValueRef.current;
    if (!parent) {
      return Promise.resolve();
    }
    setOptionLoading(true);
    return (async () => {
      try {
        const optionItems = await fetchOptions(parent);
        setOptionOptions(optionItems);
      } finally {
        setOptionLoading(false);
      }
    })();
  }, [fetchOptions, setOptionLoading, setOptionOptions]);

  const {
    ensureLoaded: ensureModel,
    resetCache: resetModelCache,
    onExternalDataEvent: onModelExternal,
  } = useLazySelectOptions({
    refetchOnEveryOpen,
    loadFn: runLoadModel,
  });
  const {
    ensureLoaded: ensureField,
    resetCache: resetFieldCache,
    onExternalDataEvent: onFieldExternal,
  } = useLazySelectOptions({
    refetchOnEveryOpen,
    loadFn: runLoadField,
  });
  const {
    ensureLoaded: ensureOption,
    resetCache: resetOptionCache,
    onExternalDataEvent: onOptionExternal,
  } = useLazySelectOptions({
    refetchOnEveryOpen,
    loadFn: runLoadOption,
  });

  const onExternalDataEvent = useCallback(() => {
    onModelExternal();
    onFieldExternal();
    onOptionExternal();
  }, [onModelExternal, onFieldExternal, onOptionExternal]);

  const onResetForm = useCallback(() => {
    resetModelCache();
    resetFieldCache();
    resetOptionCache();
  }, [resetModelCache, resetFieldCache, resetOptionCache]);

  useEffect(() => {
    if (typeof onEvent !== 'function') {
      return;
    }
    onEvent('kaceAuthData', onExternalDataEvent);
    onEvent('redraw', onExternalDataEvent);
    onEvent('resetForm', onResetForm);
    return () => {
      offEvent?.('kaceAuthData', onExternalDataEvent);
      offEvent?.('redraw', onExternalDataEvent);
      offEvent?.('resetForm', onResetForm);
    };
  }, [onEvent, offEvent, onExternalDataEvent, onResetForm]);

  // Inicial: valor precargado, o el usuario abrió el placeholder (hasRequested)
  useEffect(() => {
    if (isInitialized.current) return;
    if (!value?.model && !hasRequestedOptions) return;
    if (initInProgress.current) return;
    initInProgress.current = true;
    const init = async () => {
      try {
        await ensureModel();
        if (value?.model) {
          isInternalChange.current = true;
          setModelValue(value.model);
          modelValueRef.current = value.model;
        }
        if (value?.field) {
          setFieldValue(value.field);
          fieldValueRef.current = value.field;
        }
        if (value?.option) {
          setOptionValue(value.option);
        }
        if (value?.model) {
          await ensureField();
        }
        if (value?.field) {
          await ensureOption();
        }
      } finally {
        isInitialized.current = true;
        initInProgress.current = false;
      }
    };
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- un solo arranque según hasRequested / valor
  }, [
    hasRequestedOptions,
    value?.model,
    value?.field,
    value?.option,
    ensureModel,
    ensureField,
    ensureOption,
  ]);

  // Sync external value (Formio)
  useEffect(() => {
    if (!isInitialized.current || isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    const hasChanges =
      (value?.model || '') !== (model.value || '') ||
      (value?.field || '') !== (field.value || '') ||
      (value?.option || '') !== (option.value || '');
    if (!hasChanges) return;
    setModelValue(value?.model || '');
    setFieldValue(value?.field || '');
    setOptionValue(value?.option || '');
    modelValueRef.current = value?.model || '';
    fieldValueRef.current = value?.field || '';
    const cascade = async () => {
      if (value?.model) {
        await ensureModel();
      }
      if (value?.model) {
        modelValueRef.current = value.model;
        await ensureField();
      }
      if (value?.field) {
        fieldValueRef.current = value.field;
        await ensureOption();
      }
    };
    void cascade();
  }, [
    value,
    ensureModel,
    ensureField,
    ensureOption,
    model.value,
    field.value,
    option.value,
  ]);

  const updateFormIOValue = useCallback(
    (modelVal, fieldVal, optionVal) => {
      if (typeof updateValue === 'function') {
        updateValue({ model: modelVal, field: fieldVal, option: optionVal });
      }
    },
    [updateValue]
  );

  const handleModelChange = useCallback(
    (e) => {
      const newValue = e.target.value;
      isInternalChange.current = true;
      setModelValue(newValue);
      modelValueRef.current = newValue;
      setFieldValue('');
      setFieldOptions([]);
      fieldValueRef.current = '';
      setOptionValue('');
      setOptionOptions([]);
      resetFieldCache();
      resetOptionCache();
      updateFormIOValue(newValue, '', '');
    },
    [
      setModelValue,
      setFieldValue,
      setFieldOptions,
      setOptionValue,
      setOptionOptions,
      updateFormIOValue,
      resetFieldCache,
      resetOptionCache,
    ]
  );

  const handleFieldChange = useCallback(
    (e) => {
      const newValue = e.target.value;
      isInternalChange.current = true;
      setFieldValue(newValue);
      fieldValueRef.current = newValue;
      setOptionValue('');
      setOptionOptions([]);
      resetOptionCache();
      updateFormIOValue(model.value, newValue, '');
    },
    [
      model.value,
      setFieldValue,
      setOptionValue,
      setOptionOptions,
      updateFormIOValue,
      resetOptionCache,
    ]
  );

  const handleOptionChange = useCallback(
    (e) => {
      const newValue = e.target.value;
      isInternalChange.current = true;
      setOptionValue(newValue);
      updateFormIOValue(model.value, field.value, newValue);
    },
    [model.value, field.value, setOptionValue, updateFormIOValue]
  );

  const label = useMemo(
    () => component.label || 'Literales de referencia',
    [component.label]
  );
  const placeholder = useMemo(
    () => component.placeholder || 'Selecciona una opción',
    [component.placeholder]
  );
  return (
    <div className={`form-group ${disabledClassName}`}>
      <FormLabel component={component}>{label}</FormLabel>
      <CascadingSelect
        label={SELECT_LEVELS[0].label}
        loading={model.loading}
        error={model.error}
        value={model.value}
        options={model.options}
        placeholder={placeholder}
        onChange={handleModelChange}
        onOpen={() => {
          if (!hasRequestedOptions) {
            setHasRequestedOptions(true);
          }
          void ensureModel();
        }}
        loadingMessage={SELECT_LEVELS[0].loadingMessage}
        disabled={isDisabled}
      />
      {model.value && (
        <CascadingSelect
          label={SELECT_LEVELS[1].label}
          loading={field.loading}
          error={field.error}
          value={field.value}
          options={field.options}
          placeholder={placeholder}
          onChange={handleFieldChange}
          onOpen={() => {
            void ensureField();
          }}
          loadingMessage={SELECT_LEVELS[1].loadingMessage}
          disabled={isDisabled}
        />
      )}
      {field.value && (
        <CascadingSelect
          label={SELECT_LEVELS[2].label}
          loading={option.loading}
          error={option.error}
          value={option.value}
          options={option.options}
          placeholder={placeholder}
          onChange={handleOptionChange}
          onOpen={() => {
            void ensureOption();
          }}
          loadingMessage={SELECT_LEVELS[2].loadingMessage}
          disabled={isDisabled}
        />
      )}
    </div>
  );
};
