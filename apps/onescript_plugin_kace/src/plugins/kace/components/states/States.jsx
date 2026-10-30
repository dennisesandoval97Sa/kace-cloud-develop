import React, { useMemo, useState } from 'react';
import useStates from '#plugins/kace/hooks/useStates.js';
import useStatesVisibility from '#plugins/kace/hooks/useStatesVisibility.js';
import { normalize } from '#plugins/kace/utils/normalize.js';
import '#plugins/kace/shared/styles/kace-disabled.css';
import { useKaceDisabled } from '#plugins/kace/hooks/useKaceDisabled.hook.js';
import './States.css';

/** A partir de cuántos estados aparece el buscador. */
const STATES_SEARCH_THRESHOLD = 6;

/**
 * @typedef Props
 * @prop {{ [x: string]: unknown, flowId?: string }} component - `this.component` properties
 * @prop {any} value - `this.value` which is the current transition ID
 * @prop {(value: any, flags: any, source: any) => any} updateValue - Function to update `this.value`
 * @prop {boolean} [disabled=false] - Disables interactions when Form.io sets disable
 * @prop {(event: string, handler: Function) => void} onEvent - Alta de listener en el componente
 * @prop {(event: string, handler: Function) => void} [offEvent] - Baja del listener. Sin ella
 *   cada redibujado del formulario deja otra suscripción viva sobre el emisor compartido.
 */
export const States = ({
  onEvent,
  offEvent,
  handleChange,
  root,
  component,
  disabled = false,
}) => {
  const {
    disabled: isDisabled,
    readOnlyLock,
    className: disabledClassName,
  } = useKaceDisabled(disabled);
  const {
    isLoading,
    defaultState,
    states,
    selected,
    solved_date,
    handleState,
  } = useStates(onEvent, handleChange, root, offEvent);

  const { visibleStates } = useStatesVisibility({
    root,
    component,
    states,
    selected,
    defaultState,
    handleChange,
    handleState,
  });

  const [search, setSearch] = useState('');

  /**
   * Al cambiar de flujo (o reclasificar) la lista es otra, y un término viejo escondería estados
   * del flujo nuevo. Se ajusta en render y no en un efecto: así no hay un paso intermedio en el
   * que se pinte la lista nueva filtrada por la búsqueda anterior.
   */
  const statesSignature = visibleStates.map((s) => s?.state_id).join('|');
  const [lastStatesSignature, setLastStatesSignature] =
    useState(statesSignature);
  if (statesSignature !== lastStatesSignature) {
    setLastStatesSignature(statesSignature);
    setSearch('');
  }

  /**
   * Se filtra DESPUÉS de `useStatesVisibility`, nunca antes: esa capa corre el código custom del
   * editForm, que debe ver la lista completa y no la recortada por lo que el asesor tecleó.
   */
  const filteredStates = useMemo(() => {
    const term = normalize(search);
    if (!term) return visibleStates;
    return visibleStates.filter((state) =>
      normalize(state?.nombre ?? '').includes(term)
    );
  }, [visibleStates, search]);

  // Entre pocos botones, buscar es más trabajo que mirar.
  const showSearch = visibleStates.length > STATES_SEARCH_THRESHOLD;

  if (isLoading) {
    return (
      <div className="card shadow-sm">
        <div className="card-body p-4 states__card-body">
          <h1 className="h3 font-weight-bold mb-2">Estados</h1>
          <p className="text-muted mb-4">
            Seleccione un nivel de clasificación para ver los estados
            disponibles
          </p>

          <div className="overflow-auto states__content">
            <div className="d-flex justify-content-center align-items-center h-100">
              <div className="text-primary spinner-border" role="status">
                <span className="sr-only">Cargando...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (solved_date) {
    return (
      <div className="card shadow-sm">
        <div className="card-body p-4 states__card-body">
          <h1 className="h3 font-weight-bold mb-2">Estados</h1>
          <p className="text-muted mb-4">
            Seleccione un nivel de clasificación para ver los estados
            disponibles
          </p>

          <div className="overflow-auto states__content">
            {solved_date && (
              <div className="d-flex flex-column justify-content-center align-items-center h-100">
                <h5 className="h5 font-weight-bold mb-2 text-danger">
                  El caso esta cerrado
                </h5>
                <p className="mb-4 text-muted">
                  Fecha de resolución: {solved_date}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`card shadow-sm ${disabledClassName}`}>
      <div className="card-body p-4">
        <h1 className="h3 font-weight-bold mb-2">Estados</h1>
        <p className="text-muted mb-4">
          Seleccione un nivel de clasificación para ver los estados disponibles
        </p>

        <div className="overflow-auto states__content">
          {defaultState && (
            <div className="text-center mb-4">
              <h2 className="h5 font-weight-bold mb-3">Estado actual</h2>
              <button type="button" className="btn btn-success" disabled>
                {defaultState.nombre}
              </button>
            </div>
          )}

          {visibleStates.length > 0 && (
            <div className="text-center">
              <h2 className="h5 font-weight-bold mb-3">Estados disponibles</h2>

              {showSearch && (
                <div className="states__search mb-3">
                  <label className="sr-only" htmlFor="states-search">
                    Buscar estado
                  </label>
                  <input
                    id="states-search"
                    type="search"
                    className="form-control"
                    placeholder="Buscar estado…"
                    value={search}
                    disabled={isDisabled}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
              )}

              <div className="d-flex flex-wrap justify-content-center">
                {filteredStates.map((state) => (
                  <button
                    key={state.state_id}
                    type="button"
                    className={`btn mr-2 mb-2 ${selected === state.state_id ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => handleState(state.state_id)}
                    disabled={isDisabled}
                    // La condición la evalúa el backend al guardar; acá solo se avisa de que
                    // existe, para que el asesor no descubra el bloqueo recién al intentarlo.
                    title={
                      state.hasRule
                        ? `Sujeto a condiciones${state.ruleName ? `: ${state.ruleName}` : ''}`
                        : undefined
                    }
                  >
                    {state.nombre}
                    {state.hasRule && (
                      <span className="ml-1" aria-hidden>
                        *
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {filteredStates.length === 0 && (
                <p className="text-muted mb-0">
                  Ningún estado coincide con la búsqueda.
                </p>
              )}

              {filteredStates.some((state) => state.hasRule) && (
                <p className="text-muted small mt-2 mb-0">
                  * Sujeto a condiciones que se verifican al guardar.
                </p>
              )}
            </div>
          )}

          {visibleStates.length === 0 && !defaultState && (
            <div className="d-flex flex-column justify-content-center align-items-center text-muted h-100">
              <h5 className="h5 font-weight-bold mb-2">
                Sin estados disponibles
              </h5>
              <p className="mb-4">
                Seleccione un nivel de clasificación para ver los estados
                disponibles
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
