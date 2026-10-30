import { useCallback, useMemo, useState } from 'react';
import { measureTableColumnMaxContentWidthPx } from '../lib/data-table-column-measure.helpers.js';
import {
  DATA_TABLE_COLUMN_RESIZE_MAX_PX,
  DATA_TABLE_COLUMN_RESIZE_MIN_PX,
} from '../lib/data-table.constants.js';

/**
 * Clave estable por columna para persistir el ancho arrastrado en sesión.
 *
 * @param {Record<string, unknown>} column
 * @param {number} index
 * @returns {string}
 */
export function getColumnResizeKey(column, index) {
  try {
    if (column?.key != null && String(column.key).length > 0) {
      return String(column.key);
    }
    return `__col_${index}`;
  } catch {
    return `__col_${index}`;
  }
}

/**
 * Permite cambiar el ancho de las columnas de datos arrastrando el borde derecho del encabezado.
 * Los valores se guardan en estado local (no modifican el esquema del formulario).
 *
 * @param {Object} params
 * @param {Record<string, unknown>[]} params.columns
 * @param {boolean} params.enabled
 * @param {boolean} params.effectiveShowCheckbox - si hay columna checkbox, desplaza el índice en la fila
 * @returns {{ columnsWithResize: Record<string, unknown>[], beginColumnResize: Function, autoFitColumnWidth: Function }}
 */
export function useDataTableColumnResize({
  columns,
  enabled,
  effectiveShowCheckbox,
}) {
  const [widthPxByKey, setWidthPxByKey] = useState(() => ({}));

  const columnsWithResize = useMemo(() => {
    if (!Array.isArray(columns)) return [];
    return columns.map((col, i) => {
      const k = getColumnResizeKey(col, i);
      const w = widthPxByKey[k];
      if (w == null) return col;
      return { ...col, width: w };
    });
  }, [columns, widthPxByKey]);

  const beginColumnResize = useCallback(
    (event, columnIndex) => {
      try {
        if (!enabled) return;
        event.preventDefault();
        event.stopPropagation();
        const col = columns[columnIndex];
        if (!col) return;
        const key = getColumnResizeKey(col, columnIndex);
        const th = event.currentTarget?.closest?.('th');
        if (!th) return;
        const startWidth = th.getBoundingClientRect().width;
        const startX = event.clientX;

        const onMove = (e) => {
          try {
            const next = Math.round(startWidth + (e.clientX - startX));
            const clamped = Math.max(
              DATA_TABLE_COLUMN_RESIZE_MIN_PX,
              Math.min(DATA_TABLE_COLUMN_RESIZE_MAX_PX, next)
            );
            setWidthPxByKey((prev) => ({ ...prev, [key]: clamped }));
          } catch (err) {
            console.warn(
              '[DataTable] column resize move:',
              err?.message ?? err
            );
          }
        };
        const onUp = () => {
          document.removeEventListener('pointermove', onMove);
          document.removeEventListener('pointerup', onUp);
          document.removeEventListener('pointercancel', onUp);
        };
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
        document.addEventListener('pointercancel', onUp);
      } catch (err) {
        console.warn('[DataTable] column resize start:', err?.message ?? err);
      }
    },
    [columns, enabled]
  );

  /**
   * Doble clic en el borde: ancho = máximo necesario para el contenido visible (cabecera + filas).
   */
  const autoFitColumnWidth = useCallback(
    (event, columnIndex) => {
      try {
        if (!enabled) return;
        event.preventDefault();
        event.stopPropagation();
        const col = columns[columnIndex];
        if (!col) return;
        const table = event.currentTarget?.closest?.('table');
        if (!table) return;
        const columnCellIndex = (effectiveShowCheckbox ? 1 : 0) + columnIndex;
        const maxW = measureTableColumnMaxContentWidthPx(
          table,
          columnCellIndex
        );
        const key = getColumnResizeKey(col, columnIndex);
        setWidthPxByKey((prev) => ({ ...prev, [key]: maxW }));
      } catch (err) {
        console.warn('[DataTable] autoFitColumnWidth:', err?.message ?? err);
      }
    },
    [columns, enabled, effectiveShowCheckbox]
  );

  return { columnsWithResize, beginColumnResize, autoFitColumnWidth };
}
