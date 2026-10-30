import {
  DATA_TABLE_ACTIONS_COLUMN_WIDTH_FALLBACK_PX,
  DATA_TABLE_CHECKBOX_COLUMN_WIDTH_PX,
  DATA_TABLE_CHECKBOX_STICKY_TD_BG,
  DATA_TABLE_CHECKBOX_STICKY_TH_BG,
  DATA_TABLE_COLUMN_WIDTH_FALLBACK_PX,
  DATA_TABLE_STICKY_Z_BODY_BASE,
  DATA_TABLE_STICKY_Z_CHECKBOX_BODY,
  DATA_TABLE_STICKY_Z_CHECKBOX_HEADER,
  DATA_TABLE_STICKY_Z_HEADER_BASE,
  DATA_TABLE_STICKY_Z_PINLEFT_BODY_MAX,
  DATA_TABLE_STICKY_Z_PINLEFT_HEADER_MAX,
} from './data-table.constants.js';

/**
 * Lee una propiedad desde `component` o `component.config` (prioridad raíz).
 *
 * @param {Record<string, unknown> | undefined} component
 * @param {string} key
 * @param {unknown} defaultValue
 * @returns {unknown}
 */
export function resolveComponentProp(component, key, defaultValue) {
  try {
    if (
      component &&
      Object.prototype.hasOwnProperty.call(component, key) &&
      component[key] !== undefined
    ) {
      return component[key];
    }
    const cfg =
      component?.config && typeof component.config === 'object'
        ? component.config
        : null;
    if (
      cfg &&
      Object.prototype.hasOwnProperty.call(cfg, key) &&
      cfg[key] !== undefined
    ) {
      return cfg[key];
    }
  } catch {
    // ignore
  }
  return defaultValue;
}

/**
 * Normaliza valores booleanos que Form.io u otros hosts pueden enviar como string (`"true"` / `"false"`).
 *
 * @param {unknown} value
 * @param {boolean} defaultValue
 * @returns {boolean}
 */
export function coerceFormBoolean(value, defaultValue) {
  try {
    if (value === true || value === 'true' || value === 1 || value === '1') {
      return true;
    }
    if (value === false || value === 'false' || value === 0 || value === '0') {
      return false;
    }
    if (value === null || value === undefined || value === '') {
      return defaultValue;
    }
    return Boolean(value);
  } catch {
    return defaultValue;
  }
}

/**
 * @param {unknown} value
 * @returns {string|undefined}
 */
export function normalizeCssDimension(value) {
  try {
    if (value == null || value === '') return undefined;
    if (typeof value === 'number' && !Number.isNaN(value)) return `${value}px`;
    const s = String(value).trim();
    return s.length > 0 ? s : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Convierte width/minWidth a un número aproximado en px para offsets sticky.
 * % y valores no parseables devuelven `fallbackPx`.
 *
 * @param {unknown} value
 * @param {number} fallbackPx
 * @returns {number}
 */
export function parseWidthToPixels(value, fallbackPx) {
  try {
    const n = normalizeCssDimension(value);
    if (!n) return fallbackPx;
    if (n.endsWith('px')) {
      const v = parseFloat(n);
      return Number.isFinite(v) && v > 0 ? v : fallbackPx;
    }
    if (n.endsWith('rem')) {
      const v = parseFloat(n);
      return Number.isFinite(v) && v > 0 ? v * 16 : fallbackPx;
    }
    if (n.endsWith('%')) return fallbackPx;
    const asNum = Number(n);
    if (Number.isFinite(asNum) && asNum > 0) return asNum;
    return fallbackPx;
  } catch {
    return fallbackPx;
  }
}

/**
 * Estilos de ancho para th/td desde la definición de columna.
 *
 * @param {Record<string, unknown>} column
 * @returns {Record<string, string>}
 */
export function buildColumnWidthStyle(column) {
  const style = {};
  try {
    const w = normalizeCssDimension(column?.width);
    const minW = normalizeCssDimension(column?.minWidth);
    const maxW = normalizeCssDimension(column?.maxWidth);
    if (w) style.width = w;
    if (minW) style.minWidth = minW;
    if (maxW) style.maxWidth = maxW;
  } catch {
    // ignore
  }
  return style;
}

/**
 * @param {Record<string, unknown>} column
 * @returns {boolean}
 */
export function isColumnPinnedLeft(column) {
  try {
    return (
      column?.pinLeft === true ||
      column?.fixedLeft === true ||
      column?.stickyLeft === true
    );
  } catch {
    return false;
  }
}

/**
 * Calcula posiciones sticky y estilos para checkbox, columnas de datos y acciones.
 *
 * @param {Object} params
 * @param {Record<string, unknown>[]} params.columns
 * @param {boolean} params.showCheckbox - Si la columna de selección está visible (incl. acciones masivas), queda fija a la izquierda.
 * @param {boolean} params.hasActionsColumn
 * @param {string|number|undefined} params.actionsColumnWidth
 * @param {boolean} params.pinActionsColumn
 * @returns {{ checkbox: object, dataColumns: object[], actions: object }}
 */
export function buildStickyLayout({
  columns,
  showCheckbox,
  hasActionsColumn,
  actionsColumnWidth,
  pinActionsColumn,
}) {
  const safeColumns = Array.isArray(columns) ? columns : [];
  let offsetPx = 0;
  let stickyIndex = 0;

  /** Columna de selección siempre sticky cuando está visible (selección o acciones masivas). */
  const shouldStickyCheckboxColumn = Boolean(showCheckbox);

  /** @type {{ sticky: boolean, thStyle: Record<string, unknown>, tdStyle: Record<string, unknown> }} */
  const checkbox = {
    sticky: false,
    thStyle: { width: `${DATA_TABLE_CHECKBOX_COLUMN_WIDTH_PX}px` },
    tdStyle: {},
  };

  /**
   * El ancho de la columna checkbox siempre reserva espacio para columnas pinLeft,
   * aunque el checkbox no sea sticky; si no, la primera columna fijada usaría left:0
   * y se superpondría a los checks.
   */
  if (showCheckbox) {
    offsetPx += DATA_TABLE_CHECKBOX_COLUMN_WIDTH_PX;
  }

  if (showCheckbox && shouldStickyCheckboxColumn) {
    checkbox.sticky = true;
    checkbox.thStyle = {
      width: `${DATA_TABLE_CHECKBOX_COLUMN_WIDTH_PX}px`,
      position: 'sticky',
      left: 0,
      zIndex: DATA_TABLE_STICKY_Z_CHECKBOX_HEADER,
      backgroundColor: DATA_TABLE_CHECKBOX_STICKY_TH_BG,
    };
    checkbox.tdStyle = {
      position: 'sticky',
      left: 0,
      zIndex: DATA_TABLE_STICKY_Z_CHECKBOX_BODY,
      backgroundColor: DATA_TABLE_CHECKBOX_STICKY_TD_BG,
    };
  }

  const dataColumns = safeColumns.map((col) => {
    const widthStyle = buildColumnWidthStyle(col);
    const pin = isColumnPinnedLeft(col);
    const widthPx = parseWidthToPixels(
      col?.width ?? col?.minWidth,
      DATA_TABLE_COLUMN_WIDTH_FALLBACK_PX
    );
    if (!pin) {
      return {
        pinLeft: false,
        widthStyle,
        thClassSuffix: '',
        headerStyle: {},
        cellStyle: {},
      };
    }
    const leftPx = offsetPx;
    offsetPx += widthPx;
    const zH = Math.min(
      DATA_TABLE_STICKY_Z_HEADER_BASE + stickyIndex,
      DATA_TABLE_STICKY_Z_PINLEFT_HEADER_MAX
    );
    const zB = Math.min(
      DATA_TABLE_STICKY_Z_BODY_BASE + stickyIndex,
      DATA_TABLE_STICKY_Z_PINLEFT_BODY_MAX
    );
    stickyIndex += 1;
    return {
      pinLeft: true,
      widthStyle,
      thClassSuffix: ' data-table__th--sticky',
      headerStyle: {
        position: 'sticky',
        left: leftPx,
        zIndex: zH,
      },
      cellStyle: {
        position: 'sticky',
        left: leftPx,
        zIndex: zB,
      },
    };
  });

  const actionsWidthStyle = {
    width:
      normalizeCssDimension(actionsColumnWidth) ??
      `${DATA_TABLE_ACTIONS_COLUMN_WIDTH_FALLBACK_PX}px`,
  };

  /**
   * Columna Acciones: va a la derecha de la tabla → debe usar `right: 0`, no `left`,
   * para permanecer visible al hacer scroll horizontal.
   *
   * @type {{ show: boolean, pinRight: boolean, widthStyle: Record<string, string>, headerStyle: Record<string, unknown>, cellStyle: Record<string, unknown> }}
   */
  const actions = {
    show: hasActionsColumn,
    pinRight: false,
    widthStyle: actionsWidthStyle,
    headerStyle: {},
    cellStyle: {},
  };

  if (hasActionsColumn && pinActionsColumn) {
    actions.pinRight = true;
    const zH = DATA_TABLE_STICKY_Z_HEADER_BASE + 40;
    const zB = DATA_TABLE_STICKY_Z_BODY_BASE + 40;
    actions.headerStyle = {
      position: 'sticky',
      right: 0,
      zIndex: zH,
    };
    actions.cellStyle = {
      position: 'sticky',
      right: 0,
      zIndex: zB,
    };
  }

  return { checkbox, dataColumns, actions };
}
