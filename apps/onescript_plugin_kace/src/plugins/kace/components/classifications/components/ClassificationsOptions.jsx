import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalize } from '#plugins/kace/utils/normalize.js';

/**
 * @param {Array<{ label?: string, value?: string, options?: unknown[] }>} options
 */
function sortByLabel(options) {
  if (!Array.isArray(options) || !options.length) return [];
  return [...options].sort((a, b) =>
    String(a?.label ?? a?.value ?? '').localeCompare(
      String(b?.label ?? b?.value ?? ''),
      'es',
      {
        sensitivity: 'base',
        numeric: true,
      }
    )
  );
}

const ClassificationsOptions = ({
  userCanEditCase = true,
  options = [],
  isLoading = false,
  /** Nivel1 sin opciones: al abrir el desplegable se pide carga; el menú queda abierto con Cargando…. */
  onNivel1EmptyActivate,
  /**
   * Creación: carga resuelta y sin datos.
   */
  isDeferredEmptyFailed = false,
  nivel = 'nivel1',
  selectedOptions = {},
  handleSelect = () => {},
  classifications = {},
  disabled = false,
  lockedLevelCount = 0,
  renderNested = true,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  /** Pide carga al abrir (hasta que el padre pase isLoading / opciones). */
  const [l1RequestStarted, setL1RequestStarted] = useState(false);
  const wrapRef = useRef(null);

  const isEmptyNivel1 =
    nivel === 'nivel1' && (!Array.isArray(options) || options.length === 0);
  const showLoadingInMenu = Boolean(
    open &&
    isEmptyNivel1 &&
    !isDeferredEmptyFailed &&
    (isLoading || l1RequestStarted)
  );
  const blockCloseWhileLoadingNivel1 = showLoadingInMenu;

  const sortedOptions = useMemo(() => sortByLabel(options), [options]);

  const filteredOptions = useMemo(() => {
    const q = normalize(search);
    if (!q) return sortedOptions;
    return sortedOptions.filter((opt) => {
      const lab = normalize(opt?.label ?? '');
      const val = normalize(String(opt?.value ?? ''));
      return lab.includes(q) || val.includes(q);
    });
  }, [sortedOptions, search]);

  const selectedOption = selectedOptions[nivel]
    ? sortedOptions.find(
        (opt) => String(opt.value) === String(selectedOptions[nivel])
      )
    : null;

  const hasNestedOptions = selectedOption?.options?.length > 0;
  const nextNivel = `nivel${parseInt(nivel.replace('nivel', ''), 10) + 1}`;

  const levelNum = parseInt(nivel.replace('nivel', ''), 10);
  const isLockedLevel =
    Number.isFinite(levelNum) &&
    lockedLevelCount > 0 &&
    levelNum <= lockedLevelCount;
  const selectDisabled = disabled || isLockedLevel;

  const displayLabel =
    selectedOption?.label != null && selectedOption.label !== ''
      ? String(selectedOption.label)
      : selectedOptions[nivel]
        ? String(selectedOptions[nivel])
        : '';

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) {
        if (blockCloseWhileLoadingNivel1) {
          return;
        }
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, blockCloseWhileLoadingNivel1]);

  useEffect(() => {
    if (selectDisabled) {
      setOpen(false);
    }
  }, [selectDisabled]);
  const label = Object.entries(classifications).find(([key]) =>
    key.includes(nivel.slice(-1))
  )?.[1];
  useEffect(() => {
    setSearch('');
  }, [nivel, options]);

  useEffect(() => {
    if (!isEmptyNivel1) {
      setL1RequestStarted(false);
    }
  }, [isEmptyNivel1]);

  useEffect(() => {
    if (isDeferredEmptyFailed) {
      setL1RequestStarted(false);
    }
  }, [isDeferredEmptyFailed]);

  useEffect(() => {
    if (!isLoading) {
      setL1RequestStarted(false);
    }
  }, [isLoading]);

  const handleToggle = useCallback(() => {
    if (selectDisabled) {
      return;
    }
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        setSearch('');
        if (
          nivel === 'nivel1' &&
          (!Array.isArray(options) || !options.length)
        ) {
          onNivel1EmptyActivate?.();
          setL1RequestStarted(true);
        }
      }
      return next;
    });
  }, [nivel, onNivel1EmptyActivate, options, selectDisabled]);

  const handlePick = useCallback(
    (value) => {
      handleSelect(nivel, value);
      setOpen(false);
      setSearch('');
    },
    [handleSelect, nivel]
  );

  if (!Array.isArray(options) || options.length === 0) {
    if (nivel !== 'nivel1') {
      return null;
    }
  }

  if (isEmptyNivel1 && isDeferredEmptyFailed) {
    const showLabel =
      label != null && label !== '' ? String(label) : 'Clasificación';
    return (
      <div>
        <div className="form-group classifications-dropdown-wrap" ref={wrapRef}>
          <label className="font-weight-medium">{showLabel}</label>
          <div
            className="form-control classifications-dropdown-control classifications-dropdown-control--disabled text-muted"
            style={{ minHeight: '2.4rem' }}
          >
            No se encontraron clasificaciones disponibles
          </div>
        </div>
      </div>
    );
  }
  if (isEmptyNivel1 && selectDisabled) {
    const showLabel =
      label != null && label !== '' ? String(label) : 'Clasificación';
    return (
      <div>
        <div className="form-group classifications-dropdown-wrap" ref={wrapRef}>
          <label className="font-weight-medium">{showLabel}</label>
          <div className="form-control classifications-dropdown-control classifications-dropdown-control--disabled">
            —
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="form-group classifications-dropdown-wrap" ref={wrapRef}>
        <label className="font-weight-medium">{label}</label>
        {selectDisabled ? (
          <div className="form-control classifications-dropdown-control classifications-dropdown-control--disabled">
            {displayLabel || '—'}
          </div>
        ) : (
          <>
            <div
              className="form-control classifications-dropdown-control"
              onClick={handleToggle}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleToggle();
                }
              }}
              role="button"
              tabIndex={0}
              aria-expanded={open}
              aria-haspopup="listbox"
            >
              <span className="classifications-dropdown-control-label text-muted">
                {selectedOptions[nivel] && displayLabel
                  ? displayLabel
                  : isEmptyNivel1 && (isLoading || l1RequestStarted)
                    ? 'Cargando…'
                    : 'Elige una opción'}
              </span>
              <span className="classifications-dropdown-arrow" aria-hidden>
                ▾
              </span>
            </div>
            {open && (
              <div className="classifications-dropdown-menu">
                {showLoadingInMenu ? (
                  <ul className="classifications-dropdown-list" role="listbox">
                    <li
                      className="classifications-dropdown-item classifications-dropdown-item--loading d-flex align-items-center justify-content-center"
                      style={{ minHeight: '2.5rem' }}
                    >
                      <div
                        className="spinner-border spinner-border-sm text-primary"
                        role="status"
                      />
                      <span className="ms-2 text-muted" aria-live="polite">
                        Cargando…
                      </span>
                    </li>
                  </ul>
                ) : (
                  <>
                    <input
                      type="search"
                      className="form-control classifications-dropdown-search"
                      placeholder="Buscar clasificación…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onMouseDown={(e) => e.stopPropagation()}
                      autoComplete="off"
                      autoFocus
                    />
                    <ul
                      className="classifications-dropdown-list"
                      role="listbox"
                    >
                      <li
                        className="classifications-dropdown-item classifications-dropdown-item--placeholder"
                        role="option"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handlePick('')}
                      >
                        Elige una opción
                      </li>
                      {filteredOptions.map((opt, index) => {
                        const isActive =
                          String(selectedOptions[nivel] ?? '') ===
                          String(opt.value);
                        return (
                          <li
                            key={`${nivel}-${String(opt.value)}-${index}`}
                            className={`classifications-dropdown-item${isActive ? ' is-active' : ''}`}
                            role="option"
                            aria-selected={isActive}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handlePick(opt.value)}
                          >
                            {opt.label}
                          </li>
                        );
                      })}
                      {filteredOptions.length === 0 && (
                        <li className="classifications-dropdown-empty">
                          Sin coincidencias
                        </li>
                      )}
                    </ul>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {renderNested && selectedOption && hasNestedOptions && (
        <ClassificationsOptions
          options={selectedOption.options}
          nivel={nextNivel}
          selectedOptions={selectedOptions}
          handleSelect={handleSelect}
          classifications={classifications}
          userCanEditCase={userCanEditCase}
          disabled={disabled}
          lockedLevelCount={lockedLevelCount}
          renderNested={renderNested}
        />
      )}
    </div>
  );
};

export default ClassificationsOptions;
