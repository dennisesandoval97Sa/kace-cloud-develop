import useDynamicSelect from '#plugins/kace/hooks/useDynamicSelect.js';
import { normalizeText } from '#plugins/kace/shared/ProcessData.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import './OsSelect.css';
import { normalize } from '#plugins/kace/utils/normalize.js';
import { ensureSelectedOption } from '#plugins/kace/shared/EnsureSelectedOption.js';
import '#plugins/kace/shared/styles/kace-disabled.css';
import '#plugins/kace/shared/styles/kace-select-loader.css';
import { useKaceDisabled } from '#plugins/kace/hooks/useKaceDisabled.hook.js';
import { FormLabel } from '#plugins/kace/shared/ui/FormLabel.jsx';

/**
 * @param {{ component: { [x: string]: unknown, refetchOnEveryOpen?: boolean }, value: unknown, updateValue: Function, onEvent?: (e: string, fn: (data: unknown) => void) => void, disabled?: boolean }} props
 */
export const OsSelect = ({
  component,
  value,
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
  const { states, actions, ensureLoaded, resetCache, onExternalDataEvent } =
    useDynamicSelect({
      value,
      component,
      updateValue,
    });

  const {
    options: hookOptions,
    loading,
    error,
    selectedValue,
    isInternalChange,
  } = states;

  const { setSelectedValue } = actions;

  const [open, setOpen] = useState(false);
  const [allOptions, setAllOptions] = useState([]);
  const [options, setOptions] = useState([]);
  const [search, setSearch] = useState('');

  const wrapperRef = useRef(null);
  const isMounted = useRef(true);

  const literalCondition = component.endpoint === '/literals';

  const displayOptions = useMemo(
    () =>
      ensureSelectedOption(allOptions, selectedValue, {
        getValue: (option) =>
          literalCondition ? option?.label : option?.value,
        createTempOption: (optionValue) => ({
          label: String(optionValue),
          value: String(optionValue),
        }),
      }),
    [allOptions, selectedValue, literalCondition]
  );

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!hookOptions?.length) {
      return;
    }
    const safe = [...hookOptions];
    setAllOptions(safe);
    setOptions(safe);
  }, [hookOptions]);

  useEffect(() => {
    if (!isInternalChange.current && isMounted.current) {
      const normalized =
        value !== null && value !== undefined ? String(value) : '';
      setSelectedValue(normalized);
    }
    isInternalChange.current = false;
  }, [value, setSelectedValue]);

  useEffect(() => {
    if (!displayOptions.length) {
      return;
    }
    const q = normalize(search);
    if (!q) {
      setOptions(displayOptions);
      return;
    }
    setOptions(
      displayOptions.filter(
        (o) =>
          normalize(o?.label).includes(q) || normalize(o?.value).includes(q)
      )
    );
  }, [search, displayOptions]);

  const handleSelect = (option) => {
    const val = literalCondition ? option.label : option.value;
    setSelectedValue(val);
    updateValue(val);
    setOpen(false);
    setSearch('');
  };

  useEffect(() => {
    const close = (e) => {
      if (!wrapperRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const label = useMemo(() => component.label || 'Literal', [component.label]);

  const selectedLabel = useMemo(() => {
    if (!selectedValue) {
      return '';
    }
    const found = displayOptions.find((o) => {
      const val = literalCondition ? o.label : o.value;
      return String(val) === String(selectedValue);
    });
    return found?.label || String(selectedValue);
  }, [selectedValue, displayOptions, literalCondition]);

  useEffect(() => {
    if (typeof onEvent !== 'function') {
      return;
    }
    onEvent('kaceAuthData', onExternalDataEvent);
    onEvent('redraw', onExternalDataEvent);
    onEvent('resetForm', resetCache);
    return () => {
      offEvent?.('kaceAuthData', onExternalDataEvent);
      offEvent?.('redraw', onExternalDataEvent);
      offEvent?.('resetForm', resetCache);
    };
  }, [onEvent, offEvent, onExternalDataEvent, resetCache]);

  return (
    <div
      ref={wrapperRef}
      className={`form-group os-dropdown ${disabledClassName}`}
    >
      <FormLabel component={component}>{label}</FormLabel>

      <div
        className="os-dropdown-control"
        onClick={() => {
          if (isDisabled) {
            return;
          }
          if (!open) {
            void ensureLoaded();
          }
          setOpen((prev) => !prev);
        }}
      >
        {selectedLabel || component.placeholder || 'Elige una opción'}
        <span className="arrow">▾</span>
      </div>

      {open && (
        <div className="os-dropdown-menu">
          <input
            className="os-dropdown-search"
            placeholder="Escriba para buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            disabled={isDisabled || loading}
          />
          {loading && options.length > 0 && (
            <small
              className="kace-select-loader d-block"
              role="status"
              aria-live="polite"
            >
              Cargando...
            </small>
          )}
          {error && <small className="text-danger">Error</small>}
          <ul className="os-dropdown-list">
            {options.map((option) => (
              <li
                key={option.value}
                onClick={() => !isDisabled && handleSelect(option)}
              >
                {normalizeText(option.label)}
              </li>
            ))}
            {loading && !options.length && (
              <li
                className="empty kace-select-list-loading"
                role="status"
                aria-live="polite"
              >
                Cargando…
              </li>
            )}
            {!loading && !options.length && (
              <li className="empty">No se encontraron resultados</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
