import { useEffect, useMemo, useRef, useState } from 'react';
import '#plugins/kace/components/custom-select/CustomSelect.css';
import '#plugins/kace/shared/styles/kace-select-loader.css';
import '#plugins/kace/shared/styles/kace-disabled.css';
import { useKaceDisabled } from '#plugins/kace/hooks/useKaceDisabled.hook.js';
import './CascadingSelect.css';

/**
 * Desplegable con búsqueda **dentro** del panel (mismo patrón visual que CustomSelect).
 * Los literales usan `id` / `nombre`; el valor del formulario es `id`.
 */
export const CascadingSelect = ({
  label,
  loading,
  error,
  value,
  options = [],
  placeholder,
  onChange,
  onOpen,
  loadingMessage,
  disabled = false,
}) => {
  const {
    disabled: isDisabled,
    readOnlyLock,
    className: disabledClassName,
  } = useKaceDisabled(disabled);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  const showOptionsLoading = Boolean(loading) && !options.length;

  const selectedLabel = useMemo(() => {
    if (value === '' || value === null || value === undefined) {
      return '';
    }
    const o = options.find((x) => String(x.id) === String(value));
    return o?.nombre ? String(o.nombre) : '';
  }, [value, options]);

  const filteredOptions = useMemo(() => {
    if (!search) {
      return options;
    }
    const term = search.toLowerCase();
    return options.filter(
      (opt) =>
        opt?.nombre?.toLowerCase().includes(term) ||
        String(opt?.id).toLowerCase().includes(term)
    );
  }, [options, search]);

  useEffect(() => {
    if (!value || !options.length) {
      return;
    }
    if (!filteredOptions.some((o) => String(o.id) === String(value))) {
      onChange({
        target: { value: '' },
      });
    }
  }, [filteredOptions, value, onChange, options.length]);

  useEffect(() => {
    const handleDocMouseDown = (e) => {
      if (!wrapperRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleDocMouseDown);
    return () => document.removeEventListener('mousedown', handleDocMouseDown);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const clearSearch = () => setSearch('');

  const pick = (id) => {
    const str = id === '' || id === null || id === undefined ? '' : String(id);
    onChange({ target: { value: str } });
    setOpen(false);
    setSearch('');
  };

  const toggleOpen = () => {
    if (isDisabled) {
      return;
    }
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        onOpen?.();
      }
      if (!next) {
        setSearch('');
      }
      return next;
    });
  };

  const controlLabel = showOptionsLoading
    ? 'Cargando…'
    : selectedLabel || placeholder;

  return (
    <div
      ref={wrapperRef}
      className={`custom-dropdown mb-3 ${disabledClassName}`}
    >
      <label className="form-label">
        <small className="text-muted">{label}</small>
      </label>

      {error && (
        <div className="alert alert-danger" role="alert">
          <small>Error: {error}</small>
        </div>
      )}

      <div
        className="custom-dropdown-control"
        onClick={toggleOpen}
        onKeyDown={(e) => {
          if (isDisabled) {
            return;
          }
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleOpen();
          }
        }}
        role="button"
        tabIndex={isDisabled ? -1 : 0}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={showOptionsLoading ? 'text-muted' : undefined}>
          {controlLabel}
        </span>
        <span className="arrow">▾</span>
      </div>

      {open && (
        <div className="custom-dropdown-menu">
          <div className="kace-lit-cascade-search-row">
            <input
              type="text"
              className="custom-dropdown-search"
              placeholder="Buscar…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              disabled={isDisabled || showOptionsLoading}
            />
            {search ? (
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary kace-lit-cascade-search-clear"
                onClick={(e) => {
                  e.stopPropagation();
                  clearSearch();
                }}
                disabled={isDisabled}
              >
                ✕
              </button>
            ) : null}
          </div>

          {loading && (filteredOptions?.length ?? 0) > 0 && (
            <small
              className="kace-select-loader d-block px-2 py-1"
              role="status"
              aria-live="polite"
            >
              {loadingMessage || 'Cargando...'}
            </small>
          )}

          <ul className="custom-dropdown-list">
            {!showOptionsLoading &&
              filteredOptions.map((option, index) => (
                <li
                  key={option.id ?? index}
                  role="option"
                  aria-selected={String(option.id) === String(value)}
                  className={
                    String(option.id) === String(value)
                      ? 'kace-lit-cascade-item-active'
                      : ''
                  }
                  onClick={() => !isDisabled && pick(option.id)}
                >
                  {option.nombre}
                </li>
              ))}

            {showOptionsLoading && (
              <li
                className="empty kace-select-list-loading"
                role="status"
                aria-live="polite"
              >
                Cargando…
              </li>
            )}

            {!showOptionsLoading && !filteredOptions.length && loading && (
              <li
                className="empty kace-select-list-loading"
                role="status"
                aria-live="polite"
              >
                {loadingMessage || 'Cargando...'}
              </li>
            )}

            {!showOptionsLoading &&
              !filteredOptions.length &&
              !loading &&
              Boolean(search?.trim()) && (
                <li className="empty">No se encontraron resultados</li>
              )}
          </ul>
        </div>
      )}
    </div>
  );
};
