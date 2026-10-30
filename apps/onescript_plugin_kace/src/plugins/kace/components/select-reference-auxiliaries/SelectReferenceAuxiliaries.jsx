import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import './SelectReferenceAuxiliaries.css';
import { buildLevelsConfig } from '#plugins/kace/shared/ProcessData.js';
import { ensureSelectedOption } from '#plugins/kace/shared/EnsureSelectedOption.js';
import '#plugins/kace/shared/styles/kace-disabled.css';
import { useKaceDisabled } from '#plugins/kace/hooks/useKaceDisabled.hook.js';
import '#plugins/kace/shared/styles/kace-select-loader.css';
import { KaceEngine } from '#plugins/kace/KaceEngine.js';
import { useReopenNativeSelectOnLoad } from '#plugins/kace/hooks/useReopenNativeSelectOnLoad.hook.js';
import { FormLabel } from '#plugins/kace/shared/ui/FormLabel.jsx';

/**
 * Carga perezosa en cascada: el número de niveles depende de la configuración (`relation_entity`),
 * no se puede invocar un `useLazySelectOptions` por nivel en un bucle (reglas de hooks de React).
 * Se usa `staleByLevelRef` + `ensureLevelOpen` + `loadLevelOptions` con la misma semántica (caché, refetch).
 * Las peticiones a la API **solo** se disparan al intentar abrir el desplegable (mousedown, teclas;
 * sin `click` para no refetch al cerrar el menú nativo),
 * no al montar ni al recibir foco. `kaceAuthData` / `redraw` solo marcan niveles obsoletos (próxima apertura).
 */
const SELECT_OPTION_CONFIG = {
  getValue: (option) => option,
  createTempOption: (optionValue) => String(optionValue),
};

/**
 * Reads the display value for a hierarchy level from the Form.io submission object
 * (e.g. `{ municipio: "Santa Fe de Antioquia" }` → `"Santa Fe de Antioquia"` for that entity key).
 *
 * @param {unknown} submissionValue
 * @param {string} levelEntity
 * @returns {string}
 */
function getLevelStringValue(submissionValue, levelEntity) {
  try {
    if (
      submissionValue === null ||
      submissionValue === undefined ||
      typeof submissionValue !== 'object'
    ) {
      return '';
    }
    const raw = submissionValue[levelEntity];
    if (raw === null || raw === undefined || raw === '') {
      return '';
    }
    return String(raw);
  } catch {
    return '';
  }
}

/**
 * When entity keys in the submission no longer match `levelEntity` (config changed),
 * maps stored values by position: first non-empty value → level 0, etc.
 *
 * @param {unknown} submissionValue
 * @param {number} levelIndex
 * @returns {string}
 */
function getPositionalSubmissionValue(submissionValue, levelIndex) {
  try {
    if (
      submissionValue === null ||
      submissionValue === undefined ||
      typeof submissionValue !== 'object'
    ) {
      return '';
    }
    const values = Object.values(submissionValue).filter(
      (v) => v !== null && v !== undefined && v !== ''
    );
    const raw = values[levelIndex];
    if (raw === null || raw === undefined || raw === '') {
      return '';
    }
    return String(raw);
  } catch {
    return '';
  }
}

/**
 * Resolves the display value for a level: current entity key → positional values in the object →
 * persisted preset (survives entity / key renames).
 *
 * @param {unknown} submissionValue
 * @param {string} levelEntity
 * @param {number} levelIndex
 * @param {{ current: string[] }} presetByLevelIndexRef
 * @returns {string}
 */
function resolveLevelDisplayValue(
  submissionValue,
  levelEntity,
  levelIndex,
  presetByLevelIndexRef
) {
  try {
    const direct = getLevelStringValue(submissionValue, levelEntity);
    if (direct) {
      return direct;
    }
    const positional = getPositionalSubmissionValue(
      submissionValue,
      levelIndex
    );
    if (positional) {
      return positional;
    }
    const persisted = presetByLevelIndexRef.current[levelIndex];
    return persisted != null && persisted !== '' ? String(persisted) : '';
  } catch {
    return '';
  }
}

/**
 * @typedef Props
 * @prop {{ [x: string]: unknown }} component - `this.component` properties
 * @prop {Object} value - Current value from Formio (object with entity values like { entity1: 'value1', entity2: 'value2' })
 * @prop {(value: any, flags: any, source: any) => any} updateValue - Function to update `this.value` (formio component instance) value
 * @prop {((ev: string, fn: () => void) => void) | undefined} onEvent - Form.io event hook (`this.on`); register cache invalidation / refetch
 * @prop {boolean} [disabled=false] - Disables interactions when Form.io sets disable
 */
export const SelectReferenceAuxiliaries = ({
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
  /** Persists chosen/preset strings per level index when `entity` / keys in submission change. */
  const presetByLevelIndexRef = useRef([]);
  const staleByLevelRef = useRef(/** @type {boolean[]} */ ([]));
  const selectStatesRef = useRef(null);
  const inFlightByLevel = useRef(/** @type {Record<number, boolean>} */ ({}));
  const firstLevelSelectRef = useRef(
    /** @type {HTMLSelectElement | null} */ (null)
  );

  // Parse configuration from component
  const entity = component.entity || '';
  const field = component.field || '';
  const relationEntity = component.relation_entity || { items: [] };
  const refetchOnEveryOpen = Boolean(component?.refetchOnEveryOpen);
  const refetchOnEveryOpenRef = useRef(refetchOnEveryOpen);
  refetchOnEveryOpenRef.current = refetchOnEveryOpen;

  // Build levels configuration dynamically
  const levels = buildLevelsConfig(entity, field, relationEntity);

  const kaceEngine = KaceEngine();
  const auxService = kaceEngine.getService('aux');

  const levelsSignature = useMemo(() => {
    if (!entity) {
      return '';
    }
    const items = relationEntity?.items;
    const itemsPart = Array.isArray(items)
      ? items.map((it) => `${it.entity}:${it.path || ''}`).join(',')
      : '';
    return `${entity}|${field}|${itemsPart}`;
  }, [entity, field, relationEntity]);

  const isInternalChange = useRef(false);

  // Dynamic state for all select levels - initialize with value from Formio
  const [selectStates, setSelectStates] = useState(() =>
    levels.map((level, index) => {
      const levelValue = resolveLevelDisplayValue(
        value,
        level.entity,
        index,
        presetByLevelIndexRef
      );
      return {
        value: levelValue,
        options: ensureSelectedOption([], levelValue, SELECT_OPTION_CONFIG),
        loading: false,
        error: null,
      };
    })
  );

  useEffect(() => {
    selectStatesRef.current = selectStates;
  }, [selectStates]);

  const firstLevel = selectStates[0];
  useReopenNativeSelectOnLoad({
    loading: Boolean(firstLevel?.loading),
    hasOptions: (firstLevel?.options?.length ?? 0) > 0,
    selectRef: firstLevelSelectRef,
  });

  // Persist presets from submission (direct key or positional) whenever value or hierarchy config updates
  useEffect(() => {
    if (!levels.length) {
      return;
    }
    try {
      if (value && typeof value === 'object') {
        levels.forEach((level, index) => {
          const direct = getLevelStringValue(value, level.entity);
          const positional = getPositionalSubmissionValue(value, index);
          const next = direct || positional;
          if (next) {
            presetByLevelIndexRef.current[index] = next;
          }
        });
      }
    } catch {
      /* noop */
    }
  }, [value, levelsSignature]);

  // Reconcile state when entity / relation levels change so presets and options survive reconfiguration
  useEffect(() => {
    if (levels.length === 0) {
      return;
    }
    setSelectStates((prev) =>
      levels.map((level, index) => {
        const levelValue = resolveLevelDisplayValue(
          value,
          level.entity,
          index,
          presetByLevelIndexRef
        );
        const prevSlot = prev[index];
        return {
          value: levelValue,
          options: ensureSelectedOption(
            prevSlot?.options || [],
            levelValue,
            SELECT_OPTION_CONFIG
          ),
          loading: false,
          error: null,
        };
      })
    );
    staleByLevelRef.current = new Array(levels.length).fill(true);
  }, [levelsSignature]);

  // Sync external value changes (Form.io): actualiza valores y opciones mínimas; la API se consulta
  // solo cuando el usuario abre un nivel (`ensureLevelOpen`).
  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }

    const hasChanges = levels.some((level, index) => {
      const currentValue = selectStates[index]?.value || '';
      const newValue = resolveLevelDisplayValue(
        value,
        level.entity,
        index,
        presetByLevelIndexRef
      );
      return currentValue !== newValue;
    });

    if (hasChanges && value && typeof value === 'object') {
      staleByLevelRef.current = new Array(levels.length).fill(true);
      setSelectStates((prev) =>
        levels.map((level, index) => {
          const nextValue = resolveLevelDisplayValue(
            value,
            level.entity,
            index,
            presetByLevelIndexRef
          );
          return {
            ...prev[index],
            value: nextValue,
            options: ensureSelectedOption(
              prev[index]?.options || [],
              nextValue,
              SELECT_OPTION_CONFIG
            ),
          };
        })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Loads options for a specific level
  const loadLevelOptions = useCallback(
    async (levelIndex, parentValue = null) => {
      const level = levels[levelIndex];
      if (!level) return;
      if (
        inFlightByLevel.current[levelIndex] &&
        !refetchOnEveryOpenRef.current
      ) {
        return;
      }
      inFlightByLevel.current[levelIndex] = true;

      setSelectStates((prev) => {
        const newStates = [...prev];
        newStates[levelIndex] = {
          ...newStates[levelIndex],
          loading: true,
          error: null,
        };
        return newStates;
      });

      let filter = null;
      if (level.path && parentValue) {
        filter = {
          path: level.path,
          value: parentValue,
        };
      }

      try {
        const options = await auxService.fetchAuxiliaryData({
          entity: level.entity,
          field: level.field,
          filter: filter,
          forceRefresh: refetchOnEveryOpenRef.current,
        });
        while (staleByLevelRef.current.length <= levelIndex) {
          staleByLevelRef.current.push(true);
        }
        staleByLevelRef.current[levelIndex] = false;
        setSelectStates((prev) => {
          const newStates = [...prev];
          const selectedAtLevel = newStates[levelIndex]?.value || '';
          const mergedOptions = ensureSelectedOption(
            options || [],
            selectedAtLevel,
            SELECT_OPTION_CONFIG
          );
          newStates[levelIndex] = {
            ...newStates[levelIndex],
            options: mergedOptions,
            loading: false,
            error: null,
          };
          return newStates;
        });
      } catch (error) {
        setSelectStates((prev) => {
          const newStates = [...prev];
          newStates[levelIndex] = {
            ...newStates[levelIndex],
            loading: false,
            error: error?.message || 'Error al cargar las opciones',
          };
          return newStates;
        });
      } finally {
        inFlightByLevel.current[levelIndex] = false;
      }
    },
    [levels, auxService]
  );

  const markChildLevelsStale = useCallback(
    (fromIndexExclusive) => {
      while (staleByLevelRef.current.length < levels.length) {
        staleByLevelRef.current.push(true);
      }
      for (let j = fromIndexExclusive + 1; j < levels.length; j++) {
        staleByLevelRef.current[j] = true;
      }
    },
    [levels.length]
  );

  const ensureLevelOpen = useCallback(
    (levelIndex) => {
      if (isDisabled) {
        return;
      }
      if (levelIndex < 0 || levelIndex >= levels.length) {
        return;
      }
      if (levelIndex > 0) {
        const parentVal = selectStatesRef.current?.[levelIndex - 1]?.value;
        if (!parentVal) {
          return;
        }
      }
      if (!refetchOnEveryOpen) {
        if (staleByLevelRef.current[levelIndex] === false) {
          return;
        }
      }
      const parentValue =
        levelIndex > 0
          ? selectStatesRef.current?.[levelIndex - 1]?.value
          : null;
      if (levelIndex > 0 && !parentValue) {
        return;
      }
      void loadLevelOptions(levelIndex, parentValue);
    },
    [isDisabled, levels.length, refetchOnEveryOpen, loadLevelOptions]
  );

  /**
   * Nativo `<select>`: al reabrir, muchos navegadores no vuelven a disparar `mousedown`; `click` y
   * teclas de apertura suelen dispararse. No usamos `focus` para no cargar al tabular sin abrir.
   * Solo eventos confiables: `useReopenNativeSelectOnLoad` usa APIs programáticas (`isTrusted === false`).
   */
  const handleSelectOpenIntent = useCallback(
    (levelIndex, e) => {
      if (e && e.isTrusted === false) {
        return;
      }
      if (isDisabled) {
        return;
      }
      // Con refetch en cada apertura: no disparar al cerrar el menú nativo (p. ej. `click` tras
      // elegir opción) ni al pulsar de nuevo el control con la lista ya abierta. Chromium expone
      // `HTMLSelectElement#open`; si no existe, quitar `onClick` evita la petición extra al cerrar.
      if (refetchOnEveryOpenRef.current && e?.currentTarget) {
        const sel = /** @type {HTMLSelectElement & { open?: boolean }} */ (
          e.currentTarget
        );
        if (typeof sel.open === 'boolean' && sel.open) {
          return;
        }
      }
      ensureLevelOpen(levelIndex);
    },
    [isDisabled, ensureLevelOpen]
  );

  // Updates FormIO with current selection state
  const updateFormIOValue = useCallback(
    (changedLevelIndex, newValue, currentStates) => {
      const result = {};

      // Build result object with all current values
      levels.forEach((level, index) => {
        if (index < changedLevelIndex) {
          result[level.entity] = currentStates[index].value;
        } else if (index === changedLevelIndex) {
          result[level.entity] = newValue;
        }
        // Subsequent levels are already reset to empty string
      });

      updateValue(result);
    },
    [levels, updateValue]
  );

  // Handles change in any select level
  const handleSelectChange = useCallback(
    (levelIndex) => (e) => {
      const newValue = e.target.value;

      // Mark this as an internal change to prevent useEffect from overwriting it
      isInternalChange.current = true;

      // Update current level value and reset subsequent levels
      setSelectStates((prev) => {
        const newStates = [...prev];

        presetByLevelIndexRef.current[levelIndex] = newValue;
        for (let i = levelIndex + 1; i < levels.length; i++) {
          presetByLevelIndexRef.current[i] = '';
        }

        // Set current level value
        newStates[levelIndex] = {
          ...newStates[levelIndex],
          value: newValue,
        };

        // Reset all subsequent levels
        for (let i = levelIndex + 1; i < newStates.length; i++) {
          newStates[i] = {
            value: '',
            options: [],
            loading: false,
            error: null,
          };
        }

        // Update FormIO value with new state
        updateFormIOValue(levelIndex, newValue, newStates);

        return newStates;
      });

      markChildLevelsStale(levelIndex);
    },
    [levels.length, markChildLevelsStale, updateFormIOValue]
  );

  const onExternalDataEvent = useCallback(() => {
    staleByLevelRef.current = new Array(levels.length).fill(true);
  }, [levels.length]);

  const onResetForm = useCallback(() => {
    staleByLevelRef.current = new Array(levels.length).fill(true);
  }, [levels.length]);

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

  const label = component.label || 'Auxiliares de referencia';

  // If no configuration, show error
  if (!entity || levels.length === 0) {
    return (
      <div className={`form-group ${disabledClassName}`}>
        <FormLabel component={component}>{label}</FormLabel>
        <div className="alert alert-warning" role="alert">
          <small>
            Configure las propiedades de entidad y relación_entidad en la
            configuración del componente.
          </small>
        </div>
      </div>
    );
  }

  return (
    <div className={`form-group ${disabledClassName}`}>
      <FormLabel component={component}>{label}</FormLabel>

      {levels.map((level, index) => {
        const state = selectStates[index];
        const isVisible = index === 0 || selectStates[index - 1]?.value;
        const safeOptions = ensureSelectedOption(
          state?.options || [],
          state?.value,
          SELECT_OPTION_CONFIG
        );
        const rawOptionsEmpty = !(state?.options && state.options.length);
        const showOnlyLoading = Boolean(state?.loading) && rawOptionsEmpty;

        if (!isVisible) return null;

        return (
          <div key={level.entity} className="mb-3">
            <label className="form-label">
              <small className="text-muted">{level.label}</small>
            </label>
            {state.error && (
              <div className="alert alert-danger" role="alert">
                <small>Error: {state.error}</small>
              </div>
            )}
            <select
              ref={index === 0 ? firstLevelSelectRef : undefined}
              className={`form-control${
                showOnlyLoading ? ' kace-select-native--options-loading' : ''
              }`}
              onChange={handleSelectChange(index)}
              onMouseDown={(e) => handleSelectOpenIntent(index, e)}
              onKeyDown={(e) => {
                if (e.isTrusted === false) {
                  return;
                }
                if (
                  e.key === ' ' ||
                  e.key === 'Enter' ||
                  e.key === 'ArrowDown'
                ) {
                  handleSelectOpenIntent(index, e);
                }
              }}
              value={showOnlyLoading ? '' : state.value}
              disabled={isDisabled}
            >
              {showOnlyLoading ? (
                <option value="">Cargando…</option>
              ) : (
                <>
                  <option value="">
                    {component.placeholder || 'Seleccione una opción'}
                  </option>
                  {safeOptions.map((option, optionIndex) => (
                    <option key={optionIndex} value={option}>
                      {option}
                    </option>
                  ))}
                </>
              )}
            </select>
            {state.loading && (state?.options?.length ?? 0) > 0 && (
              <small
                className="kace-select-loader d-block"
                role="status"
                aria-live="polite"
              >
                Cargando...
              </small>
            )}
          </div>
        );
      })}
    </div>
  );
};
