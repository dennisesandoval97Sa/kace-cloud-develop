/**
 * Convierte un texto para que la primera letra de cada palabra sea mayúscula
 * y el resto en minúscula (útil para nombres propios).
 * @param {string} [str]
 * @returns {string}
 */
export function toTitleCase(str) {
  if (str == null || typeof str !== 'string') return '';
  return str
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
