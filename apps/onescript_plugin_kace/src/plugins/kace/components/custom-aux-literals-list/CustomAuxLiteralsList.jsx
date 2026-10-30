import './CustomAuxLiteralsList.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { mapToLabelValue } from '#plugins/kace/shared/MapToLabelValues.js';
import { evaluateKace } from '#plugins/kace/shared/evaluateKace.js';
import { ensureSelectedOption } from '#plugins/kace/shared/EnsureSelectedOption.js';
import '#plugins/kace/shared/styles/kace-disabled.css';
import { KaceEngine } from '#plugins/kace/KaceEngine.js';
import { useKaceDisabled } from '#plugins/kace/hooks/useKaceDisabled.hook.js';
import { FormLabel } from '#plugins/kace/shared/ui/FormLabel.jsx';

/**
 * @typedef Props
 * @prop {{ [x: string]: unknown }} component
 * @prop {(value: any, flags: any, source: any) => any} updateValue
 * @prop {boolean} [disabled=false] - Disables interactions when Form.io sets disable
 */

export const CustomAuxLiteralsList = ({
  component,
  value,
  updateValue,
  disabled = false,
}) => {
  const {
    disabled: isDisabled,
    readOnlyLock,
    className: disabledClassName,
  } = useKaceDisabled(disabled);
  const [selectedValue, setSelectedValue] = useState('');
  const [options, setOptions] = useState([]);
  const [filteredOptions, setFilteredOptions] = useState([]);

  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState([]);
  const [hasRequestedOptions, setHasRequestedOptions] = useState(false);

  const hasInitialValue = useMemo(() => {
    if (value === null || value === undefined || value === '') {
      return false;
    }
    return String(value).trim() !== '';
  }, [value]);

  const kaceEngine = KaceEngine();
  const storeService = kaceEngine.getService('storeService');
  const auxService = kaceEngine.getService('aux');
  const selectedGroupId = storeService.get('user.user_data.user.grupo_activo');

  const safeOptions = useMemo(
    () => ensureSelectedOption(options, value),
    [options, value]
  );

  const handleChange = useCallback(
    (event) => {
      const val = event.target.value;

      setSelectedValue(val);
      updateValue(val);
    },
    [updateValue]
  );

  const handleSearch = (e) => {
    setSearch(e.target.value);
  };

  useEffect(() => {
    if (!filters.length || !component.entity) return;
    if (!hasRequestedOptions && !hasInitialValue) return;

    setLoading(true);
    auxService
      .fetchAuxLiteralList({ entity: component.entity, filter: filters })
      .then((items) => {
        const mapped = mapToLabelValue(items, component.path_values);

        const unique = Array.from(
          new Map(mapped.map((o) => [o.value, o])).values()
        );

        setOptions(unique);
        setFilteredOptions(unique);
      })
      .catch(() => {
        setError('Se produjo un error al obtener las opciones');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [
    filters,
    component.entity,
    component.path_values,
    hasRequestedOptions,
    hasInitialValue,
  ]);

  useEffect(() => {
    if (!component.code) return;

    try {
      evaluateKace(component.code, {
        selected_group: selectedGroupId,
        setFilters,
      });
    } catch {
      // ignore
    }
  }, [component.code, selectedGroupId]);

  useEffect(() => {
    if (!value) {
      setSelectedValue('');
      return;
    }

    setSelectedValue(String(value));
  }, [value]);

  useEffect(() => {
    if (!search) {
      setFilteredOptions(safeOptions);
      return;
    }

    const text = search.toLowerCase();

    const filtered = safeOptions.filter((option) =>
      option.label?.toLowerCase().includes(text)
    );

    setFilteredOptions(filtered);
  }, [search, safeOptions]);

  const label = useMemo(
    () => component.label || 'Reference Literals',
    [component.label]
  );

  return (
    <div className={`form-group ${disabledClassName}`}>
      <FormLabel component={component}>{label}</FormLabel>

      {/* Search Input */}
      <input
        type="text"
        className="form-control mb-2"
        placeholder="Search..."
        value={search}
        onChange={handleSearch}
        disabled={isDisabled}
      />

      {loading && (
        <div className="text-muted mb-2">
          <small>Cargando Opciones...</small>
        </div>
      )}

      {error && (
        <div className="alert alert-danger" role="alert">
          <small>Error: {error}</small>
        </div>
      )}

      <select
        className="form-control"
        onChange={handleChange}
        onClick={() => {
          if (!hasRequestedOptions) {
            setHasRequestedOptions(true);
          }
        }}
        value={selectedValue}
        disabled={
          isDisabled ||
          loading ||
          (hasRequestedOptions && filteredOptions.length === 0)
        }
      >
        <option value="">
          {loading
            ? 'Cargando...'
            : component.placeholder || 'Elige una opción'}
        </option>

        {filteredOptions.map((option, index) => (
          <option key={option.value || index} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};
