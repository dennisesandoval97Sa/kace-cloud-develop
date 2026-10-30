import { useCallback, useEffect, useRef } from 'react';

/**
 * Techo de la espera a una carga abandonada antes de arrancar la vigente.
 *
 * `resetCache()` abandona la petición en vuelo de forma lógica, pero no la cancela: esta capa no
 * tiene `AbortController`. Si esa promesa nunca se asienta —timeout de proxy, socket muerto— el
 * encadenado dejaría colgadas TODAS las cargas posteriores del hook, y con ellas el desplegable de
 * cada consumidor. Pasado este plazo se asume muerta y se arranca igual: se pierde la garantía de
 * orden de escritura, que es justo lo que ya no importa cuando la vieja no va a responder.
 */
export const ABANDONED_RUN_GRACE_MS = 10000;

/**
 * Espera a que `run` se asiente (resuelva o rechace), pero nunca más de `ABANDONED_RUN_GRACE_MS`.
 */
const settledOrTimedOut = (run) =>
  new Promise((resolve) => {
    const timeoutId = setTimeout(resolve, ABANDONED_RUN_GRACE_MS);
    const done = () => {
      clearTimeout(timeoutId);
      resolve();
    };
    run.then(done, done);
  });

/**
 * Caches and coordinates lazy loading for API-backed dropdown options.
 *
 * - Default: first open (o primera carga) obtiene datos; reutiliza caché hasta invalidación
 *   (`onExternalDataEvent` / `resetCache`) o hasta **fallo de red/petición** — si `loadFn`
 *   rechaza, el siguiente `ensureLoaded` vuelve a intentar aunque `refetchOnEveryOpen` esté
 *   desactivado. Tras un **éxito** queda `hasLoaded` y no se repite hasta marcar obsoleto o fallar
 *   de nuevo.
 * - `refetchOnEveryOpen`: cada `ensureLoaded` (p. ej. al abrir) vuelve a cargar. Los eventos
 *   `kaceAuthData` / `redraw` no disparan carga; solo marcan caché obsoleta.
 *
 * `loadFn` debe ser `async` o devolver una **Promise** que:
 * - **rechace** (throw / reject) si la petición falla, para reintentar al abrir;
 * - **resuelva** si la carga es correcta (lista vacía incluida).
 *
 * Recibe `{ isCurrent }`: falso cuando `resetCache()` abandonó esa carga. Sirve para saltarse
 * los efectos que el propio `loadFn` aplica (`setOptions`, spinner…), que quedan fuera del
 * alcance del hook. Ignorarlo es válido —el encadenado de `ensureLoaded` ya garantiza que la
 * carga vigente escribe la última—, pero ahorra pintar un catálogo que se va a reemplazar.
 *
 * @param {object} options
 * @param {boolean} [options.refetchOnEveryOpen=false]
 * @param {(ctx: { isCurrent: () => boolean }) => void | Promise<unknown>} options.loadFn
 * @returns {{ ensureLoaded: () => Promise<unknown> | undefined, resetCache: () => void, onExternalDataEvent: () => void, invalidate: () => void }}
 */
/**
 * Envuelve el `isCurrent` que recibe `loadFn` en un predicado de "¿esta carga quedó obsoleta?".
 *
 * Vive aquí y no en el `loadFn` de cada consumidor porque `isCurrent` es un detalle del contrato
 * de este hook (ver arriba): quién lo entrega y qué significa que sea falso.
 *
 * @param {(() => boolean) | undefined} isCurrent
 * @returns {boolean}
 */
export function isLoadStale(isCurrent) {
  return isCurrent ? !isCurrent() : false;
}

export function useLazySelectOptions({ refetchOnEveryOpen = false, loadFn }) {
  const hasLoadedRef = useRef(false);
  const isStaleRef = useRef(false);
  const refetchRef = useRef(!!refetchOnEveryOpen);
  const loadFnRef = useRef(loadFn);
  const inFlightRef = useRef(null);
  /**
   * Generación de carga. La incrementa `resetCache()` para ABANDONAR la petición en vuelo: sin
   * esto, invalidar la caché mientras hay un fetch corriendo no relanzaba nada —`ensureLoaded`
   * devolvía la misma promesa vieja— y el consumidor se quedaba con el resultado de los
   * parámetros anteriores. Se compara antes de escribir cualquier ref, para que la carga
   * abandonada no reviva su propio estado al resolver.
   */
  const generationRef = useRef(0);
  /**
   * Última carga arrancada, vigente o abandonada. A diferencia de `inFlightRef`, `resetCache` no
   * la limpia: es lo que permite ENCADENAR la carga nueva detrás de la abandonada en vez de
   * correrlas en paralelo.
   */
  const lastRunRef = useRef(null);

  useEffect(() => {
    refetchRef.current = !!refetchOnEveryOpen;
  }, [refetchOnEveryOpen]);

  useEffect(() => {
    loadFnRef.current = loadFn;
  }, [loadFn]);

  const runLoad = useCallback((isCurrent) => {
    try {
      return loadFnRef.current({ isCurrent });
    } catch (e) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('[useLazySelectOptions] loadFn', e);
      }
      return Promise.reject(e);
    }
  }, []);

  const ensureLoaded = useCallback(() => {
    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    const generation = generationRef.current;
    const isCurrent = () => generationRef.current === generation;
    /*
     * La carga que `resetCache` abandonó sigue viva y sus efectos los aplica el `loadFn` del
     * consumidor (`setOptions`), fuera del alcance de `isCurrent`. Arrancar la nueva en paralelo
     * dejaría ganar a la que resuelva última —puede ser la vieja—, así que se la encadena: una
     * sola carga corre a la vez y la vigente siempre escribe al final. Un fallo de la abandonada
     * no la bloquea, solo se espera a que termine; y una que no termine nunca tampoco, porque la
     * espera está acotada por `ABANDONED_RUN_GRACE_MS`.
     */
    const previousRun = lastRunRef.current;
    const afterPreviousRun = async () => {
      if (previousRun) {
        await settledOrTimedOut(previousRun);
      }
      if (!isCurrent()) return undefined;
      return runLoad(isCurrent);
    };

    if (refetchRef.current) {
      const p = (async () => {
        try {
          return await afterPreviousRun();
        } finally {
          if (isCurrent()) inFlightRef.current = null;
        }
      })();
      inFlightRef.current = p;
      lastRunRef.current = p;
      return p;
    }

    if (!hasLoadedRef.current || isStaleRef.current) {
      isStaleRef.current = false;
      const p = (async () => {
        try {
          const out = await afterPreviousRun();
          if (isCurrent()) {
            hasLoadedRef.current = true;
            isStaleRef.current = false;
          }
          return out;
        } catch (err) {
          if (isCurrent()) {
            hasLoadedRef.current = false;
            isStaleRef.current = true;
          }
          throw err;
        } finally {
          if (isCurrent()) inFlightRef.current = null;
        }
      })();
      inFlightRef.current = p;
      lastRunRef.current = p;
      return p;
    }

    return undefined;
  }, [runLoad]);

  const resetCache = useCallback(() => {
    generationRef.current += 1;
    hasLoadedRef.current = false;
    isStaleRef.current = false;
    // La petición en vuelo se abandona como resultado —devolverla sería servir lo que
    // `resetCache` acaba de invalidar—, pero `lastRunRef` la conserva para que la carga que la
    // reemplaza arranque detrás de ella y no a la vez.
    inFlightRef.current = null;
  }, []);

  /**
   * kaceAuthData / redraw: invalida caché para la próxima apertura. No llama a `loadFn` aquí.
   */
  const onExternalDataEvent = useCallback(() => {
    isStaleRef.current = true;
  }, []);

  return {
    ensureLoaded,
    resetCache,
    onExternalDataEvent,
    invalidate: onExternalDataEvent,
  };
}
