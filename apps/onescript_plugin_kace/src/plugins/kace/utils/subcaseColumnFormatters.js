/**
 * Utilidades de formateo para columnas de la tabla de subcasos.
 * Se aplican en función de la clave (key) de la columna.
 */

const NIVELES_TRUNCATE_LENGTH = 50;

/**
 * Comprueba si un valor es una fecha parseable.
 * @param {*} value
 * @returns {boolean}
 */
function isDateLike(value) {
  if (value == null || value === '') return false;
  if (value instanceof Date) return Number.isFinite(value.getTime());
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isFinite(d.getTime());
  }
  return false;
}

/**
 * Formatea un valor de tipo fecha como 'DD/MM/YYYY HH:mm'.
 * @param {*} value
 * @returns {string}
 */
export function formatDate(value) {
  if (!isDateLike(value)) return value != null ? String(value) : '';
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) return value != null ? String(value) : '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Obtiene todos los niveles (nivel1..nivel10) o clasificaciones del row y los une con "-".
 * Si el texto es largo, devuelve { displayText, fullText } para truncar y mostrar completo en hover.
 * @param {Record<string, unknown>} row
 * @returns {string | { displayText: string, fullText: string }}
 */
export function formatNiveles(row) {
  const levels = [];
  for (let i = 1; i <= 10; i++) {
    const v = row[`nivel${i}`];
    if (v != null && String(v).trim() !== '') levels.push(String(v).trim());
  }
  if (levels.length === 0) {
    const clasif = row.clasificaciones ?? row.clasifications;
    if (Array.isArray(clasif)) {
      levels.push(
        ...clasif
          .filter((x) => x != null && String(x).trim() !== '')
          .map(String)
      );
    } else if (
      clasif != null &&
      typeof clasif === 'string' &&
      clasif.trim() !== ''
    ) {
      levels.push(clasif.trim());
    }
  }
  const fullText = levels.join(' - ');
  if (fullText.length <= NIVELES_TRUNCATE_LENGTH) return fullText;
  return {
    displayText: fullText.slice(0, NIVELES_TRUNCATE_LENGTH).trim() + '…',
    fullText,
  };
}

/**
 * Junta nombres, apellido1 y apellido2 con espacio y aplica trim().
 * @param {Record<string, unknown>} row
 * @returns {string}
 */
export function formatResponsable(row) {
  const parts = [row.nombres, row.apellido1, row.apellido2].filter(
    (x) => x != null && String(x).trim() !== ''
  );
  return parts
    .map((x) => String(x).trim())
    .join(' ')
    .trim();
}

/**
 * Junta nombreCliente, primerApellido y segundoApellido con espacio y aplica trim().
 * @param {Record<string, unknown>} row
 * @returns {string}
 */
export function formatCliente(row) {
  const parts = [
    row.nombreCliente,
    row.primerApellido,
    row.segundoApellido,
  ].filter((x) => x != null && String(x).trim() !== '');
  return parts
    .map((x) => String(x).trim())
    .join(' ')
    .trim();
}

/**
 * Devuelve el tipo de formateador para una clave de columna, o null si no aplica.
 * @param {string} key
 * @param {string | null} [columnType] - Tipo explícito configurado (ej. 'date') que tiene precedencia.
 * @returns {'date' | 'niveles' | 'responsable' | 'cliente' | null}
 */
export function getFormatterType(key, columnType = null) {
  if (columnType === 'date') return 'date';
  if (key == null || typeof key !== 'string') return null;
  const k = key.trim().toLowerCase();
  if (/^nivel(1|2|3|4|5|6|7|8|9|10)$/.test(k)) return 'niveles';
  if (k === 'clasificaciones' || k === 'clasifications') return 'niveles';
  if (k === 'nombres' || k === 'responsable' || k === 'responsible')
    return 'responsable';
  if (k === 'nombrecliente' || k === 'cliente' || k === 'client')
    return 'cliente';
  if (/fecha|date|created|updated|created_at|updated_at/i.test(k))
    return 'date';
  return null;
}

/**
 * Formatea el valor de una celda según el tipo de formateador.
 * Para 'niveles' puede devolver { displayText, fullText }; para el resto, string.
 * @param {string} formatterType
 * @param {*} value
 * @param {Record<string, unknown>} row
 * @returns {string | { displayText: string, fullText: string }}
 */
export function formatCellValue(formatterType, value, row) {
  switch (formatterType) {
    case 'date':
      return formatDate(value);
    case 'niveles':
      return formatNiveles(row);
    case 'responsable':
      return formatResponsable(row);
    case 'cliente':
      return formatCliente(row);
    default:
      return value != null ? String(value) : '';
  }
}
