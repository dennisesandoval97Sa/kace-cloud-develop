import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ABANDONED_RUN_GRACE_MS,
  isLoadStale,
  useLazySelectOptions,
} from './useLazySelectOptions.hook.js';

describe('isLoadStale', () => {
  it('no está obsoleta cuando el loadFn no recibió isCurrent', () => {
    expect(isLoadStale(undefined)).toBe(false);
  });

  it('no está obsoleta mientras isCurrent siga devolviendo true', () => {
    expect(isLoadStale(() => true)).toBe(false);
  });

  it('está obsoleta cuando isCurrent devuelve false', () => {
    expect(isLoadStale(() => false)).toBe(true);
  });
});

/**
 * Una promesa que resuelve/rechaza cuando el test lo decide, para fijar el ORDEN de llegada de
 * dos cargas: es justo lo que distingue un catálogo obsoleto pisando al fresco de lo contrario.
 */
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

/** Deja correr las microtareas pendientes sin depender de temporizadores. */
const flush = () => act(async () => {});

describe('useLazySelectOptions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('refetchOnEveryOpen = false', () => {
    it('carga en la primera apertura y reutiliza la caché en las siguientes', async () => {
      const loadFn = vi.fn().mockResolvedValue('ok');
      const { result } = renderHook(() => useLazySelectOptions({ loadFn }));

      await act(async () => {
        await result.current.ensureLoaded();
      });
      await act(async () => {
        await result.current.ensureLoaded();
      });

      expect(loadFn).toHaveBeenCalledTimes(1);
    });

    it('reintenta en la siguiente apertura si la carga falló', async () => {
      const loadFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('red caída'))
        .mockResolvedValue('ok');
      const { result } = renderHook(() => useLazySelectOptions({ loadFn }));

      await act(async () => {
        await result.current.ensureLoaded().catch(() => {});
      });
      await act(async () => {
        await result.current.ensureLoaded();
      });

      expect(loadFn).toHaveBeenCalledTimes(2);
    });

    it('deduplica: dos aperturas con la carga en vuelo comparten la misma petición', async () => {
      const first = deferred();
      const loadFn = vi.fn().mockReturnValue(first.promise);
      const { result } = renderHook(() => useLazySelectOptions({ loadFn }));

      let a;
      let b;
      act(() => {
        a = result.current.ensureLoaded();
        b = result.current.ensureLoaded();
      });

      expect(a).toBe(b);
      expect(loadFn).toHaveBeenCalledTimes(1);

      await act(async () => {
        first.resolve('ok');
        await a;
      });
    });

    it('vuelve a cargar tras invalidar la caché con onExternalDataEvent', async () => {
      const loadFn = vi.fn().mockResolvedValue('ok');
      const { result } = renderHook(() => useLazySelectOptions({ loadFn }));

      await act(async () => {
        await result.current.ensureLoaded();
      });
      act(() => {
        result.current.onExternalDataEvent();
      });
      await act(async () => {
        await result.current.ensureLoaded();
      });

      expect(loadFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('refetchOnEveryOpen = true', () => {
    it('vuelve a cargar en cada apertura, sin caché', async () => {
      const loadFn = vi.fn().mockResolvedValue('ok');
      const { result } = renderHook(() =>
        useLazySelectOptions({ refetchOnEveryOpen: true, loadFn })
      );

      await act(async () => {
        await result.current.ensureLoaded();
      });
      await act(async () => {
        await result.current.ensureLoaded();
      });
      await act(async () => {
        await result.current.ensureLoaded();
      });

      expect(loadFn).toHaveBeenCalledTimes(3);
    });

    it('propaga el fallo y no deja la petición pegada en vuelo', async () => {
      const loadFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('red caída'))
        .mockResolvedValue('ok');
      const { result } = renderHook(() =>
        useLazySelectOptions({ refetchOnEveryOpen: true, loadFn })
      );

      await act(async () => {
        await expect(result.current.ensureLoaded()).rejects.toThrow(
          'red caída'
        );
      });
      await act(async () => {
        await expect(result.current.ensureLoaded()).resolves.toBe('ok');
      });

      expect(loadFn).toHaveBeenCalledTimes(2);
    });

    it('resetCache con una carga en vuelo no arranca dos loadFn a la vez', async () => {
      const running = [];
      const gates = [];
      const loadFn = vi.fn(() => {
        const gate = deferred();
        gates.push(gate);
        running.push(1);
        return gate.promise.finally(() => running.pop());
      });
      const { result } = renderHook(() =>
        useLazySelectOptions({ refetchOnEveryOpen: true, loadFn })
      );

      act(() => {
        void result.current.ensureLoaded();
      });
      act(() => {
        result.current.resetCache();
        void result.current.ensureLoaded();
      });
      await flush();

      expect(running.length).toBe(1);
      expect(loadFn).toHaveBeenCalledTimes(1);

      await act(async () => {
        gates[0].resolve('viejo');
      });

      expect(loadFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('resetCache con una carga en vuelo', () => {
    it('relanza la carga en vez de devolver la promesa vieja', async () => {
      const first = deferred();
      const second = deferred();
      const loadFn = vi
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);
      const { result } = renderHook(() => useLazySelectOptions({ loadFn }));

      let stale;
      act(() => {
        stale = result.current.ensureLoaded();
      });

      let fresh;
      act(() => {
        result.current.resetCache();
        fresh = result.current.ensureLoaded();
      });

      expect(fresh).not.toBe(stale);

      await act(async () => {
        first.resolve('viejo');
        await stale;
      });
      await act(async () => {
        second.resolve('fresco');
      });

      expect(loadFn).toHaveBeenCalledTimes(2);
      await expect(fresh).resolves.toBe('fresco');
    });

    it('serializa las cargas: la abandonada termina ANTES de que arranque la vigente', async () => {
      const settleOrder = [];
      const first = deferred();
      const second = deferred();
      const loadFn = vi
        .fn()
        .mockImplementationOnce(() => {
          settleOrder.push('inicio-vieja');
          return first.promise;
        })
        .mockImplementationOnce(() => {
          settleOrder.push('inicio-fresca');
          return second.promise;
        });
      const { result } = renderHook(() => useLazySelectOptions({ loadFn }));

      act(() => {
        void result.current.ensureLoaded();
      });
      act(() => {
        result.current.resetCache();
        void result.current.ensureLoaded();
      });
      await flush();

      // La vigente todavía no arrancó: si lo hiciera, su `setOptions` podría quedar por
      // DEBAJO del de la vieja, que es la regresión que este guard evita.
      expect(settleOrder).toEqual(['inicio-vieja']);

      await act(async () => {
        first.resolve('viejo');
        settleOrder.push('fin-vieja');
      });

      expect(settleOrder).toEqual([
        'inicio-vieja',
        'fin-vieja',
        'inicio-fresca',
      ]);

      await act(async () => {
        second.resolve('fresco');
      });
    });

    it('arranca la carga vigente aunque la abandonada termine en error', async () => {
      const first = deferred();
      const second = deferred();
      const loadFn = vi
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);
      const { result } = renderHook(() => useLazySelectOptions({ loadFn }));

      let stale;
      act(() => {
        stale = result.current.ensureLoaded();
      });

      let fresh;
      act(() => {
        result.current.resetCache();
        fresh = result.current.ensureLoaded();
      });

      await act(async () => {
        first.reject(new Error('la vieja falló'));
        await stale.catch(() => {});
      });
      await act(async () => {
        second.resolve('fresco');
      });

      await expect(fresh).resolves.toBe('fresco');
      expect(loadFn).toHaveBeenCalledTimes(2);
    });

    it('el fallo de una carga abandonada no marca la caché como fallida', async () => {
      const first = deferred();
      const second = deferred();
      const loadFn = vi
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)
        .mockResolvedValue('no debería hacer falta');
      const { result } = renderHook(() => useLazySelectOptions({ loadFn }));

      let stale;
      act(() => {
        stale = result.current.ensureLoaded();
      });
      let fresh;
      act(() => {
        result.current.resetCache();
        fresh = result.current.ensureLoaded();
      });

      await act(async () => {
        first.reject(new Error('la vieja falló'));
        await stale.catch(() => {});
      });
      await act(async () => {
        second.resolve('fresco');
        await fresh;
      });

      // La carga vigente terminó bien: la apertura siguiente sirve caché, no reintenta.
      await act(async () => {
        await result.current.ensureLoaded();
      });

      expect(loadFn).toHaveBeenCalledTimes(2);
    });
  });

  /**
   * `resetCache()` abandona la petición, no la cancela. Una que no se asiente nunca —timeout de
   * proxy, socket muerto— colgaría a toda la cadena de cargas posteriores si la espera no
   * estuviera acotada, y con ella el desplegable de los 7+ consumidores del hook.
   */
  describe('carga abandonada que nunca se asienta', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('arranca la carga vigente al vencer el plazo de guarda, no se cuelga', async () => {
      const nuncaTermina = new Promise(() => {});
      const loadFn = vi
        .fn()
        .mockReturnValueOnce(nuncaTermina)
        .mockResolvedValueOnce('fresco');
      const { result } = renderHook(() => useLazySelectOptions({ loadFn }));

      act(() => {
        void result.current.ensureLoaded();
      });
      let fresh;
      act(() => {
        result.current.resetCache();
        fresh = result.current.ensureLoaded();
      });

      // Antes del plazo sigue esperando: el orden de escritura se respeta mientras haya esperanza.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ABANDONED_RUN_GRACE_MS - 1);
      });
      expect(loadFn).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });

      expect(loadFn).toHaveBeenCalledTimes(2);
      await expect(fresh).resolves.toBe('fresco');
    });

    it('no arranca la generación abandonada si otra resetCache la venció durante la espera', async () => {
      const nuncaTermina = new Promise(() => {});
      const loadFn = vi
        .fn()
        .mockReturnValueOnce(nuncaTermina)
        .mockResolvedValueOnce('vigente');
      const { result } = renderHook(() => useLazySelectOptions({ loadFn }));

      act(() => {
        void result.current.ensureLoaded();
      });
      act(() => {
        result.current.resetCache();
        void result.current.ensureLoaded();
      });
      let vigente;
      act(() => {
        result.current.resetCache();
        vigente = result.current.ensureLoaded();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(ABANDONED_RUN_GRACE_MS);
      });

      expect(loadFn).toHaveBeenCalledTimes(2);
      await expect(vigente).resolves.toBe('vigente');
    });

    it('no arrastra el bloqueo a las aperturas siguientes', async () => {
      const nuncaTermina = new Promise(() => {});
      const loadFn = vi
        .fn()
        .mockReturnValueOnce(nuncaTermina)
        .mockResolvedValue('fresco');
      const { result } = renderHook(() =>
        useLazySelectOptions({ refetchOnEveryOpen: true, loadFn })
      );

      act(() => {
        void result.current.ensureLoaded();
      });
      act(() => {
        result.current.resetCache();
        void result.current.ensureLoaded();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ABANDONED_RUN_GRACE_MS);
      });

      // La tercera encadena tras la segunda, que ya terminó: no hereda el cuelgue de la primera.
      let tercera;
      act(() => {
        tercera = result.current.ensureLoaded();
      });
      await act(async () => {
        await tercera;
      });

      expect(loadFn).toHaveBeenCalledTimes(3);
    });

    it('cancela el temporizador de guarda cuando la abandonada sí termina', async () => {
      const first = deferred();
      const second = deferred();
      const loadFn = vi
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);
      const { result } = renderHook(() => useLazySelectOptions({ loadFn }));

      act(() => {
        void result.current.ensureLoaded();
      });
      act(() => {
        result.current.resetCache();
        void result.current.ensureLoaded();
      });

      await act(async () => {
        first.resolve('viejo');
      });
      await act(async () => {
        second.resolve('fresco');
      });

      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('isCurrent entregado a loadFn', () => {
    it('es falso para la carga que resetCache abandonó y cierto para la vigente', async () => {
      const first = deferred();
      const second = deferred();
      const signals = [];
      const loadFn = vi
        .fn()
        .mockImplementationOnce(({ isCurrent }) => {
          signals.push({ nombre: 'vieja', isCurrent });
          return first.promise;
        })
        .mockImplementationOnce(({ isCurrent }) => {
          signals.push({ nombre: 'fresca', isCurrent });
          return second.promise;
        });
      const { result } = renderHook(() => useLazySelectOptions({ loadFn }));

      let stale;
      act(() => {
        stale = result.current.ensureLoaded();
      });
      act(() => {
        result.current.resetCache();
        void result.current.ensureLoaded();
      });

      await act(async () => {
        first.resolve('viejo');
        await stale;
      });
      await act(async () => {
        second.resolve('fresco');
      });

      expect(signals.map((s) => s.nombre)).toEqual(['vieja', 'fresca']);
      expect(signals[0].isCurrent()).toBe(false);
      expect(signals[1].isCurrent()).toBe(true);
    });

    it('sigue funcionando con un loadFn que ignora el argumento', async () => {
      const loadFn = vi.fn(() => Promise.resolve('ok'));
      const { result } = renderHook(() => useLazySelectOptions({ loadFn }));

      await act(async () => {
        await expect(result.current.ensureLoaded()).resolves.toBe('ok');
      });
    });
  });

  it('convierte en rechazo un loadFn que lanza de forma síncrona', async () => {
    const loadFn = vi.fn(() => {
      throw new Error('explotó antes del await');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useLazySelectOptions({ loadFn }));

    await act(async () => {
      await expect(result.current.ensureLoaded()).rejects.toThrow(
        'explotó antes del await'
      );
    });
  });
});
