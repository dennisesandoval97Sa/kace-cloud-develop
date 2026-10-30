import { useEffect, useMemo, useRef } from 'react';
import '#plugins/kace/components/custom-select/CustomSelect.css';
import '#plugins/kace/shared/styles/kace-select-loader.css';
import '#plugins/kace/shared/styles/kace-disabled.css';
import { useBulkActionModalSelect } from '#plugins/kace/hooks/useBulkActionModalSelect.js';
import { useKaceDisabled } from '#plugins/kace/hooks/useKaceDisabled.hook.js';
import { BULK_ACTION_MODAL_SELECT_PLACEHOLDER } from './lib/data-table.constants.js';

export function BulkActionModalSelect({
  id,
  fieldKey,
  fieldLabel,
  placeholder,
  value,
  options,
  showWhenCode,
  evaluateShowWhen,
  setSelectOptions,
  onChange,
  disabled,
  dependencySignature,
  localSearchOnly = false,
  readOnlyStoreKey,
}) {
  const {
    disabled: isDisabled,
    readOnlyLock,
    className: disabledClassName,
  } = useKaceDisabled(disabled, { readOnlyStoreKey });
  const wrapperRef = useRef(null);
  const {
    open,
    openDropdown,
    closeDropdown,
    searchTerm,
    setSearchTerm,
    loading,
    filteredOptions,
    onDropdownScroll,
    resetForDependencyChange,
  } = useBulkActionModalSelect({
    fieldKey,
    options,
    value,
    showWhenCode,
    evaluateShowWhen,
    setSelectOptions,
    dependencySignature,
    disabled: isDisabled,
    localSearchOnly,
  });

  useEffect(() => {
    resetForDependencyChange();
  }, [dependencySignature, resetForDependencyChange]);

  useEffect(() => {
    const onDocMouseDown = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        closeDropdown();
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [closeDropdown]);

  const resolvedPlaceholder = useMemo(
    () => placeholder || BULK_ACTION_MODAL_SELECT_PLACEHOLDER,
    [placeholder]
  );

  const selectedLabel = useMemo(() => {
    const list = Array.isArray(options) ? options : [];
    const found = list.find(
      (option) => String(option?.value ?? '') === String(value ?? '')
    );
    if (found?.label) {
      return found.label;
    }
    if (value === null || value === undefined || value === '') {
      return '';
    }
    return String(value);
  }, [options, value]);

  return (
    <div ref={wrapperRef} className={`custom-dropdown ${disabledClassName}`}>
      <div
        className="custom-dropdown-control"
        onClick={() => {
          if (open) {
            closeDropdown();
            return;
          }
          openDropdown();
        }}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-label={fieldLabel || fieldKey}
      >
        {selectedLabel || resolvedPlaceholder}
        <span className="arrow">▾</span>
      </div>
      {open && (
        <div className="custom-dropdown-menu">
          <input
            className="custom-dropdown-search"
            placeholder="Buscar..."
            aria-label={fieldLabel || fieldKey}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            disabled={isDisabled}
            autoFocus
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
          <ul
            id={`${id}-listbox`}
            role="listbox"
            className="custom-dropdown-list"
            onScroll={onDropdownScroll}
            data-testid={`bulk-modal-select-${fieldKey}`}
          >
            {filteredOptions.map((option) => {
              const selected =
                String(option?.value ?? '') === String(value ?? '');
              return (
                <li
                  key={String(option?.value ?? '')}
                  role="option"
                  aria-selected={selected}
                  className={selected ? 'selected' : undefined}
                  onClick={() => {
                    if (isDisabled) {
                      return;
                    }
                    onChange(option?.value ?? '');
                    closeDropdown();
                  }}
                >
                  {option?.label ?? option?.value}
                </li>
              );
            })}
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
              <li className="empty" role="status" aria-live="polite">
                No se encontraron resultados
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
