import { formatUTCForDisplay, looksLikeISODate } from './dateTimeUTC.js';

const DATE_LIKE_KEYS = new Set([
  'updated_at',
  'created_at',
  'fecha_inicio',
  'fecha_fin',
  'fecha',
  'date',
  'timestamp',
]);

/**
 * Format UTC/ISO date for display.
 * @param {string} [iso]
 * @returns {string}
 */
export function formatUpdatedAt(iso) {
  return formatUTCForDisplay(iso, { timeStyle: 'medium' });
}

/**
 * Format a single attribute value for display (dates, arrays, objects, primitives).
 * Avoids showing "[objeto]" - uses readable representations for arrays and objects.
 * @param {*} val
 * @param {string} [key]
 * @returns {string}
 */
export function formatAttributeValue(val, key = '') {
  if (val == null) return '—';
  if (typeof val === 'boolean') return val ? 'Sí' : 'No';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') {
    const k = key.toLowerCase?.() ?? '';
    if (DATE_LIKE_KEYS.has(k) || looksLikeISODate(val)) {
      return formatUTCForDisplay(val);
    }
    return val || '—';
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return '—';
    if (val.every((entry) => entry != null && typeof entry === 'object')) {
      return `${val.length} elemento(s)`;
    }
    const parts = val.map((v) => formatAttributeValue(v, key));
    if (parts.every((p) => p !== '—' && p.length < 60)) return parts.join(', ');
    if (parts.length <= 3) return parts.join(', ');
    return `${parts.length} elemento(s)`;
  }
  if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
    const entries = Object.entries(val);
    if (entries.length === 0) return '—';
    const parts = entries
      .slice(0, 5)
      .map(([k, v]) => `${formatLabel(k)}: ${formatAttributeValue(v, k)}`);
    if (parts.every((p) => p.length < 50)) return `{ ${parts.join(', ')} }`;
    return `{ ${parts.length} propiedad(es) }`;
  }
  return String(val);
}

/**
 * Flatten an object into key-value pairs for display (one level, nested shown as JSON).
 * For recursive rendering use renderAttributePairs in the component.
 * @param {Object} obj
 * @param {string} [prefix]
 * @returns {Array<{ key: string, value: string }>}
 */
export function flattenAttributesForDisplay(obj, prefix = '') {
  if (obj == null || typeof obj !== 'object') return [];
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (
      v != null &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      !(v instanceof Date)
    ) {
      const nested = flattenAttributesForDisplay(v, fullKey);
      out.push(...nested);
    } else {
      out.push({ key: formatLabel(k), value: formatAttributeValue(v, k) });
    }
  }
  return out;
}

/**
 * Rutas en el objeto comparado (p. ej. `new_attributes`) que son solo metadatos de fila auxiliar.
 * Se excluyen por **path** completo, no por etiqueta: cualquier `updated_at` anidado (p. ej. `data.form1.updated_at`)
 * sigue mostrándose aunque `formatLabel('updated_at')` sea "Actualizado".
 */
const EXCLUDED_COMPARISON_ROOT_PATHS = new Set([
  'id',
  'updated_at',
  'created_at',
  'updated_by',
  'created_by',
]);

/**
 * Get flattened key-value pairs for comparison: antes vs nuevo, excluding metadata (fecha, hora, creator).
 * Returns only fields that differ; for create events (no original) returns all new fields with oldValue '—'.
 * @param {Object} newAttrs
 * @param {Object} originalAttrs
 * @returns {Array<{ key: string, oldValue: string, newValue: string }>}
 */
export function getAttributeComparison(newAttrs, originalAttrs) {
  const newFlat = flattenAttributesForComparison(newAttrs ?? {});
  const origFlat = flattenAttributesForComparison(originalAttrs ?? {});
  const origMap = new Map(
    origFlat.map(({ path, value, rawValue }) => [path, { value, rawValue }])
  );
  const isCreate = origFlat.length === 0;
  const out = [];
  for (const { path, key, value: newVal, rawValue: newRaw } of newFlat) {
    if (EXCLUDED_COMPARISON_ROOT_PATHS.has(path)) continue;
    const oldData = origMap.get(path);
    const oldVal = oldData?.value ?? '—';
    const oldRaw = oldData?.rawValue;
    const formattedDiffers = isCreate || oldVal !== newVal;

    if (formattedDiffers) {
      const row = { key, oldValue: oldVal, newValue: newVal };
      if (Array.isArray(newRaw) || Array.isArray(oldRaw)) {
        const details = getArrayComparisonRows(
          Array.isArray(newRaw) ? newRaw : [],
          Array.isArray(oldRaw) ? oldRaw : [],
          key
        );
        if (details.length > 0) {
          row.details = details;
        }
      }
      out.push(row);
      continue;
    }

    if (Array.isArray(newRaw) || Array.isArray(oldRaw)) {
      const details = getArrayComparisonRows(
        Array.isArray(newRaw) ? newRaw : [],
        Array.isArray(oldRaw) ? oldRaw : [],
        key
      );
      if (details.length > 0) {
        out.push({ key, oldValue: newVal, newValue: newVal, details });
      }
      continue;
    }

    if (isComparableObject(newRaw) && isComparableObject(oldRaw)) {
      const objectRows = getObjectComparisonRows(newRaw, oldRaw);
      if (objectRows.length > 0) {
        out.push({
          key,
          oldValue: newVal,
          newValue: newVal,
          details: objectRows,
        });
      }
    }
  }
  return out;
}

/**
 * Flatten an object preserving path and raw value for richer comparisons.
 * Arrays are considered leaf values (summarized in `value`) with raw data in `rawValue`.
 * @param {Object} obj
 * @param {string} [prefix]
 * @returns {Array<{ path: string, key: string, value: string, rawValue: unknown }>} `key` = última key JSON sin traducir; `path` = ruta completa (diff y exclusiones).
 */
function flattenAttributesForComparison(obj, prefix = '') {
  if (obj == null || typeof obj !== 'object') return [];
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${k}` : k;
    if (
      v != null &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      !(v instanceof Date)
    ) {
      const nested = flattenAttributesForComparison(v, fullPath);
      out.push(...nested);
      continue;
    }
    out.push({
      path: fullPath,
      key: k,
      value: formatAttributeValue(v, k),
      rawValue: v,
    });
  }
  return out;
}

/**
 * @param {string} path
 * @returns {string[]}
 */
export function parsePathSegments(path) {
  if (path == null || typeof path !== 'string') return [];
  return path
    .split('.')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * If `path` ends with a numeric segment (array index), returns the parent path without it.
 * E.g. `data.persona.localidad.6` → `data.persona.localidad`.
 * Returns empty string when the path has fewer than 2 segments or does not end with a number.
 * @param {string} path
 * @returns {string}
 */
export function getParentPathIfEndsWithNumericIndex(path) {
  const segments = parsePathSegments(path);
  if (segments.length < 2) return '';
  const last = segments[segments.length - 1];
  if (!/^\d+$/.test(last)) return '';
  return segments.slice(0, -1).join('.');
}

/**
 * Whether `path` (dot segments) exists as own properties on nested plain objects.
 * @param {unknown} obj
 * @param {string} path
 * @returns {boolean}
 */
export function hasPathInObject(obj, path) {
  const segments = parsePathSegments(path);
  if (segments.length === 0) return false;
  let cur = obj;
  for (const seg of segments) {
    if (cur == null || typeof cur !== 'object') return false;
    if (!Object.prototype.hasOwnProperty.call(cur, seg)) return false;
    cur = cur[seg];
  }
  return true;
}

/**
 * @param {unknown} obj
 * @param {string} path
 * @returns {unknown}
 */
export function getValueAtPath(obj, path) {
  const segments = parsePathSegments(path);
  if (segments.length === 0) return undefined;
  let cur = obj;
  for (const seg of segments) {
    if (cur == null || typeof cur !== 'object') return undefined;
    if (!Object.prototype.hasOwnProperty.call(cur, seg)) return undefined;
    cur = cur[seg];
  }
  return cur;
}

/**
 * Single-field comparison along a JSON path (both sides must define the path).
 * @param {Object} newAttrs
 * @param {Object} originalAttrs
 * @param {string} path
 * @returns {{ kind: 'missing' } | { kind: 'rows', rows: Array<{ key: string, oldValue: string, newValue: string }> }}
 */
export function getComparisonForFieldPath(newAttrs, originalAttrs, path) {
  const trimmed = typeof path === 'string' ? path.trim() : '';
  if (!trimmed) {
    return { kind: 'rows', rows: [] };
  }
  const newObj = newAttrs ?? {};
  const origObj = originalAttrs ?? {};
  const hasNewPath = hasPathInObject(newObj, trimmed);
  const hasOrigPath = hasPathInObject(origObj, trimmed);
  if (!hasNewPath) {
    return { kind: 'missing' };
  }
  const segments = parsePathSegments(trimmed);
  const leafKey = segments[segments.length - 1] ?? '';
  const oldVal = hasOrigPath ? getValueAtPath(origObj, trimmed) : undefined;
  const newVal = getValueAtPath(newObj, trimmed);
  if (Array.isArray(newVal)) {
    const safeOldArray = Array.isArray(oldVal) ? oldVal : [];
    const arrayRows = getArrayComparisonRows(newVal, safeOldArray);
    if (arrayRows.length === 0) {
      return { kind: 'rows', rows: [] };
    }
    return {
      kind: 'rows',
      rows: arrayRows,
    };
  }
  if (isComparableObject(newVal)) {
    const safeOldObject = isComparableObject(oldVal) ? oldVal : {};
    const objectRows = getObjectComparisonRows(newVal, safeOldObject);
    if (objectRows.length === 0) {
      return { kind: 'rows', rows: [] };
    }
    return {
      kind: 'rows',
      rows: objectRows,
    };
  }
  const oldStr = formatAttributeValue(oldVal, leafKey);
  const newStr = formatAttributeValue(newVal, leafKey);
  const origFlat = flattenAttributesForDisplay(origObj);
  const isCreate = origFlat.length === 0;
  if (!isCreate && oldStr === newStr) {
    return { kind: 'rows', rows: [] };
  }
  return {
    kind: 'rows',
    rows: [{ key: leafKey, oldValue: oldStr, newValue: newStr }],
  };
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isComparableObject(value) {
  return (
    value != null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

/**
 * @param {Object} value
 * @param {string} [prefix]
 * @returns {Array<{ path: string, key: string, value: string }>}
 */
function flattenObjectForComparison(value, prefix = '') {
  if (!isComparableObject(value)) return [];
  const out = [];
  for (const [k, v] of Object.entries(value)) {
    const fullPath = prefix ? `${prefix}.${k}` : k;
    if (isComparableObject(v)) {
      out.push(...flattenObjectForComparison(v, fullPath));
      continue;
    }
    out.push({
      path: fullPath,
      key: k,
      value: formatAttributeValue(v, k),
    });
  }
  return out;
}

/**
 * @param {Object} newObj
 * @param {Object} oldObj
 * @returns {Array<{ key: string, oldValue: string, newValue: string }>}
 */
function getObjectComparisonRows(newObj, oldObj) {
  const newFlat = flattenObjectForComparison(newObj);
  const oldFlat = flattenObjectForComparison(oldObj);
  const newMap = new Map(
    newFlat.map(({ path, key, value }) => [path, { key, value }])
  );
  const oldMap = new Map(
    oldFlat.map(({ path, key, value }) => [path, { key, value }])
  );
  const allPaths = new Set([...newMap.keys(), ...oldMap.keys()]);
  const rows = [];
  for (const path of allPaths) {
    const newEntry = newMap.get(path);
    const oldEntry = oldMap.get(path);
    const newValue = newEntry?.value ?? '—';
    const oldValue = oldEntry?.value ?? '—';
    if (oldValue !== newValue) {
      const segments = parsePathSegments(path);
      const leaf = segments.length > 0 ? segments[segments.length - 1] : path;
      const key = newEntry?.key ?? oldEntry?.key ?? leaf;
      rows.push({ key, oldValue, newValue });
    }
  }
  return rows;
}

/**
 * @param {Array<unknown>} newArr
 * @param {Array<unknown>} oldArr
 * @returns {Array<{ key: string, oldValue: string, newValue: string }>}
 */
function getArrayComparisonRows(newArr, oldArr, keyPrefix = '') {
  const maxLength = Math.max(newArr.length, oldArr.length);
  const rows = [];
  for (let index = 0; index < maxLength; index += 1) {
    const newValue = newArr[index];
    const oldValue = oldArr[index];
    const rowKeyPrefix = keyPrefix || 'Elemento';
    const arrayItemKeyPrefix = `${rowKeyPrefix} [${index + 1}]`;

    if (isComparableObject(newValue) || isComparableObject(oldValue)) {
      const objectRows = getObjectComparisonRows(
        isComparableObject(newValue) ? newValue : {},
        isComparableObject(oldValue) ? oldValue : {}
      ).map((row) => ({
        key: `${arrayItemKeyPrefix} / ${row.key}`,
        oldValue: row.oldValue,
        newValue: row.newValue,
      }));
      rows.push(...objectRows);
      continue;
    }

    if (Array.isArray(newValue) || Array.isArray(oldValue)) {
      const nestedRows = getArrayComparisonRows(
        Array.isArray(newValue) ? newValue : [],
        Array.isArray(oldValue) ? oldValue : [],
        arrayItemKeyPrefix
      );
      rows.push(...nestedRows);
      continue;
    }

    const oldStr = formatAttributeValue(oldValue, '');
    const newStr = formatAttributeValue(newValue, '');
    if (oldStr !== newStr) {
      rows.push({
        key: arrayItemKeyPrefix,
        oldValue: oldStr,
        newValue: newStr,
      });
    }
  }
  return rows;
}

function formatLabel(k) {
  const last = k.split('.').pop() || k;
  const labels = {
    id: 'ID',
    updated_at: 'Actualizado',
    created_at: 'Creado',
    updated_by: 'Actualizado por',
    created_by: 'Creado por',
    fecha_inicio: 'Fecha inicio',
    fecha_fin: 'Fecha fin',
    nombre: 'Nombre',
    telefono: 'Teléfono',
    direccion: 'Dirección',
    tipo: 'Tipo',
    data: 'Datos',
  };
  return labels[last] ?? last.replace(/_/g, ' ');
}
