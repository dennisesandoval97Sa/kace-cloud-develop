import { useMemo } from 'react';
import { buildStickyLayout } from '../lib/data-table-layout.helpers.js';

/**
 * Calcula layout sticky y anchos para cabecera/celdas del DataTable.
 *
 * @param {Object} params
 * @param {Record<string, unknown>[]} params.columns
 * @param {boolean} params.effectiveShowCheckbox
 * @param {boolean} params.hasActionsColumn
 * @param {string|number|undefined} [params.actionsColumnWidth]
 * @param {boolean} params.pinActionsColumn
 * @returns {ReturnType<typeof buildStickyLayout>}
 */
export function useDataTableColumnLayout({
  columns,
  effectiveShowCheckbox,
  hasActionsColumn,
  actionsColumnWidth,
  pinActionsColumn,
}) {
  return useMemo(
    () =>
      buildStickyLayout({
        columns,
        showCheckbox: effectiveShowCheckbox,
        hasActionsColumn,
        actionsColumnWidth,
        pinActionsColumn,
      }),
    [
      columns,
      effectiveShowCheckbox,
      hasActionsColumn,
      actionsColumnWidth,
      pinActionsColumn,
    ]
  );
}
