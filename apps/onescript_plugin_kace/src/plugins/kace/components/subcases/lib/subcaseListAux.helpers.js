import { AUX_CASES_RELATIONSHIP } from '#plugins/kace/components/subcases/lib/subcaseListAux.constants.js';

/** Segmento JSONB de primer nivel comodín soportado por el API (PostgreSQL jsonb_path_query_first). */
const WILDCARD_JSON_SEGMENT = /->'\*'/;

/**
 * Indica si la expresión usa comodín de primer nivel `'*'` (debe ir entre comillas simples).
 * @param {string} expression
 * @returns {boolean}
 */
export function auxSelectExpressionHasJsonWildcard(expression) {
  return (
    typeof expression === 'string' && WILDCARD_JSON_SEGMENT.test(expression)
  );
}

/**
 * Quita un ` as identificador` final si el administrador pega la cadena completa del API;
 * el alias en la respuesta lo define el campo "Alias" del formulario.
 * @param {string} expression
 * @returns {string}
 */
export function stripTrailingSelectAlias(expression) {
  const s = String(expression).trim();
  const m = s.match(/^(.*)\s+as\s+[a-zA-Z_][a-zA-Z0-9_]*\s*$/i);
  return m ? m[1].trimEnd() : s;
}

/**
 * Construye relationship y select para el search de subcasos a partir de auxColumns del Form.io.
 *
 * Wildcard (primer nivel de `aux_cases.data`): usar `->'*'` en la expresión, p. ej.
 * `aux_cases.data->'*'->>'nombre'` o `aux_cases.data->'*'->'items'->0->>'code'`.
 * El backend traduce a `jsonb_path_query_first` (requiere API compatible).
 *
 * @param {Array<{ selectExpression?: string, alias?: string }>|undefined} auxColumns
 * @returns {{ relationship: typeof AUX_CASES_RELATIONSHIP[] | null, select: string[] | undefined }}
 */
export function buildAuxSearchParams(auxColumns) {
  try {
    if (!Array.isArray(auxColumns) || auxColumns.length === 0) {
      return { relationship: null, select: undefined };
    }
    const validColumns = auxColumns.filter(
      (col) =>
        col &&
        typeof col.selectExpression === 'string' &&
        col.selectExpression.trim() !== '' &&
        typeof col.alias === 'string' &&
        col.alias.trim() !== ''
    );
    if (validColumns.length === 0) {
      return { relationship: null, select: undefined };
    }
    const select = validColumns.map((col) => {
      const base = stripTrailingSelectAlias(col.selectExpression.trim());
      return `${base} as ${col.alias.trim()}`;
    });
    return {
      relationship: [AUX_CASES_RELATIONSHIP],
      select,
    };
  } catch (err) {
    console.warn('[subcaseListAux] buildAuxSearchParams:', err?.message ?? err);
    return { relationship: null, select: undefined };
  }
}

/**
 * Columnas DataTable derivadas de auxColumns (alias + label).
 * @param {Array<{ alias?: string, label?: string, columnType?: string }>|undefined} auxColumns
 * @param {(key: string, columnType: string | null) => string | null} getFormatterType
 * @returns {Array<{ key: string, header: string, formatter?: string }>}
 */
export function deriveAuxColumns(auxColumns, getFormatterType) {
  try {
    if (!Array.isArray(auxColumns) || auxColumns.length === 0) {
      return [];
    }
    return auxColumns
      .filter(
        (c) =>
          c &&
          typeof c.alias === 'string' &&
          c.alias.trim() !== '' &&
          c.label != null &&
          String(c.label).trim() !== ''
      )
      .map((c) => {
        const key = c.alias.trim();
        const header = String(c.label).trim();
        const colType = Object.prototype.hasOwnProperty.call(c, 'columnType')
          ? String(c.columnType)
          : null;
        const formatter = getFormatterType(key, colType) || undefined;
        return { key, header, ...(formatter && { formatter }) };
      });
  } catch (err) {
    console.warn('[subcaseListAux] deriveAuxColumns:', err?.message ?? err);
    return [];
  }
}

/**
 * Lista de alias válidos para normalización (misma lista que en buildAuxSearchParams).
 * @param {Array<{ alias?: string }>|undefined} auxColumns
 * @returns {string[]}
 */
export function getAuxAliasesFromColumns(auxColumns) {
  try {
    if (!Array.isArray(auxColumns) || auxColumns.length === 0) {
      return [];
    }
    return auxColumns
      .filter(
        (col) =>
          col &&
          typeof col.alias === 'string' &&
          col.alias.trim() !== '' &&
          typeof col.selectExpression === 'string' &&
          col.selectExpression.trim() !== ''
      )
      .map((col) => col.alias.trim());
  } catch (err) {
    console.warn(
      '[subcaseListAux] getAuxAliasesFromColumns:',
      err?.message ?? err
    );
    return [];
  }
}

/**
 * Normaliza valores aux: parsea strings JSON y convierte objetos/arrays a string para el grid.
 * @param {any[]} items
 * @param {string[]} auxAliases
 * @returns {any[]}
 */
export function normalizeAuxItems(items, auxAliases) {
  try {
    if (
      !Array.isArray(items) ||
      items.length === 0 ||
      auxAliases.length === 0
    ) {
      return Array.isArray(items) ? items : [];
    }
    return items.map((item) => {
      if (item == null || typeof item !== 'object') {
        return item;
      }
      const normalized = { ...item };
      for (const alias of auxAliases) {
        const val = normalized[alias];
        if (typeof val === 'string') {
          try {
            const parsed = JSON.parse(val);
            if (parsed !== null && typeof parsed === 'object') {
              normalized[alias] = JSON.stringify(parsed);
            } else {
              normalized[alias] = parsed;
            }
          } catch {
            // mantener string
          }
        } else if (val !== null && typeof val === 'object') {
          normalized[alias] = JSON.stringify(val);
        }
      }
      return normalized;
    });
  } catch (err) {
    console.warn('[subcaseListAux] normalizeAuxItems:', err?.message ?? err);
    return Array.isArray(items) ? items : [];
  }
}
