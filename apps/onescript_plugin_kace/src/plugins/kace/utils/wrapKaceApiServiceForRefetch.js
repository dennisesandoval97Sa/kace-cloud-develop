/**
 * Devuelve un proxy de `apiService` que en GET/POST añade `__kaceForceRefresh: true` para
 * omitir la caché HTTP de Kace cuando el control tiene "Refetch al abrir y en eventos".
 * Sin esto, el script vuelve a correr en cada apertura pero el GET no dispara red
 * (mismo URL → acierto de caché en memoria).
 *
 * @param {object} api
 * @param {boolean} forceRefresh
 * @returns {object}
 */
export function wrapKaceApiServiceForRefetch(api, forceRefresh) {
  if (!api || !forceRefresh) {
    return api;
  }
  return {
    ...api,
    get: (url, config = {}) =>
      api.get(url, { ...config, __kaceForceRefresh: true }),
    post: (url, data, config = {}) =>
      api.post(url, data, { ...config, __kaceForceRefresh: true }),
  };
}
