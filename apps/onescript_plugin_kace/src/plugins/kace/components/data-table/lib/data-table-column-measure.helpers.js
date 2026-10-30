import {
  DATA_TABLE_COLUMN_RESIZE_MAX_PX,
  DATA_TABLE_COLUMN_RESIZE_MIN_PX,
} from './data-table.constants.js';

/**
 * Estima el ancho natural necesario para el contenido de una celda (cabecera o dato),
 * sin ajuste de línea, para usar en “ajustar al contenido”.
 *
 * @param {HTMLElement} cell
 * @returns {number}
 */
function measureTableCellNaturalWidthPx(cell) {
  try {
    if (!cell || typeof document === 'undefined') {
      return DATA_TABLE_COLUMN_RESIZE_MIN_PX;
    }
    const div = document.createElement('div');
    if (cell.className) {
      div.setAttribute('class', cell.className);
    }
    div.style.cssText = [
      'position:fixed',
      'left:-100000px',
      'top:0',
      'visibility:hidden',
      'pointer-events:none',
      'white-space:nowrap',
      'width:max-content',
      'max-width:none',
      'box-sizing:border-box',
    ].join(';');
    const cs = window.getComputedStyle(cell);
    div.style.font = cs.font;
    div.style.fontSize = cs.fontSize;
    div.style.fontFamily = cs.fontFamily;
    div.style.fontWeight = cs.fontWeight;
    div.style.letterSpacing = cs.letterSpacing;
    div.style.textTransform = cs.textTransform;
    div.style.paddingLeft = cs.paddingLeft;
    div.style.paddingRight = cs.paddingRight;
    div.style.borderLeftWidth = cs.borderLeftWidth;
    div.style.borderRightWidth = cs.borderRightWidth;
    div.style.borderLeftStyle = cs.borderLeftStyle;
    div.style.borderRightStyle = cs.borderRightStyle;
    div.innerHTML = cell.innerHTML;
    document.body.appendChild(div);
    const w = div.offsetWidth;
    document.body.removeChild(div);
    return Number.isFinite(w) && w > 0 ? w : DATA_TABLE_COLUMN_RESIZE_MIN_PX;
  } catch {
    return DATA_TABLE_COLUMN_RESIZE_MIN_PX;
  }
}

/**
 * Recorre todas las filas de la tabla y devuelve el mayor ancho de contenido
 * para la columna indicada (índice en `row.cells`, alineado con thead/tbody).
 *
 * @param {HTMLTableElement | null} table
 * @param {number} columnCellIndex
 * @returns {number} Ancho en px acotado entre min/max de resize
 */
export function measureTableColumnMaxContentWidthPx(table, columnCellIndex) {
  try {
    if (!table || !table.rows || columnCellIndex < 0) {
      return DATA_TABLE_COLUMN_RESIZE_MIN_PX;
    }
    let maxW = DATA_TABLE_COLUMN_RESIZE_MIN_PX;
    for (let r = 0; r < table.rows.length; r += 1) {
      const row = table.rows[r];
      const cell = row.cells[columnCellIndex];
      if (!cell) continue;
      const w = measureTableCellNaturalWidthPx(cell);
      maxW = Math.max(maxW, w);
    }
    return Math.min(
      DATA_TABLE_COLUMN_RESIZE_MAX_PX,
      Math.max(DATA_TABLE_COLUMN_RESIZE_MIN_PX, Math.ceil(maxW))
    );
  } catch {
    return DATA_TABLE_COLUMN_RESIZE_MIN_PX;
  }
}
