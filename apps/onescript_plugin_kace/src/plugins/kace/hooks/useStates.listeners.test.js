import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Fuga de listeners en `useStates`.
 *
 * `states/index.js` pasa `onEvent: this.on.bind(this)`, y `bind` devuelve una función NUEVA en
 * cada `renderReactComponent()` —que `setDisabled` dispara en cada redibujado del formulario—.
 * Esa identidad nueva re-ejecuta los efectos que la tienen en sus dependencias, así que sin
 * `offEvent` cada redibujado deja otra suscripción viva sobre el MISMO emisor compartido de
 * Form.io.
 *
 * El emisor real (`Element.on`) acumula; el doble de los otros tests indexa por nombre y por eso
 * no ve el problema. Aquí se modela el comportamiento real: alta que apila y baja por identidad.
 */
const storeValues = {};
const storeServiceMock = {
  get: (path) => storeValues[path],
  set: (path, value) => {
    storeValues[path] = value;
  },
};
const statesServiceMock = {
  fetchTransitionsData: vi.fn().mockResolvedValue([]),
  fetchStateName: vi.fn().mockResolvedValue(''),
};
const engineMock = {
  getService: (name) => {
    if (name === 'storeService') return storeServiceMock;
    if (name === 'states') return statesServiceMock;
    return null;
  },
};

vi.mock('../KaceEngine.js', () => ({ KaceEngine: () => engineMock }));
vi.mock('#plugins/kace/hooks/useEventData.js', () => ({
  default: () => ({ data: null, statesLoading: false }),
}));

const { default: useStates } = await import('./useStates.js');

/** Emisor con la semántica de `Element.on`/`Element.off`: apila y da de baja por identidad. */
function createEmitter() {
  const registry = new Map();
  return {
    count: (name) => registry.get(name)?.length ?? 0,
    on: (name, handler) => {
      if (!registry.has(name)) registry.set(name, []);
      registry.get(name).push(handler);
    },
    off: (name, handler) => {
      const handlers = registry.get(name);
      if (!handlers) return;
      const index = handlers.indexOf(handler);
      if (index !== -1) handlers.splice(index, 1);
    },
  };
}

describe('useStates — suscripción a los eventos del componente', () => {
  beforeEach(() => {
    for (const key of Object.keys(storeValues)) delete storeValues[key];
  });

  /**
   * Cada render recibe enlaces nuevos, igual que `this.on.bind(this)` en producción.
   */
  it('deja una sola suscripción por evento aunque el componente se redibuje', () => {
    const emitter = createEmitter();
    const { rerender } = renderHook(() =>
      useStates(
        (name, handler) => emitter.on(name, handler),
        vi.fn(),
        null,
        (name, handler) => emitter.off(name, handler)
      )
    );

    rerender();
    rerender();
    rerender();

    expect(emitter.count('kaceCaseReclassified')).toBe(1);
    expect(emitter.count('kaceClassificationsFlowChange')).toBe(1);
  });

  it('se da de baja al desmontar, sin dejar nada colgando del emisor compartido', () => {
    const emitter = createEmitter();
    const { unmount } = renderHook(() =>
      useStates(
        (name, handler) => emitter.on(name, handler),
        vi.fn(),
        null,
        (name, handler) => emitter.off(name, handler)
      )
    );

    unmount();

    expect(emitter.count('kaceCaseReclassified')).toBe(0);
    expect(emitter.count('kaceClassificationsFlowChange')).toBe(0);
  });

  /**
   * `offEvent` es opcional a propósito: un consumidor que no lo pase debe seguir funcionando
   * —volverá a fugar, pero no puede romper—.
   */
  it('no revienta cuando el consumidor no aporta baja de listener', () => {
    const emitter = createEmitter();

    expect(() => {
      const { unmount } = renderHook(() =>
        useStates((name, handler) => emitter.on(name, handler), vi.fn(), null)
      );
      unmount();
    }).not.toThrow();
  });
});
