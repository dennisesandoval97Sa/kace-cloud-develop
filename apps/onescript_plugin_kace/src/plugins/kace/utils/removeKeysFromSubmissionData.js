/**
 * Recorre recursivamente un objeto (y sus objetos/arrays anidados) y elimina
 * las claves indicadas. Modifica el objeto in place.
 *
 * @param {Record<string, unknown> | unknown} obj - Objeto a recorrer (p. ej. submission.data)
 * @param {string[]} [keysToRemove=['kaceSubcases', 'kace_subcases']] - Claves a eliminar
 */
export function removeKeysFromSubmissionData(
  obj,
  keysToRemove = ['kaceSubcases', 'kace_subcases']
) {
  if (obj == null || typeof obj !== 'object') return;

  const keys =
    Array.isArray(keysToRemove) && keysToRemove.length
      ? keysToRemove
      : ['kaceSubcases', 'kace_subcases'];

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      removeKeysFromSubmissionData(obj[i], keys);
    }
    return;
  }

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      delete obj[key];
    }
  }

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value != null && typeof value === 'object') {
      removeKeysFromSubmissionData(value, keys);
    }
  }
}
