import React, { useState } from 'react';
import '#plugins/kace/shared/styles/kace-select-loader.css';

const MultiSelectBase = ({
  name,
  options,
  selected,
  onChange,
  placeholder = 'Seleccione una opción',
  loading = false,
  onRequestOpen = undefined,
  onMenuScroll = undefined,
  disableClientFilter = false,
  searchInputRef = undefined,
  searchTerm: controlledSearchTerm = undefined,
  onSearchTermChange = undefined,
  onOpenChange = undefined,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [internalSearch, setInternalSearch] = useState('');
  const isSearchControlled = controlledSearchTerm !== undefined;
  const searchTerm = isSearchControlled ? controlledSearchTerm : internalSearch;

  const toggleOption = (value) => {
    const isSelected = selected.some((item) => item.value === value.value);
    const newSelected = isSelected
      ? selected.filter((item) => item.value !== value.value)
      : [...selected, value];
    onChange(name, newSelected);
  };

  const selectAll = () => {
    onChange(
      name,
      options.map((opt) => opt)
    );
  };

  const clearAll = () => {
    onChange(name, []);
  };

  const filteredOptions = disableClientFilter
    ? options
    : options.filter((opt) =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase())
      );

  const removeItem = (value, e) => {
    e.stopPropagation();
    onChange(
      name,
      selected.filter((item) => item.value !== value.value)
    );
  };

  return (
    <div className="position-relative" style={{ width: '100%' }}>
      <div
        className="form-control d-flex align-items-start kace-multiselect-control"
        style={{
          cursor: 'pointer',
          minHeight: '38px',
          padding: '4px 8px',
          overflow: 'hidden',
          width: '100%',
          boxSizing: 'border-box',
        }}
        onClick={() => {
          setIsOpen((prev) => {
            const next = !prev;
            if (!prev) {
              onRequestOpen?.();
            }
            onOpenChange?.(next);
            return next;
          });
        }}
      >
        <div
          className="d-flex flex-wrap flex-grow-1"
          style={{
            gap: '6px',
            maxHeight: '80px',
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingRight: '8px',
            width: 0,
            minWidth: 0,
            boxSizing: 'border-box',
          }}
        >
          {selected.length === 0 ? (
            <span className="text-muted">{placeholder}</span>
          ) : (
            selected.map((item) => {
              const option = options.find((opt) => opt.value === item.value);
              const label = option?.label || item.label || item;
              return (
                <span
                  key={item.value || item}
                  className="badge bg-primary d-inline-flex align-items-center"
                  style={{
                    padding: '4px 8px',
                    margin: 0,
                    fontSize: '0.875rem',
                    maxWidth: 'calc(100% - 12px)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flexShrink: 1,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '180px',
                      display: 'inline-block',
                    }}
                  >
                    {label}
                  </span>
                  <i
                    className="fa fa-times ms-2"
                    aria-hidden="true"
                    onClick={(e) => removeItem(item, e)}
                    style={{
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      flexShrink: 0,
                    }}
                  />
                </span>
              );
            })
          )}
        </div>
        <i
          className="fa fa-chevron-down ms-2"
          aria-hidden="true"
          style={{
            flexShrink: 0,
            marginTop: '2px',
            alignSelf: 'flex-start',
          }}
        />
      </div>

      {isOpen && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
            }}
            onClick={() => {
              setIsOpen(false);
              onOpenChange?.(false);
            }}
          />
          <div
            className="card shadow-lg"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 1000,
              maxHeight: '300px',
              marginTop: '4px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              className="card-body p-2 d-flex flex-column"
              style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
            >
              <div
                className="kace-multiselect-menu-sticky flex-shrink-0"
                style={{
                  background: '#fff',
                  paddingBottom: '8px',
                  marginBottom: '8px',
                  borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
                }}
              >
                <input
                  ref={searchInputRef}
                  type="text"
                  className="form-control form-control-sm mb-2"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => {
                    if (isSearchControlled) {
                      onSearchTermChange?.(e);
                    } else {
                      setInternalSearch(e.target.value);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="mb-2 pb-2 border-bottom">
                  <button
                    className="btn btn-link btn-sm text-decoration-none p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectAll();
                    }}
                    type="button"
                  >
                    Seleccionar todos
                  </button>
                  {selected.length > 0 && (
                    <>
                      <span className="mx-2">|</span>
                      <button
                        className="btn btn-link btn-sm text-decoration-none p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearAll();
                        }}
                        type="button"
                      >
                        Limpiar
                      </button>
                    </>
                  )}
                </div>
                {loading && filteredOptions.length === 0 && (
                  <div
                    className="kace-select-loader mb-2"
                    role="status"
                    aria-live="polite"
                  >
                    <small>Cargando…</small>
                  </div>
                )}
                {loading && filteredOptions.length > 0 && (
                  <div
                    className="kace-select-loader mb-1"
                    role="status"
                    aria-live="polite"
                  >
                    <small>Cargando...</small>
                  </div>
                )}
              </div>
              <div
                data-testid="kace-multiselect-scroll-menu"
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                }}
                onScroll={(e) => onMenuScroll?.(e)}
              >
                {filteredOptions.map((option) => (
                  <div
                    key={option.value}
                    className="form-check"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`${name}-${option.value}`}
                      checked={selected.some(
                        (item) => item.value === option.value
                      )}
                      onChange={() => toggleOption(option)}
                    />
                    <label
                      className="form-check-label w-100"
                      htmlFor={`${name}-${option.value}`}
                      style={{ cursor: 'pointer' }}
                    >
                      {option.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MultiSelectBase;
