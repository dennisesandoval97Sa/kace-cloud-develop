import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const FLUJO_ANTERIOR = 'flujo-1';
const FLUJO_DESTINO = 'flujo-2';
const CLASIFICACION_DESTINO = 'clas-otra';

/**
 * Transiciones del flujo ANTERIOR. Son las que devolvería el camino normal, y ninguna parte del
 * estado en que quedó el caso tras reclasificar: ese es justamente el bug que OS-9 arregla.
 */
const transicionesFlujoAnterior = [
  {
    id: 'trans-vieja',
    estado_actual_id: 'estado-1',
    siguiente_estado_id: 'estado-2',
    status: 1,
  },
];

/** Respuesta del precheck, en la forma `case_available_states`. */
const estadosDestino = [
  {
    transition: { id: 'trans-nueva' },
    estado_actual: { id: 'estado-7' },
    estado_siguiente: { id: 'estado-9', nombre: 'Cerrado efectivo' },
  },
];

const storeValues = {};
const fetchTransitionsData = vi.fn();
const fetchStateName = vi.fn();
/** Listeners registrados por el hook vía `onEvent`, para dispararlos desde el test. */
let listeners = {};

/**
 * Los servicios son SINGLETONS, como en producción: `KaceEngine()` cachea y `getService` devuelve
 * siempre la misma instancia. Si el mock creara un objeto por llamada, `transitionsHandler`
 * cambiaría de identidad en cada render y su efecto entraría en bucle.
 */
const storeServiceMock = {
  get: (path) => storeValues[path],
  set: (path, value) => {
    storeValues[path] = value;
  },
};
const statesServiceMock = { fetchTransitionsData, fetchStateName };
const engineMock = {
  getService: (name) => {
    if (name === 'storeService') return storeServiceMock;
    if (name === 'states') return statesServiceMock;
    return null;
  },
};

vi.mock('../KaceEngine.js', () => ({
  KaceEngine: () => engineMock,
}));

vi.mock('#plugins/kace/hooks/useEventData.js', () => ({
  default: () => ({ data: null, statesLoading: false }),
}));

const { default: useStates } = await import('./useStates.js');

const onEvent = (name, handler) => {
  listeners[name] = handler;
};

function renderUseStates() {
  const handleChange = vi.fn();
  const result = renderHook(() => useStates(onEvent, handleChange, null));
  return { ...result, handleChange };
}

/** Reproduce el orden real: OS-8 emite el evento y la propagación del flujo viene detrás. */
async function reclassify({ states = estadosDestino, rules = [] } = {}) {
  await act(async () => {
    listeners.kaceCaseReclassified?.({
      clasificacion_id: CLASIFICACION_DESTINO,
      flujo_id: FLUJO_DESTINO,
      states,
      transition_rules: rules,
    });
  });
  await act(async () => {
    listeners.kaceClassificationsFlowChange?.(FLUJO_DESTINO);
  });
}

describe('useStates — estados del flujo destino tras reclasificar (OS-9)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(storeValues)) delete storeValues[key];
    listeners = {};
    storeValues['cases.case_data'] = {
      id: 'caso-1',
      clasificacion_id: 'clas-actual',
      transicion_id: 'trans-vieja',
    };
    fetchTransitionsData.mockResolvedValue(transicionesFlujoAnterior);
    fetchStateName.mockResolvedValue('Nombre del estado');
  });

  it('muestra los estados del flujo destino, que hoy salen vacíos', async () => {
    const { result } = renderUseStates();

    await reclassify();

    await waitFor(() => expect(result.current.states).toHaveLength(1));
    expect(result.current.states[0]).toMatchObject({
      transition_id: 'trans-nueva',
      state_id: 'estado-9',
      nombre: 'Cerrado efectivo',
    });
  });

  it('no consulta las transiciones: los estados ya vinieron del precheck', async () => {
    renderUseStates();

    await reclassify();

    await waitFor(() => expect(fetchTransitionsData).not.toHaveBeenCalled());
  });

  it('sigue sirviendo los estados del precheck si el flujo se recorre y vuelve', async () => {
    const { result } = renderUseStates();

    await reclassify();
    await waitFor(() => expect(result.current.states).toHaveLength(1));

    await act(async () => {
      listeners.kaceClassificationsFlowChange?.(FLUJO_ANTERIOR);
    });
    await act(async () => {
      listeners.kaceClassificationsFlowChange?.(FLUJO_DESTINO);
    });

    await waitFor(() =>
      expect(result.current.states[0]).toMatchObject({
        transition_id: 'trans-nueva',
      })
    );
  });

  it('limpia el estado actual, que pertenece al flujo anterior', async () => {
    const { result } = renderUseStates();

    await reclassify();

    await waitFor(() => expect(result.current.defaultState).toBeNull());
    expect(result.current.selected).toBeNull();
    expect(storeValues['states.current_transition']).toBeNull();
  });

  it('invalida las transiciones cacheadas del flujo anterior', async () => {
    storeValues['states.transitions_data'] = transicionesFlujoAnterior;
    renderUseStates();

    await reclassify();

    await waitFor(() =>
      expect(storeValues['states.transitions_data']).toBeNull()
    );
  });

  it('marca los estados cuya transición tiene una regla', async () => {
    const { result } = renderUseStates();

    await reclassify({
      rules: [{ transicion_id: 'trans-nueva', nombre: 'Requiere monto' }],
    });

    await waitFor(() => expect(result.current.states).toHaveLength(1));
    expect(result.current.states[0]).toMatchObject({
      hasRule: true,
      ruleName: 'Requiere monto',
    });
  });

  it('vuelve al camino normal una vez que el guardado aterrizó', async () => {
    const { result } = renderUseStates();

    await reclassify();
    await waitFor(() => expect(result.current.states).toHaveLength(1));

    // El caso recargado ya trae la clasificación destino: el flujo es suyo de verdad.
    storeValues['cases.case_data'] = {
      id: 'caso-1',
      clasificacion_id: CLASIFICACION_DESTINO,
      transicion_id: 'trans-nueva',
    };
    // El flujo se recorre y vuelve, que es lo que hace correr de nuevo a `transitionsHandler`.
    await act(async () => {
      listeners.kaceClassificationsFlowChange?.(FLUJO_ANTERIOR);
    });
    await act(async () => {
      listeners.kaceClassificationsFlowChange?.(FLUJO_DESTINO);
    });

    await waitFor(() =>
      expect(fetchTransitionsData).toHaveBeenCalledWith({
        flowId: FLUJO_DESTINO,
      })
    );
  });

  it('sin reclasificación el camino de hoy no cambia', async () => {
    renderUseStates();

    await act(async () => {
      listeners.kaceClassificationsFlowChange?.(FLUJO_ANTERIOR);
    });

    await waitFor(() =>
      expect(fetchTransitionsData).toHaveBeenCalledWith({
        flowId: FLUJO_ANTERIOR,
      })
    );
  });

  it('un evento sin flujo destino no altera el camino normal', async () => {
    renderUseStates();

    await act(async () => {
      listeners.kaceCaseReclassified?.({ states: estadosDestino });
    });
    await act(async () => {
      listeners.kaceClassificationsFlowChange?.(FLUJO_ANTERIOR);
    });

    await waitFor(() =>
      expect(fetchTransitionsData).toHaveBeenCalledWith({
        flowId: FLUJO_ANTERIOR,
      })
    );
  });
});
