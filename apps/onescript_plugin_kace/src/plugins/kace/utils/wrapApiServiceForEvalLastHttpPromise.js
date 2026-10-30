/**
 * Form.io `Utils.evaluate` solo devuelve un valor con `return` explícito en el script.
 * Un cuerpo como `apiService.get('/x')` (sin return) deja un `undefined` como
 * retorno, aunque haya quedado una promesa; el `load` del select no puede
 * asociar éxito/error a esa promesa. Este wrapper guarda la última promesa
 * devuelta por `get` / `post` del `apiService` expuesto al evaluador para
 * tratarla como el resultado efectivo cuando haga falta.
 *
 * Llamar `lastHttp.last = null` al inicio de cada `evaluate` que deba
 * reintentar según carga/error.
 *
 * @param {object} api
 * @returns {{ lastHttp: { last: globalThis.Promise | null }, api: object }}
 */
export function wrapApiServiceForEvalLastHttpPromise(api) {
  if (!api) {
    return { lastHttp: { last: null }, api };
  }
  const lastHttp = { last: null };
  return {
    lastHttp,
    api: {
      ...api,
      get: (url, config) => {
        const p = api.get(url, config);
        lastHttp.last = p;
        return p;
      },
      post: (url, data, config) => {
        const p = api.post(url, data, config);
        lastHttp.last = p;
        return p;
      },
    },
  };
}

/**
 * Promesa a usar tras `Utils.evaluate` cuando el script no devuelve nada
 * (sin `return`) pero sí pudo dejar al menos un `get` / `post` (vía
 * `wrapApiServiceForEvalLastHttpPromise`).
 *
 * @param {unknown} evaluateResult
 * @param {{ last: unknown } | null | undefined} lastHttp
 * @returns {globalThis.Promise | null}
 */
export function getEffectiveEvalPromise(evaluateResult, lastHttp) {
  if (evaluateResult && typeof evaluateResult.then === 'function') {
    return evaluateResult;
  }
  const p = lastHttp && lastHttp.last;
  if (p && typeof p.then === 'function') {
    return p;
  }
  return null;
}
