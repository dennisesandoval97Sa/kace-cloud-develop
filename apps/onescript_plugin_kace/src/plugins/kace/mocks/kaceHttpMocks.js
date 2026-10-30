/**
 * Mocks HTTP mínimos para Axios (sin red).
 *
 * Activar: `VITE_MOCK_HTTP=true` o `VITE_MOCK_SUBCASES_SEARCH=true` en `.env` y reiniciar Vite.
 * `ApiService` llama a `applyKaceHttpMocks` una vez por instancia.
 *
 * Ejemplo — otro endpoint:
 *
 * ```js
 * import { mockHttp } from '#plugins/kace/mocks/kaceHttpMocks.js';
 *
 * mockHttp({
 *   method: 'post',
 *   url: /^\/users\/search$/,
 *   body: { limit: 10 },
 *   response: { data: { items: [] }, message: 'Success' },
 * });
 * ```
 *
 * Misma ruta, distinto body: varios `mockHttp`; se evalúan del más reciente al más antiguo; el mock por defecto de subcasos queda al final.
 */
import { SUBCASES_SEARCH_MOCK_RESPONSE } from '#plugins/kace/mocks/subcasesSearch.mock.data.js';

/** @type {Array<{ method: string, url: RegExp, body: unknown, response: (config: import('axios').InternalAxiosRequestConfig) => unknown | Promise<unknown> }>} */
const entries = [];

/** @type {WeakSet<import('axios').AxiosInstance>} */
const appliedInterceptors = new WeakSet();

function parseBody(data) {
  if (data == null) return null;
  if (typeof data === 'object' && !Array.isArray(data)) return data;
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }
  return data;
}

/**
 * Comprueba que `body` contenga las mismas claves/valores que `partial` (objetos anidados y arrays por posición).
 * @param {unknown} partial
 * @param {unknown} body
 * @returns {boolean}
 */
function bodyMatches(partial, body) {
  if (partial == null) return true;
  if (body == null) return false;
  if (Array.isArray(partial)) {
    if (!Array.isArray(body) || body.length < partial.length) return false;
    return partial.every((item, i) => bodyMatches(item, body[i]));
  }
  if (typeof partial !== 'object') {
    return partial === body;
  }
  if (typeof body !== 'object' || Array.isArray(body)) return false;
  return Object.keys(partial).every(
    (k) =>
      Object.prototype.hasOwnProperty.call(body, k) &&
      bodyMatches(partial[k], /** @type {Record<string, unknown>} */ (body)[k])
  );
}

/**
 * Registra un mock: método + URL (regex) + opcional cuerpo parcial + respuesta (objeto o función que recibe `config` de Axios).
 *
 * @param {object} def
 * @param {string} [def.method='get'] - get, post, put, patch, delete
 * @param {RegExp} def.url - Ruta relativa al baseURL, p. ej. /^\\/cases\\/[^/]+\\/sub-cases\\/search$/
 * @param {Record<string, unknown>|null} [def.body] - Si se pasa, el JSON del request debe contener este subconjunto
 * @param {unknown|((config: import('axios').InternalAxiosRequestConfig) => unknown | Promise<unknown>)} def.response
 */
export function mockHttp(def) {
  try {
    const method = String(def.method || 'get').toLowerCase();
    if (!(def.url instanceof RegExp)) {
      console.warn('[kaceHttpMocks] mockHttp: `url` debe ser un RegExp');
      return;
    }
    const body = def.body !== undefined ? def.body : null;
    const response = def.response;
    const responseFn =
      typeof response === 'function' ? response : () => response;
    // unshift: los últimos registrados por el usuario se evalúan primero (prioridad sobre el mock por defecto al final)
    entries.unshift({ method, url: def.url, body, response: responseFn });
  } catch (err) {
    console.warn('[kaceHttpMocks] mockHttp:', err?.message ?? err);
  }
}

export function clearHttpMocks() {
  entries.length = 0;
}

function mocksEnabled() {
  try {
    if (typeof import.meta === 'undefined' || !import.meta.env) return false;
    return (
      import.meta.env.VITE_MOCK_HTTP === 'true' ||
      import.meta.env.VITE_MOCK_SUBCASES_SEARCH === 'true'
    );
  } catch {
    return false;
  }
}

/**
 * Interceptor: primera regla que coincida gana. Desactivar una petición: `config.kace_mock = false`.
 * @param {import('axios').AxiosInstance} axiosInstance
 * @returns {number}
 */
export function applyKaceHttpMocks(axiosInstance) {
  if (!mocksEnabled() || !axiosInstance?.interceptors?.request) {
    return -1;
  }
  if (appliedInterceptors.has(axiosInstance)) {
    return -1;
  }
  appliedInterceptors.add(axiosInstance);

  return axiosInstance.interceptors.request.use((config) => {
    if (config?.kace_mock === false) {
      return config;
    }
    const method = (config.method || 'get').toLowerCase();
    const url = (config.url || '').trim();
    const reqBody = parseBody(config.data);

    for (const entry of entries) {
      if (entry.method !== method) continue;
      if (!entry.url.test(url)) continue;
      if (entry.body != null && !bodyMatches(entry.body, reqBody)) continue;

      config.adapter = (cfg) => {
        const out = entry.response(cfg);
        const p =
          out != null && typeof out.then === 'function'
            ? out
            : Promise.resolve(out);
        return p.then((payload) => ({
          data: payload,
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          config: cfg,
          request: {},
        }));
      };
      return config;
    }
    return config;
  });
}

// Mock por defecto (menor prioridad: va al final del array)
entries.push({
  method: 'post',
  url: /^\/cases\/[0-9a-f-]{36}\/sub-cases\/search$/i,
  body: null,
  response: () => SUBCASES_SEARCH_MOCK_RESPONSE,
});
